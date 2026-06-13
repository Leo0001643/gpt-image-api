import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Pencil, Plus, RefreshCw, Save, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../lib/api';
import { systemApi } from '../../lib/services';
import type { SystemSettings } from '../../lib/types';
import { toast } from '../../stores/toast';

interface RechargePackage {
  id: string;
  name: string;
  amount: number;
  points: number;
  bonus_points: number;
  enabled: boolean;
  sort_order: number;
  badge: string;
  remark: string;
}

type FieldKey = keyof RechargePackage;
type EditState = { idx: number; field: FieldKey } | null;

const DEFAULT_ROWS: RechargePackage[] = [
  { id: 'p100', name: '100 点套餐', amount: 10, points: 100, bonus_points: 0, enabled: true, sort_order: 10, badge: '', remark: '' },
  { id: 'p500', name: '500 点套餐', amount: 45, points: 500, bonus_points: 50, enabled: true, sort_order: 20, badge: '推荐', remark: '' },
];

const NUM_FIELDS: FieldKey[] = ['sort_order', 'amount', 'points', 'bonus_points'];

const asNum = (v: unknown, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const asBool = (v: unknown, fallback = false) => (v == null ? fallback : Boolean(v));

function fromValue(v: unknown): RechargePackage[] {
  if (!Array.isArray(v)) return DEFAULT_ROWS;
  return v.map((item, idx) => {
    const row = item as Partial<RechargePackage>;
    return {
      id: String(row.id || `pkg_${idx + 1}`),
      name: String(row.name || ''),
      amount: asNum(row.amount, 0),
      points: asNum(row.points, 0) / 100,
      bonus_points: asNum(row.bonus_points, 0) / 100,
      enabled: asBool(row.enabled, true),
      sort_order: asNum(row.sort_order, (idx + 1) * 10),
      badge: String(row.badge || ''),
      remark: String(row.remark || ''),
    };
  });
}

function toPayload(rows: RechargePackage[]): Partial<SystemSettings> {
  return {
    'recharge.packages': rows.map((row) => ({
      id: row.id.trim(),
      name: row.name.trim(),
      amount: Number(row.amount) || 0,
      points: Math.round((Number(row.points) || 0) * 100),
      bonus_points: Math.round((Number(row.bonus_points) || 0) * 100),
      enabled: row.enabled,
      sort_order: Number(row.sort_order) || 0,
      badge: row.badge.trim(),
      remark: row.remark.trim(),
    })),
  };
}

/** Display helper for "—" when value is falsy */
function Empty() {
  return <span className="text-text-tertiary select-none">—</span>;
}

export default function RechargePackagesPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin', 'system', 'settings'], queryFn: () => systemApi.get() });
  const [rows, setRows] = useState<RechargePackage[]>(DEFAULT_ROWS);
  const [dirty, setDirty] = useState(false);

  /* ── Inline editing state ── */
  const [editing, setEditing] = useState<EditState>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.data) {
      setRows(fromValue(settings.data['recharge.packages']));
      setDirty(false);
      setEditing(null);
    }
  }, [settings.data]);

  const totals = useMemo(() => {
    const enabled = rows.filter((r) => r.enabled);
    return { total: rows.length, enabled: enabled.length, disabled: rows.length - enabled.length };
  }, [rows]);

  const update = (idx: number, patch: Partial<RechargePackage>) => {
    setRows((old) => old.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const addRow = () => {
    setRows((old) => [...old, {
      id: `pkg_${Date.now()}`, name: '', amount: 0, points: 0,
      bonus_points: 0, enabled: true, sort_order: (old.length + 1) * 10, badge: '', remark: '',
    }]);
    setDirty(true);
  };

  const cloneRow = (idx: number) => {
    const row = rows[idx];
    if (!row) return;
    setRows((old) => [
      ...old.slice(0, idx + 1),
      { ...row, id: `${row.id}_copy`, name: `${row.name} 副本`, sort_order: row.sort_order + 1 },
      ...old.slice(idx + 1),
    ]);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: () => systemApi.update(toPayload(rows)),
    onSuccess: () => { toast.success('充值套餐已保存'); setDirty(false); qc.invalidateQueries({ queryKey: ['admin', 'system'] }); },
    onError: (e: ApiError | Error) => toast.error(e.message),
  });

  /* ── Inline edit helpers ── */
  const startEdit = (idx: number, field: FieldKey) => {
    setEditing({ idx, field });
    const raw = rows[idx]?.[field] ?? '';
    // For numeric fields with value 0, start with empty so user just types
    setDraft(NUM_FIELDS.includes(field) && Number(raw) === 0 ? '' : String(raw));
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (!editing) return;
    const { idx, field } = editing;
    const raw = draft.trim();
    const value: string | number = NUM_FIELDS.includes(field) ? (Number(raw) || 0) : raw;
    update(idx, { [field]: value });
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  /** Renders a single editable text/number td cell */
  const EC = ({
    idx, field, display, type = 'text', placeholder = '', inputCls = '',
  }: {
    idx: number; field: FieldKey; display: React.ReactNode;
    type?: 'text' | 'number'; placeholder?: string; inputCls?: string;
  }) => {
    const isEditing = editing?.idx === idx && editing?.field === field;
    if (isEditing) {
      return (
        <td>
          <input
            ref={inputRef}
            autoFocus
            type={type}
            value={draft}
            placeholder={placeholder}
            className={`input ${inputCls}`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
              if (e.key === 'Escape') cancelEdit();
            }}
          />
        </td>
      );
    }
    return (
      <td
        className="group/cell cursor-pointer select-none"
        onDoubleClick={() => startEdit(idx, field)}
        title="双击编辑"
      >
        <div className="flex items-center gap-1.5 rounded px-1.5 -mx-1.5 py-0.5 group-hover/cell:bg-indigo-50 transition-colors">
          {display}
          <Pencil size={10} className="shrink-0 text-indigo-400 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
        </div>
      </td>
    );
  };

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',boxShadow:'0 4px 14px rgba(99,102,241,.35)'}}>
            <WalletCards size={16}/>
          </div>
          <div>
            <div className="list-page-title">充值套餐</div>
            <div className="list-page-subtitle">双击单元格即可原地修改，金额单位：元，积分单位：点</div>
          </div>
          <div className="list-divider"/>
          <div className="flex flex-wrap gap-1.5">
            <span className="stat-pill stat-pill-blue"><span className="stat-pill-dot"/><span className="stat-pill-label">总数</span><span className="stat-pill-val">{totals.total}</span></span>
            <span className="stat-pill stat-pill-green"><span className="stat-pill-dot"/><span className="stat-pill-label">启用</span><span className="stat-pill-val">{totals.enabled}</span></span>
            <span className="stat-pill stat-pill-red"><span className="stat-pill-dot"/><span className="stat-pill-label">停用</span><span className="stat-pill-val">{totals.disabled}</span></span>
            {dirty && <span className="stat-pill stat-pill-orange"><span className="stat-pill-dot"/><span className="stat-pill-label">有未保存修改</span></span>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button className="btn btn-outline btn-sm" onClick={() => settings.refetch()} disabled={settings.isFetching}>
              <RefreshCw size={11} className={settings.isFetching ? 'animate-spin' : ''}/> 重新加载
            </button>
            <button className="btn btn-outline btn-sm" onClick={addRow}><Plus size={13}/> 新增套餐</button>
            <button className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              <Save size={13}/> {save.isPending ? '保存中...' : dirty ? '保存修改' : '已是最新'}
            </button>
          </div>
        </div>
      </div>

      <div className="list-page-body">
        {settings.isLoading ? (
          <div className="table-wrap">
            <table className="data-table min-w-[1100px]">
              <thead><tr>{['排序','套餐 ID','套餐名称','金额','基础积分','赠送积分','标签','备注','状态','操作'].map(h=><th key={h}><span className="th-icon">{h}</span></th>)}</tr></thead>
              <tbody>{Array.from({length:5}).map((_,i)=>(
                <tr key={i} className="table-skeleton">{[70,140,160,100,100,100,90,150,80,100].map((w,j)=><td key={j}><span style={{width:w}} className="block rounded-full"/></td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table min-w-[1100px]">
              <thead>
                <tr>
                  <th className="sticky-l w-[70px]"><span className="th-icon">排序</span></th>
                  <th style={{minWidth:130}}><span className="th-icon" style={{justifyContent:'flex-start'}}>套餐 ID</span></th>
                  <th style={{minWidth:150}}><span className="th-icon" style={{justifyContent:'flex-start'}}>套餐名称</span></th>
                  <th style={{minWidth:100}}><span className="th-icon">金额（元）</span></th>
                  <th style={{minWidth:100}}><span className="th-icon">基础积分</span></th>
                  <th style={{minWidth:100}}><span className="th-icon">赠送积分</span></th>
                  <th style={{minWidth:90}}><span className="th-icon" style={{justifyContent:'flex-start'}}>标签</span></th>
                  <th style={{minWidth:150}}><span className="th-icon" style={{justifyContent:'flex-start'}}>备注</span></th>
                  <th style={{minWidth:72}}><span className="th-icon">状态</span></th>
                  <th className="sticky-r"><span className="th-icon">操作</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={`${row.id}-${idx}`} className="group">
                    {/* ── Col 0: 排序 (sticky-l, always input) ── */}
                    <td className="sticky-l">
                      {editing?.idx === idx && editing.field === 'sort_order' ? (
                        <input
                          ref={inputRef} autoFocus type="number" value={draft}
                          placeholder="0" className="input w-[62px] tabular-nums text-center"
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-center gap-1 rounded px-1 py-0.5 cursor-pointer group-hover:bg-indigo-50 transition-colors"
                          onDoubleClick={() => startEdit(idx, 'sort_order')} title="双击编辑"
                        >
                          <span className="tabular-nums text-text-secondary font-mono text-sm w-[46px] text-center">{row.sort_order}</span>
                          <Pencil size={10} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                        </div>
                      )}
                    </td>

                    {/* ── Col 1: 套餐 ID ── */}
                    <EC idx={idx} field="id" placeholder="p100" inputCls="font-mono w-[130px]"
                      display={row.id
                        ? <code className="font-mono text-xs bg-slate-100 text-slate-700 rounded px-1.5 py-0.5">{row.id}</code>
                        : <Empty/>}
                    />

                    {/* ── Col 2: 套餐名称 ── */}
                    <EC idx={idx} field="name" placeholder="套餐名称" inputCls="w-[148px]"
                      display={row.name
                        ? <span className="font-medium text-text-primary">{row.name}</span>
                        : <Empty/>}
                    />

                    {/* ── Col 3: 金额 ── */}
                    <EC idx={idx} field="amount" type="number" placeholder="0.00" inputCls="w-[90px] tabular-nums text-right"
                      display={<span className="tabular-nums font-semibold text-emerald-600">¥ {Number(row.amount).toFixed(2)}</span>}
                    />

                    {/* ── Col 4: 基础积分 ── */}
                    <EC idx={idx} field="points" type="number" placeholder="0" inputCls="w-[90px] tabular-nums text-right"
                      display={<span className="tabular-nums font-semibold text-violet-600">{row.points} pt</span>}
                    />

                    {/* ── Col 5: 赠送积分 ── */}
                    <EC idx={idx} field="bonus_points" type="number" placeholder="0" inputCls="w-[90px] tabular-nums text-right"
                      display={row.bonus_points
                        ? <span className="tabular-nums font-semibold text-sky-600">+{row.bonus_points} pt</span>
                        : <span className="text-text-tertiary tabular-nums">+0</span>}
                    />

                    {/* ── Col 6: 标签 ── */}
                    <EC idx={idx} field="badge" placeholder="推荐" inputCls="w-[80px]"
                      display={row.badge
                        ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">{row.badge}</span>
                        : <Empty/>}
                    />

                    {/* ── Col 7: 备注 ── */}
                    <EC idx={idx} field="remark" placeholder="内部备注" inputCls="w-[148px]"
                      display={row.remark
                        ? <span className="text-text-secondary text-sm truncate max-w-[140px]" title={row.remark}>{row.remark}</span>
                        : <Empty/>}
                    />

                    {/* ── Col 8: 状态 (click toggle) ── */}
                    <td className="text-center">
                      <button
                        className={row.enabled
                          ? 'badge badge-success cursor-pointer hover:opacity-80 transition-opacity'
                          : 'badge badge-warning cursor-pointer hover:opacity-80 transition-opacity'}
                        onClick={() => update(idx, { enabled: !row.enabled })}
                        title="点击切换状态"
                      >
                        {row.enabled ? '启用' : '停用'}
                      </button>
                    </td>

                    {/* ── Col 9: 操作 (sticky-r) ── */}
                    <td className="sticky-r">
                      <div className="flex items-center justify-center">
                        <div className="inline-grid grid-cols-2 gap-1">
                          <button className="btn btn-outline btn-action-edit btn-xs" onClick={() => cloneRow(idx)}>
                            <Copy size={13}/> 复制
                          </button>
                          <button
                            className="btn btn-outline btn-action-danger btn-xs"
                            onClick={() => { setRows((old) => old.filter((_, i) => i !== idx)); setDirty(true); }}
                          >
                            <Trash2 size={13}/> 删除
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-text-tertiary py-10">暂无套餐，点击右上角新增。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
