'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KnowledgeSourcePanel } from './knowledge-source-panel';
import { KnowledgeMarkdownExportButton } from './knowledge-markdown-export-button';
import { KnowledgeMarkdownEditor } from './knowledge-markdown-editor';
import { FileText, Upload, Plus, Trash2, Pencil, Download, Info, Search, RefreshCw, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LoadingState, ErrorState } from '@/components/shared/page-state';
import {
  useRagKnowledgeBases, useCreateRagKb, useUpdateRagKb, useDeleteRagKb,
  useImportRagKbFile, useImportRagKbText, useImportRagKbUrl,
  useDeleteRagKbDocument, useDownloadRagKbDocument, useRagKbDocument,
  useUpdateRagDocument, useRagKbSearch, useSharedKnowledgeBots, useReindexRagKb,
  useConnectSharedKnowledge, useConsolidateChatbotKnowledge, useKnowledgeZaloOas, useConnectKnowledgeZaloOa,
  type RagKnowledgeBase, type RagKbDocument,
} from '@/hooks/use-rag-kb';

export function KnowledgeBasePage() {
  const params = useSearchParams();
  const requestedBot = params.get('botId');
  const list = useRagKnowledgeBases();
  const bots = useSharedKnowledgeBots();
  const create = useCreateRagKb();
  const update = useUpdateRagKb();
  const remove = useDeleteRagKb();
  const upload = useImportRagKbFile();
  const textImport = useImportRagKbText();
  const urlImport = useImportRagKbUrl();
  const deleteDoc = useDeleteRagKbDocument();
  const download = useDownloadRagKbDocument();
  const editDoc = useUpdateRagDocument();
  const search = useRagKbSearch();
  const reindex = useReindexRagKb();
  const connect = useConnectSharedKnowledge();
  const consolidate = useConsolidateChatbotKnowledge();
  const zaloOas = useKnowledgeZaloOas();
  const connectOa = useConnectKnowledgeZaloOa();
  const [view, setView] = useState<'documents' | 'chatbots' | 'guide' | 'search'>(requestedBot ? 'chatbots' : 'documents');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKb, setEditingKb] = useState<RagKnowledgeBase | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importKb, setImportKb] = useState<RagKnowledgeBase | null>(null);
  const [importMode, setImportMode] = useState<'file' | 'text' | 'url'>('file');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [document, setDocument] = useState<{ kb: RagKnowledgeBase; doc: RagKbDocument } | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const detail = useRagKbDocument(document?.kb.id || null, document?.doc.id || null);
  const busyImport = upload.isPending || textImport.isPending || urlImport.isPending;
  const bases = list.data || [];
  const fail = (e: unknown) => { setNotice(null); setError(e instanceof Error ? e.message : 'Chưa hoàn tất thao tác. Vui lòng thử lại.'); };
  const success = (message: string) => { setError(null); setNotice(message); };

  useEffect(() => { if (requestedBot) setView('chatbots'); }, [requestedBot]);
  useEffect(() => {
    if (detail.data) { setDocTitle(detail.data.title); setDocContent(detail.data.content); }
  }, [detail.data]);

  const addTo = (kb: RagKnowledgeBase) => {
    setError(null); setNotice(null); setImportKb(kb); setImportMode('file'); setTitle(''); setContent(''); setUrl('');
  };
  const finishImport = () => { setImportKb(null); success('Đã thêm tài liệu. Mọi kênh của chatbot dùng kho này sẽ đọc nội dung mới.'); };

  if (list.isPending) return <LoadingState message="Đang tải kho tri thức…" />;
  if (list.isError) return <ErrorState onRetry={list.refetch} />;

  return (
    <div className="space-y-5" data-shared-knowledge>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Base</h2>
          <span title="Kho tri thức dùng chung cho AI và các chatbot" aria-label="Thông tin kho tri thức"><Info className="h-4 w-4 text-muted-foreground" /></span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Một kho tri thức dùng chung cho Content AI, Chatbot và các kênh đã kết nối.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Quản lý tri thức">
        {([
          ['guide', 'Hướng dẫn RAG'],
          ['documents', `Danh sách KB (${bases.length})`],
          ['search', 'Test Search'],
        ] as const).map(([value, label]) => (
          <Button key={value} variant="outline" aria-pressed={view === value} className={`h-10 rounded-xl px-3.5 font-semibold ${view === value ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-400' : 'text-muted-foreground'}`} onClick={() => setView(value)}>
            {value === 'search' ? <Search className="h-4 w-4" /> : null}{label}
          </Button>
        ))}
        <Button className="h-10 rounded-xl bg-emerald-500 px-4 font-semibold text-black shadow-[0_0_16px_rgba(16,185,129,0.2)] hover:bg-emerald-400" onClick={() => { setEditingKb('new'); setName(''); setDescription(''); setError(null); }}>
          <Plus className="h-4 w-4" />Tạo KB
        </Button>
        <Button variant="outline" aria-pressed={view === 'chatbots'} className={`h-10 rounded-xl px-3.5 font-semibold ${view === 'chatbots' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 hover:text-emerald-400' : 'text-muted-foreground'}`} onClick={() => setView('chatbots')}>Dùng cho chatbot</Button>
      </div>
      {notice ? <p role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {view === 'guide' ? (
        <section className="space-y-4 rounded-2xl border border-emerald-500/30 p-5 sm:p-6" data-knowledge-guide>
          <h3 className="text-lg font-semibold text-foreground">Hướng dẫn dùng kho tri thức chung</h3>
          <p className="text-sm text-muted-foreground">RAG giúp AI tìm thông tin trong tài liệu của bạn trước khi trả lời khách hàng hoặc tạo nội dung.</p>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
            <li><strong className="text-foreground">Tạo KB</strong> cho doanh nghiệp hoặc chủ đề bạn muốn quản lý.</li>
            <li>Nhấn <strong className="text-foreground">Import</strong> để tải file TXT/MD, nhập nội dung hoặc thêm đường dẫn website.</li>
            <li>Dùng <strong className="text-foreground">Test Search</strong> để kiểm tra AI có tìm thấy thông tin cần thiết trong kho hay chưa.</li>
            <li>Vào <strong className="text-foreground">Dùng cho chatbot</strong>, chọn kho cho bot. Fanpage, Landing Page và website đã gắn với bot sẽ dùng cùng nguồn. Với Zalo OA, chọn bot cho OA rồi bật trả lời tự động.</li>
            <li>Sửa tài liệu tại một nơi để cập nhật nguồn trả lời cho mọi bot dùng kho đó. Nút <strong className="text-foreground">Reindex</strong> cập nhật lại thống kê và trạng thái xử lý tài liệu.</li>
          </ol>
          <p className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">Đã có nguồn tại Chatbot CSKH? Dùng nút “Đưa nguồn hiện có về kho tri thức” trong mục Dùng cho chatbot để giữ nguyên nguồn cũ.</p>
        </section>
      ) : view === 'search' ? (
        <section className="space-y-4 rounded-2xl border border-emerald-500/30 p-5 sm:p-6" data-knowledge-search>
          <div><h3 className="text-lg font-semibold text-foreground">Test Search</h3><p className="mt-1 text-sm text-muted-foreground">Nhập câu hỏi để tìm nội dung phù hợp trong các kho tri thức của bạn.</p></div>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); if (query.trim()) search.mutate({ query: query.trim() }, { onError: fail }); }}>
            <Input aria-label="Tìm nội dung trong kho" placeholder="Ví dụ: Chính sách bảo hành như thế nào?" value={query} onChange={event => { setQuery(event.target.value); search.reset(); }} />
            <Button type="submit" className="shrink-0" disabled={!query.trim() || search.isPending}><Search className="h-4 w-4" />{search.isPending ? 'Đang tìm…' : 'Tìm kiếm'}</Button>
          </form>
          {search.data ? <div className="space-y-3" aria-live="polite">
            <p className="text-sm text-muted-foreground">{search.data.results.length} kết quả cho “{search.data.query}”</p>
            {search.data.results.length ? search.data.results.map(hit => <article key={hit.chunkId || hit.documentId} className="rounded-xl border bg-muted/20 p-4"><p className="font-semibold">{hit.title}</p><p className="mt-1 text-xs text-emerald-400">{hit.knowledgeBaseName}</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{hit.excerpt}</p>{hit.url && /^https?:\/\//i.test(hit.url) ? <a className="mt-2 block break-all text-xs underline" href={hit.url} target="_blank" rel="noopener noreferrer">{hit.url}</a> : null}{hit.updatedAt ? <p className="mt-1 text-xs text-muted-foreground">Cập nhật: {new Date(hit.updatedAt).toLocaleString('vi-VN')}</p> : null}</article>) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Chưa tìm thấy nội dung phù hợp. Thử từ khóa khác hoặc Import thêm tài liệu.</p>}
          </div> : null}
        </section>
      ) : view === 'chatbots' ? (
        <div className="space-y-3" data-shared-knowledge-bots>
          <p className="text-sm text-muted-foreground">Bạn có thể chọn cùng một kho cho nhiều chatbot. Khi gắn lần đầu, nguồn cũ của bot được giữ nguyên và chuyển vào kho bạn chọn.</p>
          {bots.isPending ? <LoadingState message="Đang tải chatbot…" /> : bots.isError ? <ErrorState onRetry={bots.refetch} /> : null}
          {!bots.isPending && !bots.isError && !bots.data?.length ? (
            <div className="rounded-lg border border-dashed p-6">
              <p className="mb-3 text-sm">Bạn chưa có chatbot. Tạo bot rồi chọn kho để dùng chung cho các kênh.</p>
              <Button asChild><Link href="/chatbot-cskh?action=create">Tạo chatbot</Link></Button>
            </div>
          ) : null}
          <section className="space-y-3 rounded-lg border p-4" data-knowledge-zalo-oas>
            <h3 className="font-semibold">Zalo OA dùng chatbot nào?</h3>
            <p className="text-sm text-muted-foreground">Chọn bot cho OA, rồi bật “Tự trả lời Zalo OA bằng kho này” tại bot bên dưới. Bỏ gắn sẽ dừng trả lời tự động bằng kho chung.</p>
            {zaloOas.isPending ? <LoadingState message="Đang tải Zalo OA…" /> : zaloOas.isError ? <ErrorState onRetry={zaloOas.refetch} /> : null}
            {zaloOas.data?.map(oa => <div key={oa.id} className="grid gap-2 sm:grid-cols-2 sm:items-center">
              <Label htmlFor={`knowledge-oa-${oa.id}`}>{oa.name}{oa.isPaused || oa.status !== 'ACTIVE' ? ' · Chưa sẵn sàng' : ''}</Label>
              <select id={`knowledge-oa-${oa.id}`} aria-label={`Chatbot cho OA ${oa.name}`} className="min-h-10 w-full rounded-md border bg-background px-3 text-sm" value={oa.botId || ''} disabled={connectOa.isPending} onChange={event => connectOa.mutate({ connectionId: oa.id, botId: event.target.value || null }, { onSuccess: () => success('Đã cập nhật chatbot cho Zalo OA.'), onError: fail })}>
                <option value="">Chưa gắn chatbot</option>
                {bots.data?.map(bot => <option key={bot.id} value={bot.id}>{bot.botName}</option>)}
              </select>
            </div>)}
            <Button size="sm" variant="outline" asChild><Link href="/settings?tab=connections" target="_blank" rel="noopener noreferrer">{zaloOas.data?.length ? 'Quản lý kết nối Zalo OA' : 'Kết nối Zalo OA'}</Link></Button>
          </section>
          {bots.data?.map(bot => (
            <section key={bot.id} data-knowledge-bot={bot.id} className={`space-y-3 rounded-lg border p-4 ${requestedBot === bot.id ? 'ring-2 ring-emerald-500' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{bot.botName}</h3>
                <span className="text-xs text-muted-foreground">{bot.status === 'ACTIVE' ? 'Đang hoạt động' : bot.status === 'PAUSED' ? 'Tạm dừng' : 'Bản nháp'}</span>
              </div>
              <Label htmlFor={`knowledge-for-${bot.id}`}>Kho tri thức của chatbot</Label>
              <select id={`knowledge-for-${bot.id}`} className="min-h-10 w-full rounded-md border bg-background px-3 text-sm" value={bot.knowledgeBaseId || ''} disabled={connect.isPending || consolidate.isPending} onChange={event => {
                if (!event.target.value) return;
                connect.mutate({ botId: bot.id, knowledgeBaseId: event.target.value }, {
                  onSuccess: result => success(result.importedSourceCount ? `Đã chọn kho và giữ lại ${result.importedSourceCount} nguồn hiện có của ${bot.botName}.` : `Đã cập nhật kho tri thức cho ${bot.botName}.`), onError: fail,
                });
              }}>
                <option value="" disabled>{bot.existingSourceCount ? `Đang dùng ${bot.existingSourceCount} nguồn hiện có — chọn kho để gộp` : 'Chọn kho tri thức'}</option>
                {bases.map(kb => <option key={kb.id} value={kb.id}>{kb.name} · {kb.documents.length} tài liệu</option>)}
              </select>
              {!bot.knowledgeBaseId && bot.existingSourceCount > 0 ? (
                <Button variant="outline" disabled={consolidate.isPending} onClick={() => consolidate.mutate(bot.id, { onSuccess: result => success(`Đã đưa ${result.importedSourceCount} nguồn về kho chung, giữ nguyên nội dung và liên kết của Landing Page.`), onError: fail })}>Đưa nguồn hiện có về kho tri thức</Button>
              ) : null}
              {bot.knowledgeBaseId ? (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>Fanpage · Landing Page · Website · Zalo OA</span>
                  <Button size="sm" variant="outline" onClick={() => setView('documents')}>Quản lý tài liệu</Button>
                </div>
              ) : null}
              {bot.zaloConnected && bot.knowledgeBaseId ? (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={bot.zaloAutoReply} disabled={connect.isPending} onChange={event => connect.mutate({ botId: bot.id, knowledgeBaseId: bot.knowledgeBaseId!, zaloAutoReply: event.target.checked }, { onSuccess: () => success('Đã cập nhật trả lời tự động Zalo OA.'), onError: fail })} />
                  <span>Tự trả lời Zalo OA bằng kho này<span className="mt-1 block text-xs text-muted-foreground">Dùng OA đã gắn với chatbot đang hoạt động. Khi nhân viên tiếp quản, bot dừng trả lời.</span></span>
                </label>
              ) : null}
              {!bot.zaloConnected ? <p className="text-xs text-muted-foreground">Zalo OA sẽ dùng kho này sau khi bạn kết nối OA, gắn với chatbot và bật trả lời tự động tại đây.</p> : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-4" data-shared-knowledge-documents>
          {!bases.length ? <div className="rounded-lg border border-dashed p-8 text-center"><FileText className="mx-auto mb-3 h-8 w-8" /><p>Chưa có kho tri thức. Tạo kho để thêm Website, Fanpage hoặc tài liệu.</p></div> : null}
          {bases.map(kb => (
            <article key={kb.id} className="space-y-4 rounded-2xl border border-emerald-500/40 p-4 sm:p-5" data-knowledge-base={kb.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-lg font-bold text-foreground">{kb.name}</h3>
                    {kb.isDefault ? <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-300">MẶC ĐỊNH</span> : null}
                  </div>
                  {kb.description ? <p className="mt-1 text-sm text-muted-foreground">{kb.description}</p> : null}
                  {kb.linkedBots?.length ? <p className="mt-1 text-xs text-muted-foreground">Dùng cho: {kb.linkedBots.map(bot => bot.name).join(', ')}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" className="rounded-xl bg-emerald-500 font-semibold text-black hover:bg-emerald-400" onClick={() => addTo(kb)}><Upload className="h-4 w-4" />Import</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" aria-label={`Reindex kho ${kb.name}`} disabled={reindex.isPending || !kb.documents.length} onClick={() => reindex.mutate(kb.id, { onSuccess: () => success(`Đã cập nhật chỉ mục kho “${kb.name}”.`), onError: fail })}><RefreshCw className={`h-4 w-4 ${reindex.isPending && reindex.variables === kb.id ? 'animate-spin' : ''}`} />Reindex</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" aria-label={`Sửa kho ${kb.name}`} onClick={() => { setEditingKb(kb); setName(kb.name); setDescription(kb.description || ''); setError(null); }}><Pencil className="h-3.5 w-3.5" />Sửa</Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label={`Xóa kho ${kb.name}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Xóa kho “${kb.name}” và tài liệu trong kho?`)) remove.mutate(kb.id, { onSuccess: () => success('Đã xóa kho tri thức.'), onError: fail }); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-knowledge-stats>
                {[
                  ['Tài liệu', kb.stats.documentCount],
                  ['Chunks', kb.stats.chunkCount],
                  ['Tìm kiếm', 'Văn bản · PostgreSQL'],
                  ['Tokens', kb.stats.tokenLabel || kb.stats.tokenCount],
                ].map(([label, value]) => <div key={label} className="rounded-xl border bg-muted/20 px-3 py-3 text-center"><p className="text-lg font-bold tabular-nums text-foreground">{value}</p><p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p></div>)}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <KnowledgeMarkdownExportButton kbId={kb.id} onError={fail} />
                <span className="text-xs text-muted-foreground">Tìm đoạn bằng chỉ mục văn bản; chưa sử dụng vector embedding.</span>
              </div>
              <KnowledgeSourcePanel kbId={kb.id} />
              <div className="space-y-2 border-t pt-4">
                {!kb.documents.length ? <div className="flex min-h-28 flex-col items-center justify-center gap-3 py-4 text-center text-muted-foreground"><Archive className="h-8 w-8 opacity-50" /><p className="text-sm">Chưa có tài liệu nào. Nhấn <button type="button" className="font-semibold text-foreground underline-offset-4 hover:underline" onClick={() => addTo(kb)}>Import</button> để thêm.</p></div> : null}
                {kb.documents.map(doc => (
                  <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-emerald-500/40 py-2 pl-3" data-knowledge-document={doc.id}>
                    <div className="min-w-0 flex-1"><p className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4 shrink-0" />{doc.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.preview}</p><p className="mt-1 text-xs">{['ready', 'active'].includes(doc.status) ? 'Sẵn sàng sử dụng' : 'Cần kiểm tra nội dung'}</p></div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setDocument({ kb, doc }); setDocTitle(doc.title); setDocContent(''); setError(null); }}>Xem / sửa</Button>
                      <Button variant="ghost" size="sm" aria-label={`Tải tài liệu ${doc.title}`} disabled={download.isPending} onClick={() => download.mutate({ kbId: kb.id, docId: doc.id }, { onError: fail })}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" aria-label={`Xóa tài liệu ${doc.title}`} onClick={() => { if (window.confirm(`Xóa “${doc.title}”? Các chatbot dùng kho này sẽ ngừng dùng tài liệu.`)) deleteDoc.mutate({ kbId: kb.id, docId: doc.id }, { onSuccess: () => success('Đã xóa tài liệu khỏi kho và các chatbot dùng chung.'), onError: fail }); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!editingKb} onOpenChange={open => { if (!open) setEditingKb(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingKb === 'new' ? 'Tạo kho tri thức' : 'Sửa kho tri thức'}</DialogTitle></DialogHeader>
          <Label htmlFor="shared-kb-name">Tên kho</Label><Input id="shared-kb-name" maxLength={160} autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Sản phẩm và chính sách công ty" />
          <Label htmlFor="shared-kb-description">Mô tả (tuỳ chọn)</Label><Textarea id="shared-kb-description" maxLength={1000} value={description} onChange={event => setDescription(event.target.value)} />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button variant="outline" onClick={() => setEditingKb(null)}>Hủy</Button><Button disabled={!name.trim() || create.isPending || update.isPending} onClick={() => {
            if (editingKb === 'new') create.mutate({ name: name.trim(), description: description.trim() }, { onSuccess: () => { setEditingKb(null); setView('documents'); success('Đã tạo kho. Bạn có thể thêm Website, Fanpage hoặc tài liệu.'); }, onError: fail });
            else if (editingKb) update.mutate({ id: editingKb.id, name: name.trim(), description: description.trim() }, { onSuccess: () => { setEditingKb(null); success('Đã cập nhật kho tri thức.'); }, onError: fail });
          }}>Lưu kho</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importKb} onOpenChange={open => { if (!open && !busyImport) setImportKb(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Thêm tài liệu — {importKb?.name}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">{(['file', 'text', 'url'] as const).map(mode => <Button key={mode} size="sm" variant={importMode === mode ? 'default' : 'outline'} onClick={() => { setImportMode(mode); setError(null); }}>{mode === 'file' ? 'Tải TXT / MD' : mode === 'text' ? 'Nhập nội dung' : 'Nhập đường dẫn'}</Button>)}</div>
          {importMode === 'file' ? <div className="space-y-3 rounded-lg border border-dashed p-5">
            <Label htmlFor="shared-kb-file">Chọn file văn bản hoặc Markdown</Label>
            <Input id="shared-kb-file" type="file" accept=".txt,.md,.markdown,text/plain,text/markdown,text/x-markdown" disabled={busyImport} onChange={event => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (!file || !importKb) return;
              if (!/\.(txt|md|markdown)$/i.test(file.name)) { fail(new Error('Chỉ chọn file .txt hoặc .md.')); return; }
              if (file.size > 2 * 1024 * 1024) { fail(new Error('File tối đa 2MB.')); return; }
              upload.mutate({ id: importKb.id, file }, { onSuccess: finishImport, onError: fail });
            }} />
            <p className="text-xs text-muted-foreground">UTF-8 · tối đa 2MB và 200.000 ký tự mỗi tài liệu. Nội dung được giữ đầy đủ, không tự cắt bớt.</p>
            {busyImport ? <p role="status" className="text-sm">Đang đọc và lưu tài liệu…</p> : null}
          </div> : importMode === 'text' ? <div className="space-y-3">
            <Label htmlFor="shared-text-title">Tiêu đề</Label><Input id="shared-text-title" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} />
            <Label htmlFor="shared-text-content">Nội dung</Label><Textarea id="shared-text-content" rows={8} maxLength={200000} value={content} onChange={event => setContent(event.target.value)} placeholder="Thông tin sản phẩm, bảng giá, chính sách, câu hỏi thường gặp…" />
            <Button disabled={!title.trim() || !content.trim() || busyImport} onClick={() => importKb && textImport.mutate({ id: importKb.id, title: title.trim(), content: content.trim() }, { onSuccess: finishImport, onError: fail })}>Lưu nội dung</Button>
          </div> : <div className="space-y-3">
            <Label htmlFor="shared-url">Đường dẫn website</Label><Input id="shared-url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" />
            <Label htmlFor="shared-url-title">Tiêu đề (tuỳ chọn)</Label><Input id="shared-url-title" maxLength={200} value={title} onChange={event => setTitle(event.target.value)} />
            <Button disabled={!url.trim() || busyImport} onClick={() => importKb && urlImport.mutate({ id: importKb.id, url: url.trim(), title: title.trim() || undefined }, { onSuccess: finishImport, onError: fail })}>Đọc nội dung từ đường dẫn</Button>
          </div>}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!document} onOpenChange={open => { if (!open) setDocument(null); }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Xem và sửa tài liệu</DialogTitle></DialogHeader>
          {detail.isPending ? <LoadingState message="Đang đọc tài liệu…" /> : detail.isError ? <ErrorState onRetry={detail.refetch} /> : <>
            <Label htmlFor="shared-doc-title">Tiêu đề tài liệu</Label><Input id="shared-doc-title" maxLength={200} value={docTitle} onChange={event => setDocTitle(event.target.value)} />
            <KnowledgeMarkdownEditor key={document?.doc.id} value={docContent} onChange={setDocContent} title={docTitle} />
            <p className="text-xs text-muted-foreground">Lưu thay đổi sẽ cập nhật nguồn trả lời cho mọi chatbot dùng kho này.</p>
          </>}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button variant="outline" onClick={() => setDocument(null)}>Đóng</Button><Button disabled={!document || !detail.data || !docTitle.trim() || !docContent.trim() || editDoc.isPending} onClick={() => document && editDoc.mutate({ kbId: document.kb.id, docId: document.doc.id, title: docTitle.trim(), content: docContent }, { onSuccess: () => { setDocument(null); success('Đã cập nhật tài liệu cho các chatbot dùng chung.'); }, onError: fail })}>Lưu thay đổi</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KnowledgeBasePage;
