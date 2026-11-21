'use client';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExportRagKbMarkdown } from '@/hooks/use-rag-kb';
export function KnowledgeMarkdownExportButton({
  kbId,
  onError,
}: {
  kbId: string;
  onError: (error: unknown) => void;
}) {
  const exportMarkdown = useExportRagKbMarkdown();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={exportMarkdown.isPending}
      onClick={() => exportMarkdown.mutate(kbId, { onError })}
    >
      <Download className="h-4 w-4" />
      {exportMarkdown.isPending ? 'Đang xuất…' : 'Xuất .md UTF-8'}
    </Button>
  );
}
