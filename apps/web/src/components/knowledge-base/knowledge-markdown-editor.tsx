'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function KnowledgeMarkdownEditor({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  title: string;
}) {
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const resizeEditor = useCallback(() => {
    const element = editor.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`;
  }, []);
  const attachEditor = useCallback((element: HTMLTextAreaElement | null) => {
    editor.current = element;
    resizeEditor();
  }, [resizeEditor]);
  useLayoutEffect(resizeEditor, [value, resizeEditor]);
  useLayoutEffect(() => {
    window.addEventListener('resize', resizeEditor);
    return () => window.removeEventListener('resize', resizeEditor);
  }, [resizeEditor]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(title || 'tri-thuc').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 150)}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Tabs defaultValue="preview" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList aria-label="Chế độ tài liệu">
          <TabsTrigger value="preview">Xem trước</TabsTrigger>
          <TabsTrigger value="edit">Sửa Markdown</TabsTrigger>
        </TabsList>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="h-4 w-4" />
          Tải .md
        </Button>
      </div>
      <TabsContent value="preview">
        <article
          aria-label="Nội dung tài liệu"
          className="min-h-[300px] rounded-lg border bg-background p-5 text-base leading-7 text-foreground sm:p-7 [overflow-wrap:anywhere] [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-snug [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:mt-5 [&_h4]:font-semibold [&_h5]:mt-4 [&_h5]:font-semibold [&_h6]:mt-4 [&_h6]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_a]:text-emerald-400 [&_a]:underline [&_hr]:my-8 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_code]:text-sm [&_th]:border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:px-3 [&_td]:py-2"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            components={{
              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
              img: () => null,
              table: ({ node, ...props }) => (
                <div className="my-4 overflow-x-auto">
                  <table {...props} className="w-full border-collapse text-sm" />
                </div>
              ),
            }}
          >
            {value}
          </ReactMarkdown>
        </article>
      </TabsContent>
      <TabsContent value="edit">
        <label htmlFor="shared-doc-content" className="sr-only">
          Nội dung Markdown
        </label>
        <Textarea
          ref={attachEditor}
          id="shared-doc-content"
          className="min-h-[300px] resize-none overflow-hidden font-mono text-sm leading-7"
          maxLength={3000000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Dùng # cho tiêu đề, - cho danh sách. Chuyển sang Xem trước để đọc bản trình bày.
        </p>
      </TabsContent>
    </Tabs>
  );
}
