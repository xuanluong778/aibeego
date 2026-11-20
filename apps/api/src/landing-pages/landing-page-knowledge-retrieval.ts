import type { ChatbotKnowledgeSource } from '@marketingspa/database';

export const normalizeKnowledgeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const words = (text: string) => normalizeKnowledgeText(text).match(/[a-z0-9]+/g) || [];
export type KnowledgeIntent = 'address' | 'contact' | 'hours' | 'price' | 'difficulty' | 'curriculum' | 'duration' | 'general';
export type KnowledgeTopic = 'seo-course' | 'entity' | 'seo-service' | 'website' | 'digital-course';

// Search-only normalization: the customer's original message is kept for the AI/history.
function questionText(text: string): string {
  return normalizeKnowledgeText(text)
    .replace(/\bhoc\s*fi\b|\bhocphi\b/g, 'hoc phi')
    .replace(/\bkhoahoc\b/g, 'khoa hoc')
    .replace(/\b(?:bnh|bnhiu|bn)\b|\bbao nhiu\b/g, 'bao nhieu')
    .replace(/\bs\s*[.]\s*e\s*[.]\s*o\b/g, 'seo')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const PRICE = /\b(?:hoc phi|phi (?:hoc|khoa hoc|khoa|lop)|tien hoc|tien (?:khoa|lop)(?: hoc)?|chi phi|muc phi|le phi|bang gia|bao gia|gia(?: tien| ca| ro| khoa hoc| khoa| goi)?|mat bao nhieu tien|can dong bao nhieu|phai dong bao nhieu|bao nhieu tien|bao nhieu dong|tuition(?: fee)?|pricing|price|cost|fee|how much)\b/;
const hasPriceLanguage = (text: string) => PRICE.test(text.replace(/\b(?:danh gia|chuyen gia|doc gia|tac gia|quoc gia|tham gia|gia dinh|gia su)\b/g, ' '));
const DURATION = /\b(?:bao lau|thoi luong|thoi gian hoc|lich hoc|lich khai giang|khai giang|mo lop|khi nao bat dau hoc|hoc (?:may|bao nhieu) (?:buoi|tuan|thang|ngay|gio)|(?:may|bao nhieu) buoi|(?:may|bao nhieu) (?:tuan|thang|ngay) hoc|schedule|duration)\b/;
const CURRICULUM = /\b(?:giao trinh|chuong trinh(?: hoc| dao tao)?|noi dung(?: hoc| dao tao| khoa hoc)?|hoc (?:duoc )?(?:nhung )?gi|hoc ve nhung gi|nhung gi duoc hoc|cac bai hoc|(?:may|bao nhieu) bai(?: hoc)?|nhung chu de|nhung mon hoc|curriculum|syllabus)\b/;
const ADDRESS = /\b(?:dia chi|tru so|van phong|dia diem|co so o dau|cong ty o dau|ben (?:ban|minh|em) o dau|o dau|o cho nao|nam o dau|address|location)\b/;
const CONTACT = /\b(?:hotline|so dien thoai|so dt|sdt|so lien he|lien he (?:the nao|nhu nao|bang cach nao)|goi (?:so nao|vao so)|email|gmail|contact)\b/;
const HOURS = /\b(?:gio (?:lam viec|mo cua|dong cua|tu van)|(?:may gio|luc nao) (?:mo cua|dong cua)|mo cua|dong cua|working hours|opening hours)\b/;
const DIFFICULTY = /\b(?:kho(?: hoc| khong)?|de (?:hoc|khong)|nguoi moi|bat dau|chua biet|can kien thuc|can nen tang|dau vao|prerequisite)\b/;
const patterns: Partial<Record<KnowledgeIntent, RegExp>> = { price: PRICE, duration: DURATION, curriculum: CURRICULUM, address: ADDRESS, contact: CONTACT, hours: HOURS, difficulty: DIFFICULTY };
const canonical: Partial<Record<KnowledgeIntent, string>> = {price:'gia',duration:'thoi luong',curriculum:'giao trinh',address:'dia chi',contact:'hotline',hours:'gio lam viec',difficulty:'nguoi moi'};
const STOP = new Set('toi minh em anh chi ban cho muon can xin duoc la va cua ve voi co khong thi nao nhe oi mot nhung cac nay do tai day giup tu van thong tin biet tim hieu xin chao hello hi hey o dau nhu the hoc khoa phi gia bao nhieu kho de a da nhi vay nha nhen ha ah ak nhe luon chut xiu hoi ben tam khoang sao lam gi se phai dong tra nop het ton mat lop goi moi dung ne the nay ay no roi ntn ra hien nay bay cu nua ko k ahh the how is are the this that it course does do please can could you me your our for of to about a'.split(' '));

/** Normalize equivalent intent phrases before matching, without removing a new product name. */
export function normalizeLandingPageKnowledgeQuery(text: string): string {
  const t = questionText(text), intent = knowledgeIntent(t), pattern = patterns[intent];
  return pattern ? t.replace(new RegExp(pattern.source, 'g'), canonical[intent] || '').replace(/\s+/g, ' ').trim() : t;
}
const keywords = (text: string) => [...new Set(words(normalizeLandingPageKnowledgeQuery(text)).filter(w => w.length >= 3 && !STOP.has(w)))];

export function knowledgeIntent(text: string): KnowledgeIntent {
  const t = questionText(text);
  if (ADDRESS.test(t) && !/dia chi (?:website|trang web|email)/.test(t)) return 'address';
  if (HOURS.test(t)) return 'hours';
  if (CONTACT.test(t) && !hasPriceLanguage(t)) return 'contact';
  if (hasPriceLanguage(t)) return 'price';
  // Counts of lessons or sessions are not prices, even though they contain “bao nhiêu”.
  if (CURRICULUM.test(t)) return 'curriculum';
  if (DURATION.test(t)) return 'duration';
  if (DIFFICULTY.test(t)) return 'difficulty';
  if (/bao nhieu/.test(t) && !/bao nhieu (?:nguoi|hoc vien|khach|nhan vien|tuoi)/.test(t)) return 'price';
  return 'general';
}

export function knowledgeTopic(text: string): KnowledgeTopic | undefined {
  const t = questionText(text);
  if (/khoa (?:hoc )?seo|lop (?:hoc )?seo|hoc (?:ve )?seo|hoc phi.*seo|seo.*hoc phi|dao tao seo|seo dong hanh|seo basic|seo premium|basic.*premium|seo course|course seo|learn seo|seo training/.test(t)) return 'seo-course';
  if (/entity|google stack/.test(t)) return 'entity';
  if (/dich vu seo|seo tong the|trien khai seo|thue.*seo/.test(t)) return 'seo-service';
  if (/thiet ke (?:website|web)|lam (?:website|web)/.test(t)) return 'website';
  if (/khoa.*(?:digital|marketing)|dao tao digital/.test(t)) return 'digital-course';
  return undefined;
}

export function resolveLandingPageKnowledgeQuery(text: string, history: Array<{role:string;message:string}>, rememberedTopic?: KnowledgeTopic): string {
  const intent = knowledgeIntent(text);
  const explicitTopic=knowledgeTopic(text);
  if (['address','contact','hours'].includes(intent)) return text;
  if (explicitTopic) {
    const productWords=new Set('seo khoa hoc lop dong hanh basic premium entity social google stack dich vu tong the trien khai thue thiet ke lam website web digital marketing dao tao course training'.split(' '));
    if (intent==='general' && words(questionText(text)).filter(w=>!STOP.has(w)).every(w=>productWords.has(w))) {
      const previous=[...history].reverse().find(m=>m.role==='user' && m.message!==text);
      const previousIntent=previous?knowledgeIntent(previous.message):'general';
      if (previous && !knowledgeTopic(previous.message) && ['price','duration','curriculum'].includes(previousIntent)) return `${text}: ${canonical[previousIntent]}`;
    }
    return text;
  }
  if (intent === 'general') return text;
  const semanticWords = words(normalizeLandingPageKnowledgeQuery(text)).filter(w => !STOP.has(w));
  const followupWords = new Set('thoi luong lich gian lau may buoi tuan thang ngay gio nguoi bat dau ban giao trinh chuong trinh noi dung mon bai trinh do nen tang ki khai giang tuong phuong phap khoan thanh toan'.split(' '));
  const recentTopic = [...history].reverse().filter(m => m.role==='user').map(m => knowledgeTopic(m.message)).find(Boolean) || rememberedTopic;
  if (!recentTopic) return text;
  const sameTopicWords: Record<KnowledgeTopic,Set<string>> = {
    'seo-course':new Set(['seo','basic','premium']), 'entity':new Set(['entity','social','stack']),
    'seo-service':new Set(['seo','tong','the']), 'website':new Set(['web','website']), 'digital-course':new Set(['digital','marketing']),
  };
  // A novel subject such as “khóa nấu ăn” must never inherit SEO pricing.
  if (!semanticWords.every(w => followupWords.has(w) || sameTopicWords[recentTopic].has(w))) return text;
  const label: Record<KnowledgeTopic,string> = {'seo-course':'Khóa học SEO','entity':'Dịch vụ Entity','seo-service':'Dịch vụ SEO tổng thể','website':'Thiết kế website','digital-course':'Khóa học Digital Marketing'};
  return `${label[recentTopic]}: ${text}`;
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
  if(intent==='price')return chunk.tablePrice?45:hasPriceLanguage(text+' '+heading)||chunk.intent==='price'?35:0;
  if(intent==='difficulty')return /nguoi moi|co ban|bat dau/.test(text)?40:/phuong phap dao tao|thuc hanh/.test(heading+' '+text)?20:0;
  if(intent==='curriculum')return /giao trinh|noi dung hoc|hoc nhung gi|chu de gom|bai \d/.test(text+' '+heading)?35:0;
  if(intent==='duration')return /lich hoc|khai giang|thoi luong|thoi gian hoc|hoc bao lau|\d+\s*(?:buoi|tuan|thang|ngay|gio|phut)\b/.test(text+' '+heading)?35:0;
  return 0;
}

export function retrieveLandingPageKnowledge(sources:ChatbotKnowledgeSource[],query:string,sourceIds?:string[]):LandingPageKnowledgeChunk[] {
  const intent=knowledgeIntent(query), topic=knowledgeTopic(query), target=keywords(query);
  const global=['address','contact','hours'].includes(intent);
  const tuition=/\b(?:hoc phi|phi (?:hoc|khoa|lop)|tien hoc|tuition)\b/.test(questionText(query));
  const ranked:LandingPageKnowledgeChunk[]=[];
  for(const candidate of parseLandingPageKnowledge(sources,sourceIds)) {
    if(!global && topic && candidate.topic && candidate.topic!==topic)continue;
    if(intent==='price' && tuition && !topic && candidate.topic && !['seo-course','digital-course'].includes(candidate.topic))continue;
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
