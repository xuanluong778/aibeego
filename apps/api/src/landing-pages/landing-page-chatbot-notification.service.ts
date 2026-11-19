import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

const PURPOSE = 'landing_page_chatbot_handoff';
@Injectable()
export class LandingPageChatbotNotificationService {
  private readonly logger = new Logger(LandingPageChatbotNotificationService.name);
  private transporter: Transporter | null = null;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async enqueue(input:{organizationId:string;landingPageId:string;slug:string;chatbotLeadId:string;crmLeadId:string;conversationId:string}) {
    const lead = await this.prisma.lead.findFirst({where:{id:input.crmLeadId,organizationId:input.organizationId},select:{id:true,name:true,phone:true,email:true,note:true,assignedToId:true}});
    if (!lead) return 'unavailable';
    const employee=lead.assignedToId?await this.prisma.employee.findFirst({where:{id:lead.assignedToId,organizationId:input.organizationId,isActive:true},select:{id:true,email:true,user:{select:{email:true}}}}):null;
    const to=(employee?.email||employee?.user?.email||'').trim().toLowerCase();
    const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
    const idempotencyKey=`lp-chatbot:${input.chatbotLeadId}`;
    const metadata={...input,employeeId:employee?.id||null,attempts:0};
    const existing=await this.prisma.emailOutboundMessage.findUnique({where:{organizationId_idempotencyKey:{organizationId:input.organizationId,idempotencyKey}}});
    if(existing?.status==='SENT')return 'sent';
    const data={toEmail:valid?to:'',subject:`Khách cần tư vấn — Landing Page ${input.slug}`.slice(0,240),metadata:metadata as any,status:valid?'PENDING':'BLOCKED',lastError:valid?null:'ASSIGNED_EMPLOYEE_EMAIL_MISSING'};
    const row=existing
      ? existing.status==='BLOCKED'&&valid?await this.prisma.emailOutboundMessage.update({where:{id:existing.id},data}):existing
      : await this.prisma.emailOutboundMessage.upsert({where:{organizationId_idempotencyKey:{organizationId:input.organizationId,idempotencyKey}},create:{organizationId:input.organizationId,purpose:PURPOSE,idempotencyKey,...data},update:{}});
    if(!valid){if(!existing)this.logger.warn(`Handoff saved; assigned employee email missing for lead=${lead.id}`);return 'blocked';}
    void this.deliver(row.id).catch(()=>undefined);
    return 'queued';
  }

  @Cron('*/30 * * * * *')
  async retryPending() {
    // Reclaim interrupted sends. Atomic status claims prevent parallel workers.
    await this.prisma.emailOutboundMessage.updateMany({where:{purpose:PURPOSE,status:'SENDING',updatedAt:{lt:new Date(Date.now()-120000)}},data:{status:'FAILED',lastError:'SEND_INTERRUPTED'}});
    const blocked=await this.prisma.emailOutboundMessage.findMany({where:{purpose:PURPOSE,status:'BLOCKED',updatedAt:{lt:new Date(Date.now()-30000)},createdAt:{gte:new Date(Date.now()-7*86400000)}},select:{metadata:true},take:30});
    for(const row of blocked){const meta=row.metadata as any;if(meta?.crmLeadId&&meta?.chatbotLeadId)await this.enqueue(meta).catch(()=>undefined);}
    const rows=await this.prisma.emailOutboundMessage.findMany({where:{purpose:PURPOSE,status:{in:['PENDING','FAILED']},updatedAt:{lt:new Date(Date.now()-30000)},createdAt:{gte:new Date(Date.now()-7*86400000)}},select:{id:true,metadata:true},take:30,orderBy:{createdAt:'asc'}});
    for(const row of rows){if(Number((row.metadata as any)?.attempts||0)>=5)continue;await this.deliver(row.id).catch(()=>undefined);}
  }

  async deliver(id:string) {
    const row=await this.prisma.emailOutboundMessage.findUnique({where:{id}});if(!row||row.purpose!==PURPOSE||!['PENDING','FAILED'].includes(row.status))return;
    const meta=row.metadata as any;if(Number(meta?.attempts||0)>=5)return;
    const claimed=await this.prisma.emailOutboundMessage.updateMany({where:{id,status:row.status,updatedAt:row.updatedAt},data:{status:'SENDING',metadata:{...meta,attempts:Number(meta?.attempts||0)+1}}});if(!claimed.count)return;
    try {
      const lead=await this.prisma.lead.findFirst({where:{id:meta.crmLeadId,organizationId:row.organizationId},select:{id:true,name:true,phone:true,email:true,note:true,assignedToId:true}});
      const employee=lead?.assignedToId?await this.prisma.employee.findFirst({where:{id:lead.assignedToId,organizationId:row.organizationId,isActive:true},select:{id:true,email:true,user:{select:{email:true}}}}):null;
      const to=(employee?.email||employee?.user?.email||'').trim().toLowerCase();
      if(!lead||!employee||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){await this.prisma.emailOutboundMessage.update({where:{id},data:{status:'BLOCKED',lastError:'ASSIGNED_EMPLOYEE_EMAIL_MISSING'}});return;}
      const host=this.config.get<string>('SMTP_HOST')?.trim(),user=this.config.get<string>('SMTP_USER')?.trim(),pass=(this.config.get<string>('SMTP_PASS')||'').replace(/\s+/g,'');
      if(!host||!user||!pass)throw Error('SMTP_NOT_CONFIGURED');
      if(!this.transporter){const port=Number(this.config.get<string>('SMTP_PORT')||587);this.transporter=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass},connectionTimeout:10000,socketTimeout:15000});}
      const base=(this.config.get<string>('APP_URL')||'https://aibeego.com').replace(/\/$/,'');
      const history=await this.prisma.chatbotMessage.findMany({where:{conversationId:meta.conversationId,conversation:{organizationId:row.organizationId}},orderBy:{createdAt:'desc'},take:8,select:{role:true,message:true}});
      const text=[`Có khách cần tư vấn từ Landing Page ${meta.slug}.`,`Họ tên: ${lead.name}`,`Điện thoại: ${lead.phone||'Không cung cấp'}`,`Email: ${lead.email||'Không cung cấp'}`,`Nhu cầu: ${(lead.note||'').slice(0,2000)}`,`Mở lead: ${base}/leads?id=${lead.id}`,'','Hội thoại gần đây:',...history.reverse().map(m=>`${m.role==='user'?'Khách':'Trợ lý'}: ${m.message.slice(0,1000)}`)].join('\n');
      const result=await this.transporter.sendMail({from:`Ai Bee Go <${user}>`,to,subject:row.subject||'Khách cần tư vấn Landing Page',text,messageId:`<lp-chatbot-${id}@aibeego.com>`});
      await this.prisma.emailOutboundMessage.update({where:{id},data:{toEmail:to,status:'SENT',provider:'smtp',providerMessageId:result.messageId||id,sentAt:new Date(),failedAt:null,lastError:null}});
    } catch {
      await this.prisma.emailOutboundMessage.update({where:{id},data:{status:'FAILED',failedAt:new Date(),lastError:'SMTP_SEND_FAILED'}});
      this.logger.warn(`Landing Page handoff email failed; will retry outbox=${id}`);
    }
  }
}
