'use client';

import { useEffect, useMemo, useState } from 'react';
import { Coins, RefreshCw, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState, ErrorState } from '@/components/shared/page-state';
import { useAdminCreditCosts, useUpdateAdminCreditCost, type AdminCreditCost } from '@/hooks/use-platform-admin';
import { formatCredit, formatDateTime } from '@/lib/format';

function CostRow({ item }: { item: AdminCreditCost }) {
  const [value, setValue] = useState(String(item.creditCost));
  const [saved, setSaved] = useState(false);
  const update = useUpdateAdminCreditCost();
  useEffect(() => { setValue(String(item.creditCost)); }, [item.creditCost, item.updatedAt]);
  const cost = Number(value);
  const free = item.featureCode === 'content_ai.suggest';
  const valid = free || (value.trim() !== '' && Number.isInteger(cost) && cost >= 1 && cost <= 1000000);
  const dirty = !free && valid && cost !== item.creditCost;
  return (
    <tr className="border-t border-white/10 align-top" data-feature-code={item.featureCode}>
      <td className="px-3 py-4 font-mono text-xs text-white/65">{item.module}</td>
      <td className="px-3 py-4 font-mono text-xs">{item.action}</td>
      <td className="px-3 py-3">
        <p className="font-medium">{item.name}</p>
        <p className="mt-1 max-w-sm text-xs text-white/60">{item.description}</p>
        <p className="mt-1 text-xs text-white/50">Đơn vị: {item.unit}</p>
        {item.reserved && <span className="mt-2 inline-block rounded bg-amber-400/10 px-2 py-0.5 text-xs text-amber-200">Cấu hình dự phòng</span>}
        {!item.isActive && <span className="mt-2 inline-block rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">Chưa kích hoạt</span>}
      </td>
      <td className="w-36 px-3 py-3">
        <Input type="number" min={free ? 0 : 1} max={1000000} step={1} value={value} disabled={free || update.isPending}
          aria-label={`Credit ${item.featureCode}`} aria-invalid={!valid}
          onChange={event => { setValue(event.target.value); setSaved(false); update.reset(); }} className="h-9 min-w-24" />
        {!valid && <p className="mt-1 text-xs text-red-200">Nhập số nguyên từ 1 đến 1.000.000.</p>}
      </td>
      <td className="px-3 py-4 text-right tabular-nums">
        <p className="font-semibold">{formatCredit(item.usedCredits30d)}</p>
        <p className="mt-1 whitespace-nowrap text-xs text-white/50">{item.chargedCalls30d.toLocaleString('vi-VN')} lần trừ</p>
      </td>
      <td className="w-40 px-3 py-3">
        <Button size="sm" disabled={!dirty || update.isPending} className="w-full"
          onClick={async () => {
            setSaved(false);
            try { await update.mutateAsync({ featureCode: item.featureCode, creditCost: cost, expectedUpdatedAt: item.updatedAt }); setSaved(true); } catch { /* Inline error below. */ }
          }}>
          <Save className="mr-1.5 h-3.5 w-3.5" />{update.isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <div aria-live="polite" className="mt-1.5 text-xs">
          {update.isError ? <p className="text-red-200">{update.error.message}</p> : saved ? <p className="text-emerald-300">Đã lưu</p> : null}
        </div>
        <p className="mt-2 text-[11px] text-white/45">{formatDateTime(item.updatedAt)}</p>
      </td>
    </tr>
  );
}

export default function AdminCreditCostsPage() {
  const list = useAdminCreditCosts();
  const [search, setSearch] = useState('');
  const items = list.data || [];
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return items.filter(row => `${row.module} ${row.action} ${row.name} ${row.description || ''}`.toLocaleLowerCase('vi').includes(query));
  }, [items, search]);
  if (list.isLoading) return <LoadingState />;
  if (list.isError) return <ErrorState onRetry={() => void list.refetch()} />;
  const active = items.filter(row => row.isActive && !row.reserved && row.creditCost > 0).length;
  const total = items.reduce((sum, row) => sum + row.usedCredits30d, 0);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-heading"><Coins className="h-6 w-6" />Credit costs</h1>
        <p className="mt-2 text-sm text-white/70">Tùy chỉnh mức trừ credit cho từng tác vụ, áp dụng trên toàn nền tảng.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Tác vụ đang tính credit', active.toLocaleString('vi-VN')], ['Credit đã trừ · 30 ngày', formatCredit(total)], ['Cấu hình dự phòng', items.filter(row => row.reserved).length.toLocaleString('vi-VN')]].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xs text-white/60">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>
        ))}
      </div>
      <div className="rounded-lg border border-teal-300/20 bg-teal-300/5 p-3 text-sm text-white/75">
        Lưu từng dòng để áp dụng cho tác vụ mới. Tác vụ đã tạm giữ credit giữ mức cũ; lịch sử đã trừ không thay đổi.
        Chỉ trừ credit khi tạo Content AI thành công. Gợi ý và các thao tác khác trong phần Content miễn phí.
        Các tác vụ khác có thể dùng nhiều hơn mức cơ bản theo độ dài, model hoặc số lần gọi AI.
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/50" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm module, action, tên tác vụ…" aria-label="Tìm Credit costs" className="h-9 pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => void list.refetch()} disabled={list.isFetching}><RefreshCw className="mr-1.5 h-4 w-4" />Làm mới</Button>
        <p className="text-xs text-white/55">{filtered.length}/{items.length} mục</p>
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/5 text-white/65"><tr>
            <th className="px-3 py-3 font-medium">Module</th><th className="px-3 py-3 font-medium">Action</th>
            <th className="px-3 py-3 font-medium">Tác vụ</th><th className="px-3 py-3 font-medium">Credit / đơn vị</th>
            <th className="px-3 py-3 text-right font-medium">Đã trừ · 30 ngày</th><th className="px-3 py-3 font-medium">Thay đổi</th>
          </tr></thead>
          <tbody>{filtered.map(item => <CostRow key={item.id} item={item} />)}</tbody>
        </table>
        {!filtered.length && <p className="p-6 text-center text-sm text-white/60">Không có tác vụ phù hợp.</p>}
      </div>
    </div>
  );
}
