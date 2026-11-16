'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Connection={hostname:string;ownershipVerified:boolean;dnsVerified:boolean;tlsStatus:string;ready:boolean;needsPublish:boolean;url:string;lastCheckedAt?:string;verification:{name:string;value:string};routing:{value:string;addresses:string[]}};
type Row={id:string;name:string;slug:string;status:string;customDomain:string|null;customDomainError:string|null;connection:Connection|null};
type Listing={items:Row[];architecture:{cnameTarget:string;edgeAddresses:string[];platformReady:boolean;message?:string|null}};
const panel={border:'1px solid rgba(255,255,255,.15)',borderRadius:14,padding:'clamp(16px,2vw,26px)',background:'rgba(255,255,255,.035)'};
export default function LandingPagesDomainPage(){
 const [data,setData]=useState<Listing|null>(null),[selectedId,setSelectedId]=useState(''),[domain,setDomain]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmRemove,setConfirmRemove]=useState(false);
 const row=data?.items.find(x=>x.id===selectedId),connection=row?.connection;
 async function reload(preferred?:string){const next=await apiClient<Listing>('/landing-pages/domains');setData(next);const id=preferred||selectedId||next.items[0]?.id||'';setSelectedId(id);setDomain(next.items.find(x=>x.id===id)?.customDomain||'');return next}
 useEffect(()=>{let live=true;apiClient<Listing>('/landing-pages/domains').then(next=>{if(!live)return;setData(next);setSelectedId(next.items[0]?.id||'');setDomain(next.items[0]?.customDomain||'')}).catch(e=>live&&setError(e.message||'Không tải được danh sách trang')).finally(()=>live&&setLoading(false));return()=>{live=false}},[]);
 async function act(kind:'save'|'verify'|'remove'){
  if(!selectedId||busy)return;setBusy(kind);setError('');setMessage('');
  try{
   if(kind==='save'){
    if(!domain.trim())throw Error('Hãy nhập tên miền bạn muốn sử dụng.');
    await apiClient(`/landing-pages/${selectedId}/domain`,{method:'POST',body:JSON.stringify({customDomain:domain.trim()})});
    setMessage('Đã lưu tên miền. Thêm các bản ghi DNS bên dưới rồi bấm Kiểm tra kết nối.');
   }else if(kind==='verify'){
    const result=await apiClient<{message:string;https:{ready:boolean}}>(`/landing-pages/${selectedId}/domain/verify`,{method:'POST',body:'{}'});
    setMessage(result.message||'Đã kiểm tra kết nối.');
   }else{
    await apiClient(`/landing-pages/${selectedId}/domain`,{method:'DELETE'});setConfirmRemove(false);setMessage('Đã tháo tên miền khỏi landing page.');
   }
   await reload(selectedId);
  }catch(e){setError(e instanceof Error?e.message:'Không thực hiện được. Vui lòng thử lại.')}finally{setBusy(null)}
 }
 const [copiedKey,setCopiedKey]=useState<string|null>(null);
 async function copy(value:string,note:string,key:string){
  let ok=false;
  try{await navigator.clipboard.writeText(value);ok=true}catch{
   try{const t=document.createElement('textarea');t.value=value;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();ok=document.execCommand('copy');document.body.removeChild(t)}catch{ok=false}
  }
  if(!ok){setError('Không sao chép tự động được. Bạn có thể chọn và sao chép giá trị trong ô.');return}
  setError('');setMessage(note);setCopiedKey(key);
  window.setTimeout(()=>setCopiedKey(k=>k===key?null:k),2000);
 }
 const copyLabel=(key:string,idle:ReactNode)=>copiedKey===key?'✓ Đã sao chép':idle;
 const status=connection?.ready?'Đang hoạt động · HTTPS':connection?.dnsVerified?'DNS đã xác minh · Chờ HTTPS':row?.customDomain?'Chờ xác minh DNS':'Chưa gắn tên miền';
 const zone=connection?connection.hostname.split('.').slice(1).join('.'):'';
 const hostLabel=(fqdn:string)=>{
  if(!connection||!zone)return fqdn;
  if(fqdn===connection.hostname)return connection.hostname.split('.')[0]||'@';
  if(fqdn.endsWith('.'+zone))return fqdn.slice(0,-(zone.length+1));
  return fqdn;
 };
 const quoted=(value:string)=>`"${value.replace(/^"|"$/g,'').replace(/"/g,'\\"')}"`;
 const record=(label:string,fqdn:string,value:string,kind:'TXT'|'CNAME')=>{
  const host=hostLabel(fqdn);
  return <div style={{padding:'16px 0',borderBottom:'1px solid rgba(255,255,255,.12)',minWidth:0}} key={label}>
   <strong>{label}</strong>
   <div style={{fontSize:13,opacity:.8,margin:'8px 0'}}>Tên host (nhập vào DNS{zone?` — zone ${zone}`:''})</div>
   <div style={{display:'flex',gap:8,minWidth:0}}><Input aria-label={`Tên host ${label}`} readOnly value={host} style={{minWidth:0}}/><Button variant="outline" onClick={()=>void copy(host,'Đã sao chép tên host.',label+':host')} aria-live="polite">{copyLabel(label+':host','Sao chép')}</Button></div>
   <div style={{fontSize:12,opacity:.7,marginTop:6,lineHeight:1.6}}>FQDN đầy đủ: <b>{fqdn}</b>. Nếu panel tự thêm tên miền gốc, chỉ dán phần host ở trên — không dán cả FQDN.</div>
   <div style={{fontSize:13,opacity:.8,margin:'8px 0'}}>Giá trị{kind==='TXT'?' (không gõ thêm dấu ngoặc kép)':''}</div>
   <div style={{display:'flex',gap:8,minWidth:0}}><Input aria-label={`Giá trị ${label}`} readOnly value={value} style={{minWidth:0}}/><Button variant="outline" onClick={()=>void copy(value,kind==='TXT'?'Đã sao chép giá trị TXT, chưa có ngoặc kép.':'Đã sao chép.',label+':value')} aria-live="polite">{copyLabel(label+':value','Sao chép')}</Button></div>
   {kind==='TXT'?<div style={{marginTop:10}}>
    <div style={{fontSize:13,opacity:.85,lineHeight:1.7}}>FastPanel / BIND / một số DNS Vietnix <b>bắt buộc</b> dấu ngoặc kép. Dùng bản này, chỉ một cặp <code>" "</code> — không nhập hai lớp.</div>
    <div style={{display:'flex',gap:8,minWidth:0,marginTop:8}}><Input aria-label="Giá trị TXT có ngoặc kép" readOnly value={quoted(value)} style={{minWidth:0}}/><Button variant="outline" onClick={()=>void copy(quoted(value),'Đã sao chép giá trị TXT có ngoặc kép.',label+':quoted')} aria-live="polite">{copyLabel(label+':quoted',<>Sao chép có &quot; &quot;</>)}</Button></div>
   </div>:null}
  </div>;
 };
 return <div data-lp-domain-manager>
  <PageHeader title="Tên miền Landing Page" description="Kết nối domain chính hoặc subdomain của bạn với trang đã xuất bản."/>
  {error?<div role="alert" style={{...panel,marginBottom:16,color:'#fecaca',borderColor:'#f87171'}}>{error}</div>:null}
  {message?<div role="status" style={{...panel,marginBottom:16,color:'#d1fae5'}}>{message}</div>:null}
  {data&&!data.architecture.platformReady?<div role="status" style={{...panel,marginBottom:16,color:'#fde68a'}}>Máy chủ chưa sẵn sàng nhận domain public. {data.architecture.message} Bạn vẫn có thể lưu domain và chuẩn bị bản ghi TXT.</div>:null}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,360px),1fr))',gap:20,alignItems:'start'}}>
   <section style={panel} aria-label="Gắn tên miền">
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:20}}>1. Chọn trang và tên miền</h2>
    {loading?<p>Đang tải landing page…</p>:!data?.items.length?<p>Bạn chưa có landing page. Hãy tạo trang rồi quay lại đây.</p>:<>
     <label htmlFor="domain-page">Landing page</label>
     <select id="domain-page" value={selectedId} disabled={Boolean(busy)} onChange={e=>{setSelectedId(e.target.value);setDomain(data?.items.find(x=>x.id===e.target.value)?.customDomain||'');setError('');setMessage('');setConfirmRemove(false)}}
      style={{display:'block',width:'100%',minWidth:0,margin:'8px 0 20px',padding:12,border:'1px solid rgba(255,255,255,.2)',borderRadius:8,background:'#14382f',color:'white'}}>
      {data?.items.map(x=><option key={x.id} value={x.id}>{x.name}{x.status!=='PUBLISHED'?' — chưa xuất bản':''}</option>)}
     </select>
     <label htmlFor="custom-domain">Tên miền của bạn</label><Input id="custom-domain" placeholder="example.com hoặc www.example.com" autoComplete="off" value={domain} disabled={Boolean(busy)} onChange={e=>setDomain(e.target.value)} style={{margin:'8px 0'}}/>
     <p style={{fontSize:13,opacity:.8,lineHeight:1.7}}>Nhập đúng hostname. <b>www.example.com</b> và <b>example.com</b> là hai tên miền riêng. Mỗi trang dùng một domain chính.</p>
     <Button style={{marginTop:18}} disabled={Boolean(busy)||!domain.trim()} onClick={()=>void act('save')}>{busy==='save'?'Đang lưu…':'Lưu tên miền'}</Button>
    </>}
    {row?<div style={{marginTop:24,paddingTop:20,borderTop:'1px solid rgba(255,255,255,.15)'}}>
     <div data-domain-state style={{fontWeight:700,color:connection?.ready?'#a7f3d0':'#fde68a'}}>{status}</div>
     {row.status!=='PUBLISHED'?<p style={{marginTop:10}}>Trang chưa xuất bản. Hãy xuất bản trang để khách truy cập được domain.</p>:null}
     {row.customDomainError?<p style={{marginTop:10,fontSize:13,lineHeight:1.7}}>{row.customDomainError}</p>:null}
     {connection?.ready?<a href={connection.url} target="_blank" rel="noopener noreferrer" style={{display:'inline-block',marginTop:16,textDecoration:'underline'}}>Mở landing page ↗</a>:null}
     {row.customDomain?<div style={{marginTop:20}}>{confirmRemove?<><p>Tháo <b>{row.customDomain}</b> khỏi trang này?</p><div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}><Button variant="outline" disabled={Boolean(busy)} onClick={()=>void act('remove')}>{busy==='remove'?'Đang tháo…':'Xác nhận tháo'}</Button><Button variant="ghost" onClick={()=>setConfirmRemove(false)}>Hủy</Button></div></>:<Button variant="ghost" disabled={Boolean(busy)} onClick={()=>setConfirmRemove(true)}>Tháo tên miền</Button>}</div>:null}
    </div>:null}
   </section>
   <section style={panel} aria-label="Hướng dẫn DNS">
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:12}}>2. Thêm DNS và kiểm tra HTTPS</h2>
    {!connection?<p style={{lineHeight:1.8}}>Lưu tên miền để nhận mã TXT riêng. Nếu domain đã gắn từ phiên bản cũ, lưu lại domain đó để bắt đầu xác minh quyền sở hữu.</p>:<>
     <p style={{lineHeight:1.8,opacity:.85}}>Mở nơi quản lý DNS, thêm bản ghi bên dưới và giữ bản ghi TXT để xác minh quyền sở hữu. Thời gian cập nhật phụ thuộc nhà cung cấp DNS.</p>
     <p style={{fontSize:13,lineHeight:1.8,opacity:.9,margin:'0 0 8px'}}>Lỗi “dấu ngoặc kép”: dán <b>một</b> trong hai ô giá trị TXT — không tự gõ thêm <code>"</code>. Panel nào tự bọc ngoặc thì dùng ô không ngoặc kép; FastPanel/BIND thì dùng ô có <code>" "</code>.</p>
     {record('TXT — xác minh quyền sở hữu',connection.verification.name,connection.verification.value,'TXT')}
     {record('CNAME — trỏ subdomain',connection.hostname,connection.routing.value,'CNAME')}
     <p style={{fontSize:13,lineHeight:1.8,marginTop:14}}>Chọn A/AAAA hoặc CNAME. Không thêm CNAME cùng tên với bản ghi A/AAAA đang có. Nếu domain đã trỏ đúng IP máy chủ (ví dụ test.aibeego.com), hãy giữ bản ghi A hiện tại và <b>chỉ thêm TXT</b>.</p>
     <p style={{fontSize:13,lineHeight:1.8,marginTop:14}}>Với domain gốc không hỗ trợ CNAME, dùng A/AAAA hoặc ALIAS/ANAME theo nhà cung cấp DNS.</p>
     {connection.routing.addresses.length?<div style={{marginTop:10,overflowWrap:'anywhere'}}>IP máy chủ: <b>{connection.routing.addresses.join(', ')}</b></div>:null}
     <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',marginTop:22}}><Button disabled={Boolean(busy)} onClick={()=>void act('verify')}>{busy==='verify'?'Đang kiểm tra DNS / HTTPS…':'Kiểm tra kết nối'}</Button><span style={{fontSize:12,opacity:.75}}>DNS đúng → cấp/kiểm tra SSL → hoạt động</span></div>
    </>}
   </section>
  </div>
  <section style={{...panel,marginTop:24}} aria-label="Danh sách tên miền">
   <h2 style={{fontSize:20,fontWeight:700,marginBottom:14}}>Landing page của bạn</h2>
   {data?.items.map(x=><button key={x.id} type="button" onClick={()=>{setSelectedId(x.id);setDomain(x.customDomain||'');setConfirmRemove(false)}} disabled={Boolean(busy)}
    style={{display:'block',width:'100%',textAlign:'left',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,.1)',overflowWrap:'anywhere'}}>
    <strong>{x.name}</strong><div style={{fontSize:13,opacity:.8,marginTop:5}}>{x.customDomain||'Chưa gắn domain'} · {x.status==='PUBLISHED'?'Đã xuất bản':'Chưa xuất bản'}{x.connection?.ready?' · HTTPS sẵn sàng':''}</div>
   </button>)}
  </section>
 </div>;
}
