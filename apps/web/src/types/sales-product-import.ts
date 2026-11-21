export const PRODUCT_IMPORT_COLUMNS = {
  name: 'Tên sản phẩm',
  sku: 'SKU',
  barcode: 'Barcode',
  category: 'Danh mục',
  unit: 'Đơn vị',
  price: 'Giá bán',
  costPrice: 'Giá vốn',
  stockQty: 'Tồn đầu kỳ',
  minStockQty: 'Tồn tối thiểu',
  note: 'Ghi chú',
  model: 'Model',
} as const;
export type ProductImportField = keyof typeof PRODUCT_IMPORT_COLUMNS;
export type ProductImportOptions = {
  mode: 'skip' | 'update';
  createCategories: boolean;
  updateFields: ProductImportField[];
};
export type ProductImportSession = {
  wooConnectionId?: string | null;
  id: string;
  fileName: string;
  status: 'DRAFT' | 'PREVIEW' | 'RUNNING' | 'COMPLETED';
  sheets: Array<{ index: number; name: string; headers: string[]; rowCount: number }>;
  sheetIndex: number | null;
  mapping: Partial<Record<ProductImportField, number>> | null;
  options: ProductImportOptions | null;
  previewVersion: number;
  counts: Record<string, number>;
  total: number;
  batchSize: number;
  createdAt: string;
  updatedAt: string;
};
export type ProductImportRow = {
  source?: { externalId: string; url: string; stockQuantity: number | null; stockStatus: string; images: string[] } | null;
  id: string;
  rowNumber: number;
  status: string;
  action: string;
  productId?: string | null;
  errors: string[];
  warnings: string[];
  message?: string;
  attempts: number;
  values: Partial<Record<ProductImportField, string>>;
};
