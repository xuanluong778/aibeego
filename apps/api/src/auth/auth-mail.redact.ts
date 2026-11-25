/** Che địa chỉ email trong log — không ghi nội dung nhạy cảm. */
export function redactEmailForLog(email: string): string {
  const trimmed = (email || '').trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '[redacted]';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const mask = local.length <= 1 ? '*' : `${local[0]}***`;
  return `${mask}@${domain}`;
}

export function smtpFailureCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: string }).code;
    if (code) return String(code);
    const responseCode = (error as { responseCode?: number }).responseCode;
    if (typeof responseCode === 'number') return `SMTP_${responseCode}`;
  }
  return 'SEND_FAILED';
}