import { createHash } from 'node:crypto';
import { knowledgeTopic, normalizeKnowledgeText, type KnowledgeTopic } from './landing-page-knowledge-retrieval';

export type LandingPageConversationState = {
  version: 1;
  topic?: KnowledgeTopic;
  learnerLevel?: 'beginner' | 'experienced';
  goal?: 'own-website' | 'client-work' | 'career';
  dailyMinutes?: number;
  declinedContact?: boolean;
  lastQuestion?: string;
  lastUserHash?: string;
  repeatedInputCount?: number;
};
export type ConversationTurn = { role: string; message: string };
const topics = new Set(['seo-course','entity','seo-service','website','digital-course']);
const hash = (text: string) => createHash('sha256').update(normalizeKnowledgeText(text).replace(/[^a-z0-9]+/g,' ').trim()).digest('hex');

/** Metadata is written by the server; still whitelist fields and values on read. */
export function readLandingPageConversationState(value: unknown): LandingPageConversationState {
  const raw = value && typeof value==='object' ? value as Record<string,unknown> : {};
  const state: LandingPageConversationState = {version:1};
  if (raw.version !== 1) return state;
  if (typeof raw.topic==='string' && topics.has(raw.topic)) state.topic=raw.topic as KnowledgeTopic;
  if (raw.learnerLevel==='beginner'||raw.learnerLevel==='experienced') state.learnerLevel=raw.learnerLevel;
  if (raw.goal==='own-website'||raw.goal==='client-work'||raw.goal==='career') state.goal=raw.goal;
  if (typeof raw.dailyMinutes==='number'&&Number.isInteger(raw.dailyMinutes)&&raw.dailyMinutes>0&&raw.dailyMinutes<=1440) state.dailyMinutes=raw.dailyMinutes;
  if (typeof raw.declinedContact==='boolean') state.declinedContact=raw.declinedContact;
  if (typeof raw.lastQuestion==='string') state.lastQuestion=raw.lastQuestion.slice(0,400);
  if (typeof raw.lastUserHash==='string'&&/^[a-f0-9]{64}$/.test(raw.lastUserHash)) state.lastUserHash=raw.lastUserHash;
  if (typeof raw.repeatedInputCount==='number') state.repeatedInputCount=Math.min(20,Math.max(0,Math.floor(raw.repeatedInputCount)));
  return state;
}

export function isLearnerProfileStatement(text: string): boolean {
  const t=normalizeKnowledgeText(text);
  const self=/\b(toi|minh|em|tui|anh|chi)\b/.test(t)||/^(?:moi bat dau|moi hoc|nguoi moi|chua biet|chua hoc|bat dau tu dau)[.!\s]*$/.test(t);
  return self && !/\?|co .*khong|co the .*khong/.test(t) && /moi bat dau|moi hoc|nguoi moi|chua (?:biet|hoc|lam)|bat dau tu dau|da (?:hoc|lam|trien khai)|biet.*co ban|co kinh nghiem/.test(t);
}

export function updateLandingPageConversationState(previous: unknown, history: ConversationTurn[], text: string): LandingPageConversationState {
  const state=readLandingPageConversationState(previous);
  const apply=(message:string) => {
    const t=normalizeKnowledgeText(message);
    const topic=knowledgeTopic(message);if(topic)state.topic=topic;
    if(isLearnerProfileStatement(message)) {
      if(/khong phai (?:la )?(?:nguoi )?moi|da (?:hoc|lam|trien khai)|biet.*co ban|co kinh nghiem/.test(t)&&!/chua (?:biet|hoc|lam)/.test(t))state.learnerLevel='experienced';
      else state.learnerLevel='beginner';
    }
    if(/website (?:cua )?(?:toi|minh|em)|web (?:cua )?(?:toi|minh|em)|kinh doanh (?:cua )?(?:toi|minh|em)/.test(t))state.goal='own-website';
    if(/lam dich vu|lam cho khach|nhan du an|freelancer/.test(t))state.goal='client-work';
    if(/xin viec|di lam|chuyen nghe|tim viec/.test(t))state.goal='career';
    const time=/(\d{1,3})\s*(phut|gio|tieng)(?:\s*(?:moi|mot|\/))?\s*ngay/.exec(t);
    if(time){const minutes=Number(time[1])*(time[2]==='phut'?1:60);if(minutes>0&&minutes<=1440)state.dailyMinutes=minutes;}
  };
  for(const turn of history)if(turn.role==='user')apply(turn.message);
  const lastUser=[...history].reverse().find(t=>t.role==='user');
  const currentHash=hash(text);
  state.repeatedInputCount=(state.lastUserHash===currentHash||Boolean(lastUser&&hash(lastUser.message)===currentHash))?(state.repeatedInputCount||0)+1:0;
  apply(text);state.lastUserHash=currentHash;
  if(!state.lastQuestion){const last=[...history].reverse().find(t=>t.role==='assistant');state.lastQuestion=lastQuestion(last?.message||'');}
  return state;
}

export function lastQuestion(text:string):string|undefined {
  return text.match(/[^.!?\n]*\?/g)?.at(-1)?.trim().slice(0,400);
}

export function conversationStatePrompt(state:LandingPageConversationState):string {
  const levels={beginner:'Khách đã nói rõ mình mới bắt đầu. Không hỏi lại trình độ hoặc đã học SEO chưa.',experienced:'Khách đã có kiến thức/kinh nghiệm. Không hỏi lại câu phân loại người mới.'};
  const goals={'own-website':'Áp dụng cho website của chính khách.','client-work':'Làm dịch vụ/dự án cho khách hàng.','career':'Học để đi làm/chuyển nghề.'};
  return [state.topic?`Chủ đề gần nhất: ${state.topic}. Câu hỏi hiện tại luôn ưu tiên nếu khách đổi chủ đề.`:'',state.learnerLevel?levels[state.learnerLevel]:'Trình độ chưa được khách cung cấp.',state.goal?`Mục tiêu đã biết: ${goals[state.goal]} Không hỏi lại mục tiêu này.`:'',state.dailyMinutes?`Khách có ${state.dailyMinutes} phút học mỗi ngày. Không hỏi lại thời gian này.`:'',state.lastQuestion?`Câu hỏi gần nhất của trợ lý: ${state.lastQuestion} Không lặp câu hỏi này nếu khách vừa trả lời.`:'',state.repeatedInputCount?`Khách vừa lặp lại cùng một nội dung ${state.repeatedInputCount} lần. Ghi nhận điều khách nói và đưa bước tiếp theo cụ thể, đừng lặp lời giới thiệu hoặc cùng một câu hỏi.`:''].filter(Boolean).join('\n');
}

export function isGeneralAdviceRequest(text:string):boolean {
  return isLearnerProfileStatement(text)||/nen |lo trinh|tu hoc|moi ngay|bat dau|co kho khong|kho hoc|hoc.*\bkho\b|lam sao|cach |kinh nghiem|so sanh|phu hop|dang hoc|ly do|vi sao|tai sao|ke hoach/.test(normalizeKnowledgeText(text));
}

export function isBusinessFactRequest(text:string):boolean {
  const t=normalizeKnowledgeText(text);
  if (/la gi|y nghia|khai niem/.test(t) && !/ben (?:ban|em)|cua (?:ban|ben)|cong ty/.test(t)) return false;
  return /hoc phi|gia (?:khoa|goi|dich vu)|phi (?:khoa|dich vu)|dia chi|hotline|so dien thoai|email (?:cua|ben)|gio (?:lam viec|mo cua)|lich (?:hoc|khai giang)|khai giang|thoi luong khoa|may buoi|bao nhieu buoi|chung chi (?:cua|khoa)|hoan (?:phi|tien)|chinh sach|bao hanh|khuyen mai/.test(t);
}

export function removeAnsweredQuestions(answer:string,state:LandingPageConversationState):string {
  return answer.split(/(?<=[.!?])\s+/u).filter(sentence=>{
    if(!sentence.includes('?'))return true;
    if(state.learnerLevel && (state.repeatedInputCount||0)>0) return false;
    const q=normalizeKnowledgeText(sentence);
    if(state.learnerLevel && /trinh do|kinh nghiem|da tung|tung (?:hoc|tim hieu)|da hoc|hoc.*chua|moi bat dau|nguoi moi|bat dau moi|nen tang/.test(q))return false;
    if(state.goal && /muc tieu.*(?:gi|nao)|hoc de.*hay|website.*hay.*dich vu/.test(q))return false;
    if(state.dailyMinutes && /moi ngay.*(?:bao nhieu|may)|danh.*(?:bao nhieu|may).*phut/.test(q))return false;
    return !state.lastQuestion || normalizeKnowledgeText(state.lastQuestion).replace(/[^a-z0-9]/g,'')!==q.replace(/[^a-z0-9]/g,'');
  }).join(' ').trim();
}

export function repeatsPreviousAnswer(answer:string,history:ConversationTurn[]):boolean {
  const previous=[...history].reverse().find(t=>t.role==='assistant')?.message||'';
  const n=(s:string)=>normalizeKnowledgeText(s).replace(/[^a-z0-9]+/g,' ').trim();
  const a=n(answer),b=n(previous);
  return a.length>60&&b.length>60&&(a===b||a.includes(b)||b.includes(a));
}
