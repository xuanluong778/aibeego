'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock, MoreHorizontal, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  checklistDateLabel,
  isChecklistItemOverdue,
  type WorkChecklistDraftItem,
} from '@/lib/work-task-detail';
import type { HrmEmployee } from '@/types/hrm';

const lightInput =
  'border-slate-200 bg-white text-black placeholder:text-slate-400 focus-visible:ring-slate-300 focus-visible:ring-offset-0 focus-visible:ring-offset-white';

const hoverOnly =
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100';

const roundBtn =
  'flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/90 text-slate-700 transition-colors hover:bg-slate-300 hover:text-slate-900 data-[state=open]:bg-slate-300';

type PopKey = 'dates' | 'assign' | 'menu';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

/** Bỏ dấu + hạ chữ thường để tìm "luong" ra "Lượng". */
function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export interface WorkChecklistItemRowProps {
  item: WorkChecklistDraftItem;
  employees: HrmEmployee[];
  /** Đang tạo thẻ từ hạng mục — khóa nút "Chuyển thành thẻ" để không tạo trùng. */
  converting?: boolean;
  onToggle: () => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onAssigneeChange: (employeeId: string | null) => void;
  onDatesChange: (startDate: string | null, dueDate: string | null) => void;
  onConvertToCard: () => void;
  onDelete: () => void;
}

/**
 * Một hạng mục trong "Việc cần làm". Rê chuột vào hiện 3 nút:
 * đặt ngày (bắt đầu/kết thúc), giao cho nhân viên, và menu "…" (Chuyển thành thẻ / Xóa).
 */
export function WorkChecklistItemRow({
  item,
  employees,
  converting,
  onToggle,
  onTitleChange,
  onTitleBlur,
  onAssigneeChange,
  onDatesChange,
  onConvertToCard,
  onDelete,
}: WorkChecklistItemRowProps) {
  const [pop, setPop] = useState<PopKey | null>(null);
  const [startDraft, setStartDraft] = useState('');
  const [dueDraft, setDueDraft] = useState('');
  const [query, setQuery] = useState('');

  const assignee = item.assigneeId ? employees.find((e) => e.id === item.assigneeId) : undefined;
  const dateLabel = checklistDateLabel(item);
  const overdue = isChecklistItemOverdue(item);
  const rangeInvalid = !!startDraft && !!dueDraft && dueDraft < startDraft;
  const hasDates = !!item.startDate || !!item.dueDate;

  const candidates = useMemo(() => {
    const q = fold(query.trim());
    return employees
      .filter((e) => e.isActive !== false)
      .filter((e) => !q || fold(`${e.name} ${e.code ?? ''} ${e.email ?? ''}`).includes(q))
      .slice(0, 50);
  }, [employees, query]);

  function handleOpenChange(key: PopKey, open: boolean) {
    if (open) {
      if (key === 'dates') {
        setStartDraft(item.startDate ?? '');
        setDueDraft(item.dueDate ?? '');
      }
      if (key === 'assign') setQuery('');
      setPop(key);
    } else {
      setPop((prev) => (prev === key ? null : prev));
    }
  }

  function saveDates() {
    if (rangeInvalid) return;
    onDatesChange(startDraft || null, dueDraft || null);
    setPop(null);
  }

  const popoverProps = {
    onOpenAutoFocus: (e: Event) => e.preventDefault(),
    onCloseAutoFocus: (e: Event) => e.preventDefault(),
  };

  return (
    <li
      className={cn(
        'group flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-slate-100/80 focus-within:bg-slate-100/80',
        pop && 'bg-slate-100/80',
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-slate-300"
        checked={item.isDone}
        onChange={onToggle}
      />
      <Input
        className={cn(
          'h-8 min-w-0 flex-1 border-transparent bg-transparent px-1 text-black shadow-none placeholder:text-slate-400 focus-visible:border-slate-200 focus-visible:bg-white focus-visible:ring-0 focus-visible:ring-offset-0',
          item.isDone && 'line-through opacity-50',
        )}
        value={item.title}
        onChange={(e) => onTitleChange(e.target.value)}
        onBlur={onTitleBlur}
      />

      {item.assigneeId && (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[10px] font-semibold text-white"
          title={assignee ? `Giao cho: ${assignee.name}` : 'Nhân viên không còn trong danh sách'}
        >
          {assignee ? initialsOf(assignee.name) : '?'}
        </span>
      )}
      {dateLabel && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium',
            overdue ? 'bg-red-100 text-red-700' : 'bg-slate-200/80 text-slate-700',
          )}
          title={overdue ? 'Hạng mục đã quá hạn' : 'Thời gian thực hiện'}
        >
          <Clock className="h-3 w-3" />
          {dateLabel}
        </span>
      )}

      <div className={cn('flex shrink-0 items-center gap-1 transition-opacity', hoverOnly, pop && '[@media(hover:hover)]:opacity-100')}>
        {/* Ngày bắt đầu / kết thúc */}
        <Popover modal={false} open={pop === 'dates'} onOpenChange={(o) => handleOpenChange('dates', o)}>
          <PopoverTrigger asChild>
            <button type="button" className={roundBtn} title="Đặt ngày bắt đầu / kết thúc" aria-label="Đặt ngày bắt đầu và kết thúc">
              <Clock className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-3" align="end" {...popoverProps}>
            <p className="mb-2 text-sm font-semibold text-slate-800">Thời gian thực hiện</p>
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày bắt đầu</label>
                <Input
                  type="date"
                  className={cn('h-9', lightInput)}
                  value={startDraft}
                  onChange={(e) => setStartDraft(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày kết thúc</label>
                <Input
                  type="date"
                  className={cn('h-9', lightInput)}
                  value={dueDraft}
                  min={startDraft || undefined}
                  onChange={(e) => setDueDraft(e.target.value)}
                />
              </div>
              {rangeInvalid && (
                <p role="alert" className="text-xs text-red-600">
                  Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="flex-1 bg-sky-600 text-white hover:bg-sky-700 hover:text-white"
                  disabled={rangeInvalid}
                  onClick={saveDates}
                >
                  Lưu
                </Button>
                {hasDates && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => {
                      onDatesChange(null, null);
                      setPop(null);
                    }}
                  >
                    Xóa ngày
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Giao cho nhân viên */}
        <Popover modal={false} open={pop === 'assign'} onOpenChange={(o) => handleOpenChange('assign', o)}>
          <PopoverTrigger asChild>
            <button type="button" className={roundBtn} title="Giao cho nhân viên" aria-label="Giao hạng mục cho nhân viên">
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="end" {...popoverProps}>
            <p className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">
              Giao cho nhân viên
            </p>
            <div className="space-y-2 p-3">
              <Input
                className={cn('h-9', lightInput)}
                placeholder="Tìm nhân viên…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                {candidates.map((emp) => {
                  const on = emp.id === item.assigneeId;
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-slate-100',
                          on && 'bg-slate-50',
                        )}
                        onClick={() => {
                          onAssigneeChange(on ? null : emp.id);
                          setPop(null);
                        }}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
                          {initialsOf(emp.name)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{emp.name}</span>
                        {on && <Check className="h-4 w-4 shrink-0 text-sky-600" />}
                      </button>
                    </li>
                  );
                })}
                {!candidates.length && (
                  <li className="py-3 text-center text-xs text-slate-500">Không tìm thấy nhân viên</li>
                )}
              </ul>
              {item.assigneeId && (
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  onClick={() => {
                    onAssigneeChange(null);
                    setPop(null);
                  }}
                >
                  Bỏ giao việc
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Menu "…" */}
        <Popover modal={false} open={pop === 'menu'} onOpenChange={(o) => handleOpenChange('menu', o)}>
          <PopoverTrigger asChild>
            <button type="button" className={roundBtn} title="Tùy chọn khác" aria-label="Tùy chọn khác của hạng mục">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end" {...popoverProps}>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={converting || !item.title.trim()}
              onClick={() => {
                setPop(null);
                onConvertToCard();
              }}
            >
              <ArrowUpRight className="h-4 w-4 text-slate-500" />
              Chuyển thành thẻ
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
              onClick={() => {
                setPop(null);
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Xóa
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </li>
  );
}
