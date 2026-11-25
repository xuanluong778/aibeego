/** Guard — chỉ cho phép ghi/cleanup trên DB QA idempotency sales. */
const SALES_IDEM_QA_DB_NAMES = ['marketingspa_sales_idem_qa'];

function parseDatabaseName(databaseUrl) {
  if (!databaseUrl) return null;
  const m = String(databaseUrl).match(/\/([^/?]+)(?:\?|$)/);
  return m?.[1] ?? null;
}

function assertSalesIdemQaDb(databaseUrl = process.env.DATABASE_URL) {
  const name = parseDatabaseName(databaseUrl);
  if (!name || !SALES_IDEM_QA_DB_NAMES.includes(name)) {
    throw new Error(
      `Từ chối thao tác DB: cần DATABASE_URL trỏ một trong [${SALES_IDEM_QA_DB_NAMES.join(', ')}], hiện: ${name ?? '(thiếu URL)'}`,
    );
  }
  return name;
}

function buildSalesIdemQaDatabaseUrl(baseUrl) {
  const url = baseUrl || process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL gốc để dựng URL QA');
  const qa = url.replace(/\/([^/?]+)(\?.*)?$/, `/marketingspa_sales_idem_qa$2`);
  assertSalesIdemQaDb(qa);
  return qa;
}

module.exports = {
  SALES_IDEM_QA_DB_NAMES,
  parseDatabaseName,
  assertSalesIdemQaDb,
  buildSalesIdemQaDatabaseUrl,
};