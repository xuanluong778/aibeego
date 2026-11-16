import type { LandingPageSpec } from './landing-page-types';
import type { TemplateContentProposal, TemplateContentSlot } from './landing-page-template-content';
import { isGenericTemplateHeading, templateHeadingKey } from './landing-page-template-copy-quality';

export type TemplateContentReviewIssue = {
  blockId: string;
  slotIds: string[];
  kind: 'pending-hide' | 'pending-show' | 'missing-content' | 'unapplied-heading' | 'generic-heading' | 'duplicate-heading';
  message: string;
};

/** Inspect the actual preview, including partial selection and user edits, not just AI output. */
export function reviewTemplateContent(
  preview: LandingPageSpec,
  slots: TemplateContentSlot[],
  proposals: TemplateContentProposal[],
): TemplateContentReviewIssue[] {
  const visible = new Map(preview.blocks.filter(b => b.enabled !== false && !b.hidden).map(b => [b.id, b]));
  const byId = new Map(proposals.map(p => [p.slotId, p]));
  const issues: TemplateContentReviewIssue[] = [];
  const pendingHide = new Set<string>();
  const pendingItems = new Set<string>();
  for (const slot of slots) {
    const p = byId.get(slot.id);
    if (slot.kind === 'visibility' && p?.action === 'show' && !visible.has(slot.blockId))
      issues.push({ blockId: slot.blockId, slotIds: [slot.id], kind: 'pending-show', message: 'Khối báo giá/ưu đãi đang ẩn. Duyệt hiển thị khối để khách hàng nhìn thấy giá đã nhập.' });
    if (slot.itemId && pendingHide.has(slot.blockId)) continue;
    if (slot.kind === 'visibility' && p?.action === 'hide' && p.status === 'missing' && visible.has(slot.blockId) &&
      !(slot.elementId && preview.meta?.elementHidden?.[slot.elementId])) {
      if (slot.itemId) pendingItems.add(`${slot.blockId}:${slot.itemId}`);
      else pendingHide.add(slot.blockId);
      issues.push({ blockId: slot.blockId, slotIds: [slot.id], kind: 'pending-hide', message: `${slot.itemId ? 'Thẻ' : 'Khối'} thiếu dữ kiện xác nhận vẫn đang hiển thị. Bổ sung nội dung hoặc duyệt ẩn.` });
    }
  }
  const missing = new Map<string, string[]>();
  const headings = new Map<string, string>();
  for (const slot of slots) {
    const p = byId.get(slot.id);
    if (!p || (slot.kind !== 'text' && slot.kind !== 'image') || pendingHide.has(slot.blockId) || pendingItems.has(`${slot.blockId}:${slot.itemId}`)) continue;
    const block = visible.get(slot.blockId);
    if (slot.blockId !== '@page' && !block) continue;
    const hidden = preview.meta?.elementHidden || {};
    const parentId = slot.itemId ? `${slot.blockId}::item:${slot.itemId}` : '';
    if ((slot.elementId && hidden[slot.elementId]) || hidden[slot.id] || (parentId && hidden[parentId])) continue;
    let value: any = slot.blockId === '@page' ? preview : block;
    if (slot.itemId) value = value?.[slot.collection || 'items']?.find((item: any) => item.id === slot.itemId);
    for (const part of slot.field.split('.')) value = value?.[part];
    const current = value == null ? '' : String(value);
    if (slot.field === 'headline' && !['Header', 'Footer'].includes(slot.blockType) && current) {
      if (isGenericTemplateHeading(current))
        issues.push({ blockId: slot.blockId, slotIds: [slot.id], kind: 'generic-heading', message: 'Tiêu đề còn là nhãn mẫu. Viết rõ giá trị hoặc câu hỏi của khách hàng cho phần này.' });
      const key = templateHeadingKey(current);
      if (headings.has(key))
        issues.push({ blockId: slot.blockId, slotIds: [slot.id], kind: 'duplicate-heading', message: 'Tiêu đề trùng với phần khác. Mỗi phần cần trả lời một câu hỏi riêng trong hành trình mua hàng.' });
      else headings.set(key, slot.id);
    }
    if (p.status === 'missing' && !['alt', 'form-label'].includes(slot.role) && (slot.kind !== 'image' || !!current)) {
      missing.set(slot.blockId, [...(missing.get(slot.blockId) || []), slot.id]);
    } else if (p.status === 'ready' && p.text && p.text !== current &&
      (slot.field === 'headline' || slot.field === 'seo.title')) {
      issues.push({ blockId: slot.blockId, slotIds: [slot.id], kind: 'unapplied-heading', message: 'Tiêu đề hiện tại chưa dùng đề xuất mới. Kiểm tra để tránh sót tiêu đề mẫu.' });
    }
  }
  for (const [blockId, slotIds] of missing) issues.push({ blockId, slotIds, kind: 'missing-content', message: `${slotIds.length} vị trí chưa có đề xuất đủ dữ kiện. Nội dung hiện tại cần được kiểm tra.` });
  return issues;
}
