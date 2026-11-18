import type { TemplateContentBrief, TemplateContentProposal, TemplateContentSlot } from './landing-page-template-content';
import { completeCopy } from './landing-page-template-editorial';

export function parseTemplateVnd(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim().replace(/\u00a0/g, ' ').replace(/\s*(?:₫|đ|vnđ|vnd|đồng)$/i, '').trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+|\d{1,3}(?: \d{3})+)$/.test(text))
    throw new Error('Nhập giá bằng số tiền VNĐ, ví dụ 10000000 hoặc 10.000.000.');
  const amount = Number(text.replace(/[., ]/g, ''));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999_999_999_999_999)
    throw new Error('Giá phải lớn hơn 0 và không vượt quá 999.999.999.999.999 VNĐ.');
  return amount;
}
export const formatTemplateVnd = (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`;
export function templatePriceOffer(brief: Pick<TemplateContentBrief, 'originalPrice' | 'salePrice'>) {
  const original = parseTemplateVnd(brief.originalPrice);
  const sale = parseTemplateVnd(brief.salePrice);
  if (sale !== undefined && original === undefined) throw new Error('Nhập giá gốc trước khi nhập giá khuyến mãi.');
  if (original === undefined) return undefined;
  if (sale !== undefined && sale >= original) throw new Error('Giá khuyến mãi phải nhỏ hơn giá gốc.');
  const percent = sale === undefined ? 0 : Number((BigInt(original) - BigInt(sale)) * 10000n / BigInt(original)) / 100;
  return { original, current: sale ?? original, sale,
    percent, percentLabel: percent ? `${percent.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%` : '',
    originalLabel: formatTemplateVnd(original), priceLabel: formatTemplateVnd(sale ?? original) };
}

/** Prices and discounts are calculated by code from explicit inputs, never authored by the model. */
export function enforceTemplatePricingOffer(
  slots: TemplateContentSlot[], brief: TemplateContentBrief, input: TemplateContentProposal[],
): TemplateContentProposal[] {
  const offer = templatePriceOffer(brief);
  if (!offer) return input;
  const course = /đào tạo|khóa học|khoá học|course|training/i.test(`${brief.productName} ${brief.description}`);
  // One confirmed price is not evidence for every sample launch/countdown in a template.
  const offerBlock = slots.find(s => s.blockType === 'Countdown' && s.field === 'headline' && !/ra mắt|launch|coming soon/i.test(s.current))?.blockId;
  const prices = slots.filter(s => s.blockType === 'Pricing' && s.field === 'price');
  const target = prices.find(s => s.id === brief.pricingTargetId) || (!brief.pricingTargetId ? prices[0] : undefined);
  const headline = offer.sale !== undefined
    ? `${course ? 'Học phí ưu đãi' : 'Ưu đãi đăng ký'}${offer.percentLabel ? ` — giảm ${offer.percentLabel}` : ''}`
    : course ? 'Học phí và thông tin đăng ký' : 'Chi phí và thông tin đăng ký';
  const futureSchedule = !!brief.schedule && Number.isFinite(Date.parse(brief.schedule)) && Date.parse(brief.schedule) > Date.now() &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(brief.schedule);
  const facts = [...new Set([
    ...(brief.sourceContext?.facts.filter(f => f.kind === 'method' && /th[ựụ]c hành|đo lường|theo dõi|1:1|hỗ trợ/i.test(f.title)).map(f => f.title) || []),
    ...brief.description.split(/[\n;]+/),
  ].map(s => completeCopy(s, 120)).filter(Boolean))];
  const overrides = new Map<string, TemplateContentProposal>();
  const write = (slot: TemplateContentSlot, text: string) => {
    if (slot.locked) return;
    if (['price', 'originalPrice'].includes(slot.field) && slots.some(s => s.blockId === slot.blockId && s.itemId === slot.itemId && ['price', 'originalPrice'].includes(s.field) && s.locked)) {
      overrides.set(slot.id, { slotId: slot.id, status: 'missing', source: 'fallback', priceControlled: true, reason: 'Một trường trong nhóm giá đang khóa. Mở khóa cả giá gốc và giá bán trước khi cập nhật.' });
      return;
    }
    const fitted = completeCopy(text, slot.maxLength);
    if (text && !fitted) return;
    overrides.set(slot.id, { slotId: slot.id, text: fitted, status: 'ready', source: 'fallback',
      priceControlled: true,
      ...(['price', 'originalPrice'].includes(slot.field) ? { priceGroupId: `${slot.blockId}:${slot.itemId || ''}:price` } : {}),
      ...(text === '' ? { action: 'clear' as const } : {}) });
  };
  for (const slot of slots) {
    if (slot.locked) continue;
    if (slot.blockType === 'Pricing' && target?.blockId === slot.blockId) {
      if (slot.kind === 'visibility') {
        if (!slot.itemId || slot.itemId === target.itemId) overrides.set(slot.id, { slotId: slot.id, status: !slot.itemId && slot.blockHidden ? 'ready' : 'unchanged', ...(!slot.itemId && slot.blockHidden ? { action: 'show' as const } : {}), source: 'fallback', priceControlled: true });
        else overrides.set(slot.id, { slotId: slot.id, status: 'missing', action: 'hide', source: 'fallback', priceControlled: true, reason: 'Giá đã nhập chỉ áp dụng cho box được chọn. Duyệt ẩn box mẫu khác nếu không dùng.' });
      } else if (!slot.itemId) {
        if (slot.field === 'headline') write(slot, course ? 'Học phí và lựa chọn đăng ký khóa học' : completeCopy(`Chi phí để bắt đầu với ${brief.productName}`, slot.maxLength, 'Chi phí và thông tin đặt mua'));
        if (slot.field === 'subheadline') write(slot, offer.sale !== undefined ? `Tiết kiệm ${formatTemplateVnd(offer.original - offer.current)} khi đăng ký với mức giá khuyến mãi.` : 'Mức giá sản phẩm đã được xác nhận.');
        if (slot.field === 'eyebrow') write(slot, 'THÔNG TIN GIÁ');
      } else if (slot.itemId === target.itemId) {
        if (slot.field === 'price') write(slot, offer.priceLabel);
        if (slot.field === 'originalPrice') write(slot, offer.sale === undefined ? '' : offer.originalLabel);
        if (slot.field === 'name') write(slot, completeCopy(brief.productName, slot.maxLength, 'Sản phẩm đăng ký'));
        if (slot.field === 'period') write(slot, '');
        if (slot.field.startsWith('features.')) write(slot, facts[Number(slot.field.split('.')[1])] || '');
      }
    }
    if (slot.blockType === 'Countdown') {
      if (slot.blockId !== offerBlock) {
        if (slot.kind === 'visibility' && !slot.itemId) overrides.set(slot.id, { slotId: slot.id, status: 'missing', action: 'hide', source: 'fallback', priceControlled: true, reason: 'Khối ra mắt hoặc đồng hồ mẫu không có sự kiện riêng được xác nhận. Ẩn để tránh lẫn thương hiệu và ưu đãi.' });
        continue;
      }
      if (slot.kind === 'visibility') overrides.set(slot.id, { slotId: slot.id, status: slot.blockHidden ? 'ready' : 'unchanged', ...(slot.blockHidden ? { action: 'show' as const } : {}), source: 'fallback', priceControlled: true });
      if (slot.field === 'headline') write(slot, headline);
      if (slot.field === 'subheadline') write(slot, brief.productName);
      if (slot.field === 'kicker') write(slot, offer.sale !== undefined ? 'ƯU ĐÃI ĐĂNG KÝ' : 'ĐĂNG KÝ SẢN PHẨM');
      if (slot.field === 'price') write(slot, offer.priceLabel);
      if (slot.field === 'originalPrice') write(slot, offer.sale === undefined ? '' : offer.originalLabel);
      if (slot.field === 'clockMode') {
        const existingEnd = slots.find(s => s.blockId === slot.blockId && s.field === 'endsAt')?.current;
        if (futureSchedule) write(slot, 'timer');
        else if (slot.current === 'offer' || (existingEnd && Number.isFinite(Date.parse(existingEnd))))
          overrides.set(slot.id, { slotId: slot.id, status: 'unchanged', source: 'fallback', priceControlled: true,
            reason: 'Giữ nguyên chế độ đồng hồ đã cấu hình. Để trống thời gian mới không có nghĩa là tắt đồng hồ.' });
        else write(slot, 'offer');
      }
      if (slot.field === 'endsAt') {
        if (futureSchedule) write(slot, brief.schedule!);
        else overrides.set(slot.id, { slotId: slot.id, status: 'unchanged', source: 'fallback', priceControlled: true, reason: 'Giữ nguyên mốc thời gian đã lưu; AI không tự đặt hoặc gia hạn đồng hồ.' });
      }
    }
    if (slot.blockType === 'CTA' && slot.field === 'headline')
      write(slot, course ? ((slot.occurrence || 0) > 0 ? 'Chọn lộ trình học phù hợp với mục tiêu của bạn' : 'Trao đổi mục tiêu trước khi đăng ký khóa học') : headline);
    if (slot.blockType === 'CTA' && ['body', 'subheadline'].includes(slot.field))
      write(slot, `${brief.productName}. ${offer.sale !== undefined ? `Từ ${offer.originalLabel} còn ${offer.priceLabel}.` : `Giá ${offer.priceLabel}.`}`);
    if (slot.role === 'cta' && ['form', 'submit'].includes(slot.actionType || '') &&
      (slot.blockType !== 'Pricing' || (slot.blockId === target?.blockId && slot.itemId === target.itemId)))
      write(slot, brief.goal === 'consult'
        ? slot.actionType === 'submit' ? 'Gửi yêu cầu tư vấn ngay'
          : course ? slot.blockType === 'Pricing' ? 'Tư vấn trước khi đăng ký'
            : slot.blockType === 'Countdown' ? 'Tư vấn học phí và lịch học'
            : slot.blockType === 'Hero' ? 'Nhận tư vấn lộ trình học'
            : 'Nhận tư vấn khóa học'
          : 'Nhận tư vấn ngay'
        : offer.sale !== undefined && offer.percentLabel ? `Đăng ký ngay — giảm ${offer.percentLabel}` : 'Đăng ký ngay');
  }
  return input.map(p => overrides.get(p.slotId) || p);
}
