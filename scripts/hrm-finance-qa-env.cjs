/** Guard — chỉ cho phép ghi trên DB QA nhân sự / tài chính. */
const QA_DB_NAMES = ['marketingspa_hrm_finance_qa'];

function parseDatabaseName(databaseUrl) {
  if (!databaseUrl) return null;
  const match = String(databaseUrl).match(/\/([^/?]+)(?:\?|$)/);
  return match?.[1] ?? null;
}

function assertHrmFinanceQaDb(databaseUrl = process.env.DATABASE_URL) {
  const name = parseDatabaseName(databaseUrl);
  if (!name || !QA_DB_NAMES.includes(name)) {
    throw new Error(
      `Từ chối thao tác DB: cần DATABASE_URL trỏ một trong [${QA_DB_NAMES.join(', ')}], hiện: ${name ?? '(thiếu URL)'}`,
    );
  }
  return name;
}

function toHrmFinanceQaUrl(baseUrl) {
  const url = baseUrl || process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL để dựng URL QA nhân sự / tài chính');
  const qa = url.replace(/\/([^/?]+)(\?.*)?$/, `/marketingspa_hrm_finance_qa$2`);
  assertHrmFinanceQaDb(qa);
  return qa;
}

module.exports = {
  QA_DB_NAMES,
  parseDatabaseName,
  assertHrmFinanceQaDb,
  toHrmFinanceQaUrl,
};
