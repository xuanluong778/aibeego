/** Internal section labels are not customer-facing sales headlines. Shared by AI validation and preview QA. */
export function isGenericTemplateHeading(text: string): boolean {
  return /^(?:lợi ích sản phẩm|đặc điểm sản phẩm|ảnh sản phẩm|thông tin giá|giá sản phẩm và ưu đãi|tìm hiểu thêm về sản phẩm|thông tin cần xác nhận)[.!?:\s]*$/iu.test(text.normalize('NFC').trim());
}

export function templateHeadingKey(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
