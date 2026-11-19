import type { ChatbotKnowledgeSource } from '@marketingspa/database';

export const normalizeKnowledgeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const words = (text: string) => normalizeKnowledgeText(text).match(/[a-z0-9]+/g) || [];
const STOP = new Set('toi minh em anh chi ban cho muon can xin duoc la va cua ve voi co khong thi nao nhe oi mot nhung cac nay do tai day giup tu van thong tin biet tim hieu xin chao hello hi hey o dau nhu the hoc khoa phi gia bao nhieu kho de'.split(' '));
const keywords = (text: string) => [...new Set(words(text).filter(w => w.length >= 3 && !STOP.has(w)))];
export type KnowledgeIntent = 'address' | 'contact' | 'hours' | 'price' | 'difficulty' | 'curriculum' | 'duration' | 'general';
export type KnowledgeTopic = 'seo-course' | 'entity' | 'seo-service' | 'website' | 'digital-course';

export function knowledgeIntent(text: string): KnowledgeIntent {
  const t = normalizeKnowledgeText(text);
  if (/dia chi|tru so|van phong|cong ty o dau|ben (?:ban|minh|em) o dau|\bo dau\b/.test(t) && !/dia chi (?:website|trang web|email)/.test(t)) return 'address';
  if (/gio (?:lam viec|mo cua)|mo cua|dong cua|may gio/.test(t)) return 'hours';
  if (/hotline|so dien thoai|\bsdt\b|email|gmail/.test(t) && !/hoc phi|gia/.test(t)) return 'contact';
  if (/hoc phi|chi phi|bao nhieu|gia tien|muc phi|\bgia\b/.test(t)) return 'price';
  if (/\bkho\b|\bde khong\b|nguoi moi|bat dau|chua biet|can kien thuc/.test(t)) return 'difficulty';
  if (/giao trinh|hoc (?:nhung gi|gi)|noi dung hoc|hoc duoc gi|chuong trinh|co hoc/.test(t)) return 'curriculum';
  if (/bao lau|thoi gian|lich hoc|khai giang|may buoi/.test(t)) return 'duration';
  return 'general';
}

export function knowledgeTopic(text: string): KnowledgeTopic | undefined {
  const t = normalizeKnowledgeText(text);
  if (/khoa (?:hoc )?seo|hoc seo|hoc phi.*seo|seo.*hoc phi|dao tao seo|seo dong hanh|seo basic|seo premium|basic.*premium/.test(t)) return 'seo-course';
  if (/entity|google stack/.test(t)) return 'entity';
  if (/dich vu seo|seo tong the|trien khai seo|thue.*seo/.test(t)) return 'seo-service';
  if (/thiet ke (?:website|web)|lam (?:website|web)/.test(t)) return 'website';
  if (/khoa.*(?:digital|marketing)|dao tao digital/.test(t)) return 'digital-course';
  return undefined;
}

export function resolveLandingPageKnowledgeQuery(text: string, history: Array<{role:string;message:string}>): string {
  const intent = knowledgeIntent(text);
  if (['address','contact','hours'].includes(intent) || knowledgeTopic(text)) return text;
  // Only genuinely elliptical follow-ups inherit a product, never a new question's unrelated subject.
  const followupWords = new Set('hoc phi gia tien bao nhieu kho de lich thoi gian bao lau may buoi nhu the nao nguoi moi bat dau co ban duoc gi noi dung chuong trinh'.split(' '));
  const elliptical = words(text).filter(w => !STOP.has(w)).every(w => followupWords.has(w));
  if (!elliptical || intent === 'general') return text;
  for (const message of [...history].reverse()) {
    if (message.role !== 'user' || message.message === text) continue;
    const topic = knowledgeTopic(message.message);
    if (!topic) continue;
    const label: Record<KnowledgeTopic,string> = {'seo-course':'Khóa học SEO','entity':'Dịch vụ Entity','seo-service':'Dịch vụ SEO tổng thể','website':'Thiết kế website','digital-course':'Khóa học Digital Marketing'};
    return `${label[topic]}: ${text}`;
  }
  return text;
}

export type LandingPageKnowledgeChunk = {
  sourceId: string;
  title: string;
  heading: string;
  content: string;
  score: number;
  kind: 'faq' | 'table' | 'text';
  intent: KnowledgeIntent;
  topic?: KnowledgeTopic;
  question?: string;
  tableLabel?: string;
  tablePrice?: string;
};

export function plainKnowledgeText(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`]/g,'').replace(/^\s*(?:[-*]|\d+\.)\s+/gm,'').replace(/^\s*[QA]:\s*/i,'').replace(/\s+/g,' ').trim();
}
const policyHeading = (text: string) => /quy tac van hanh|system knowledge policy|huong dan (?:noi bo|cho (?:ai|chatbot))|danh sach can.*bo sung|nhat ky nguon|system prompt/.test(normalizeKnowledgeText(text));
const instruction = (text: string) => /^(?:\d+[.)]\s*)?(?:khong tu tao|khong bia|khong hua|uu tien thong tin co nguon|chatbot (?:chi nen|chi duoc|khong duoc|can hoi)|huong dan chatbot)/.test(normalizeKnowledgeText(plainKnowledgeText(text)));

/** Parse Markdown structure before ranking. Tables and FAQ answers must not be discarded as one mixed paragraph. */
export function parseLandingPageKnowledge(sources: ChatbotKnowledgeSource[], sourceIds?: string[]): LandingPageKnowledgeChunk[] {
  const chunks: LandingPageKnowledgeChunk[] = [];
  for (const source of sources) {
    if (!['ready','active'].includes(source.status) || (sourceIds?.length && !sourceIds.includes(source.id))) continue;
    const headings: string[] = [];
    let paragraph: string[] = [];
    let question = '';
    let tableHeader: string[] = [];
    const add = (content: string, kind: LandingPageKnowledgeChunk['kind'], extra: Partial<LandingPageKnowledgeChunk> = {}) => {
      const heading = headings.filter(Boolean).join(' / ');
      if (policyHeading(heading) || !content.trim()) return;
      const clean = content.split('\n').filter(line => !instruction(line)).join('\n').trim();
      if (!clean || /^(?:nguồn|url|ngày kiểm tra|cập nhật)\s*:/i.test(plainKnowledgeText(clean)) || /^https?:\/\/\S+$/.test(clean)) return;
      const ownTopic = extra.question ? knowledgeTopic(extra.question) : extra.tableLabel ? knowledgeTopic(extra.tableLabel) : undefined;
      chunks.push({sourceId:source.id,title:source.title,heading,content:clean.slice(0,3000),score:0,kind,intent:knowledgeIntent(extra.question || clean),topic:ownTopic || knowledgeTopic(heading),...extra});
    };
    const flush = () => {
      const text = paragraph.join('\n').trim(); paragraph = [];
      if (!text) return;
      if (question) { add(text.replace(/^A:\s*/i,''),'faq',{question,heading:[...headings.filter(Boolean),question].join(' / '),intent:knowledgeIntent(question)}); question=''; }
      else add(text,'text');
    };
    for (const line of (source.content || '').split(/\r?\n/)) {
      const h = /^(#{1,6})\s+(.+)$/.exec(line);
      if (h) {
        const title=(h[2] || '').trim();
        if (title===source.title || title.startsWith(`${source.title} · phần `)) continue;
        flush(); question=''; tableHeader=[];const level=(h[1] || '#').length;headings.length=level;headings[level-1]=title;continue;
      }
      const q = /^(?:\*\*)?Q:\s*(.+?)(?:\*\*)?\s*$/.exec(line.trim());
      if (q) { flush(); question=(q[1] || '').replace(/\*\*$/,'').trim(); tableHeader=[]; continue; }
      if (!line.trim()) { flush(); continue; }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        flush();const cells=line.trim().slice(1,-1).split('|').map(c=>plainKnowledgeText(c));
        if(cells.every(c=>/^:?-+:?$/.test(c)))continue;
        if(!tableHeader.length){tableHeader=cells;continue;}
        const priceIndex=tableHeader.findIndex(c=>/\bgia\b|hoc phi|price/.test(normalizeKnowledgeText(c)));
        const label=cells.slice(0,priceIndex>0?priceIndex:2).join(' ');
        const fields=cells.map((c,i)=>`${tableHeader[i] || 'Thông tin'}: ${c}`).join('; ');
        add(fields,'table',{tableLabel:label,...(priceIndex>=0?{tablePrice:cells[priceIndex],intent:'price' as const}:{})});continue;
      }
      if (/^\s*[-*]\s+/.test(line) && !question) { flush();add(line,'text');continue; }
      paragraph.push(line);
    }
    flush();
  }
  return chunks;
}

function facetScore(chunk: LandingPageKnowledgeChunk, intent: KnowledgeIntent): number {
  const text=normalizeKnowledgeText(`${chunk.question || ''} ${chunk.content}`), heading=normalizeKnowledgeText(chunk.heading);
  if(intent==='address')return /dia chi|tru so|van phong/.test(text)||/cong ty o dau/.test(text)?40:0;
  if(intent==='contact')return /hotline|dien thoai|email|gmail/.test(text)?35:0;
  if(intent==='hours')return /gio lam viec|gio mo cua|gio mo|mo cua|thu hai.*chu nhat/.test(text)?40:0;
  if(intent==='price')return chunk.tablePrice?45:/hoc phi|gia hoc|gia khoa hoc|gia tham khao|gia niem yet|gia tien|gia goi|bao nhieu/.test(text+' '+heading)?35:0;
  if(intent==='difficulty')return /nguoi moi|co ban|bat dau/.test(text)?40:/phuong phap dao tao|thuc hanh/.test(heading+' '+text)?20:0;
  if(intent==='curriculum')return /giao trinh|noi dung hoc|hoc nhung gi|chu de gom|bai \d/.test(text+' '+heading)?35:0;
  if(intent==='duration')return /lich hoc|khai giang|thoi luong|thoi gian hoc|buoi hoc|hoc bao lau/.test(text+' '+heading)?35:0;
  return 0;
}

export function retrieveLandingPageKnowledge(sources:ChatbotKnowledgeSource[],query:string,sourceIds?:string[]):LandingPageKnowledgeChunk[] {
  const intent=knowledgeIntent(query), topic=knowledgeTopic(query), target=keywords(query);
  const global=['address','contact','hours'].includes(intent);
  const ranked:LandingPageKnowledgeChunk[]=[];
  for(const candidate of parseLandingPageKnowledge(sources,sourceIds)) {
    if(!global && topic && candidate.topic && candidate.topic!==topic)continue;
    const facet=facetScore(candidate,intent);
    if(intent!=='general' && !facet)continue;
    const bodyWords=new Set(words(`${candidate.question || ''} ${candidate.content}`)),headingWords=new Set(words(candidate.heading));
    const matched=target.filter(t=>bodyWords.has(t)||headingWords.has(t));
    if(!global && !topic) {
      if(!target.length && !facet)continue;
      if(target.length && matched.length<Math.min(2,target.length))continue;
    }
    if(topic && !global && candidate.topic!==topic) {
      const distinctive=topic==='seo-course'?/seo|basic|premium/i:topic==='entity'?/entity/i:topic==='website'?/website|web/i:/marketing/i;
      if(!distinctive.test(`${candidate.question || ''} ${candidate.content}`))continue;
    }
    const lex=matched.reduce((n,t)=>n+(bodyWords.has(t)?3:0)+(headingWords.has(t)?2:0),0);
    let score=lex+facet+(topic && candidate.topic===topic?25:0);
    if(candidate.kind==='faq' && facet && (global || !topic || candidate.topic===topic))score+=35;
    if(intent==='general' && topic==='seo-course' && /doi tuong|phuong phap|giao trinh/.test(normalizeKnowledgeText(candidate.heading)))score+=15;
    if(score>0)ranked.push({...candidate,score});
  }
  ranked.sort((a,b)=>b.score-a.score);
  const seen=new Set<string>();
  return ranked.filter(c=>{const key=c.sourceId+':'+c.content;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
}

/** Safe factual answers come from a complete approved Q&A or a typed table, never a raw arbitrary snippet. */
export function directLandingPageKnowledgeAnswer(chunks:LandingPageKnowledgeChunk[],query:string):string|undefined {
  const intent=knowledgeIntent(query);
  if(['address','contact','hours','price'].includes(intent)) {
    const faq=chunks.find(c=>c.kind==='faq' && c.intent===intent);
    if(faq)return plainKnowledgeText(faq.content);
    if(intent==='price') {
      const rows=chunks.filter(c=>c.kind==='table' && c.tableLabel && c.tablePrice && /\d/.test(c.tablePrice));
      if(rows.length)return `Theo tài liệu, ${rows.map(c=>`${c.tableLabel}: ${c.tablePrice}`).join('; ')}. Đây là giá tham khảo, cần xác nhận lại giá và quyền lợi hiện hành trước khi đăng ký.`;
    }
    if(intent==='address') {
      const address=chunks.find(c=>/^(?:dia chi|tru so|van phong)(?:\s|:)/.test(normalizeKnowledgeText(plainKnowledgeText(c.content))));
      if(address)return plainKnowledgeText(address.content);
    }
  }
  return undefined;
}
