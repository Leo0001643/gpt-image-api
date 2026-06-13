import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, RefreshCw, Save, Trash2, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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

const DEFAULT_ROWS: RechargePackage[] = [
  { id: 'p100', name: '100 点套餐', amount: 10, points: 100, bonus_points: 0, enabled: true, sort_order: 10, badge: '', remark: '' },
  { id: 'p500', name: '500 点套餐', amount: 45, points: 500, bonus_points: 50, enabled: true, sort_order: 20, badge: '推荐', remark: '' },
];

const asNum = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
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

export default function RechargePackagesPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin', 'system', 'settings'], queryFn: () => systemApi.get() });
  const [rows, setRows] = useState<RechargePackage[]>(DEFAULT_ROWS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setRows(fromValue(settings.data['recharge.packages']));
      setDirty(false);
    }
  }, [settings.data]);

  const totals = useMemo(() => {
    const enabled = rows.filter((row) => row.enabled);
    return {
      total: rows.length,
      enabled: enabled.length,
      disabled: rows.length - enabled.length,
    };
  }, [rows]);

  const update = (idx: number, patch: Partial<RechargePackage>) => {
    setRows((old) => old.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const addRow = () => {
    setRows((old) => [
      ...old,
      {
        id: `pkg_${Date.now()}`,
        name: '',
        amount: 0,
        points: 0,
        bonus_points: 0,
        enabled: true,
        sort_order: (old.length + 1) * 10,
        badge: '',
        remark: '',
      },
    ]);
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
    onSuccess: () => {
      toast.success('充值套餐已保存');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin', 'system'] });
    },
    onError: (e: ApiError | Error) => toast.error(e.message),
  });

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',boxShadow:'0 4px 14px rgba(99,102,241,.35)'}}>
            <WalletCards size={16}/>
          </div>
          <div>
            <div className="list-page-title">充值套餐</div>
            <div className="list-page-subtitle">用表单维护前端售卖套餐，金额单位为元，积分单位为点</div>
          </div>
          <div className="list-divider"/>
          <div className="flex flex-wrap gap-1.5">
            <span className="stat-pill stat-pill-blue"><span className="stat-pill-dot"/><span className="stat-pill-label">总数</span><span className="stat-pill-val">{totals.total}</span></span>
            <span className="stat-pill stat-pill-green"><span className="stat-pill-dot"/><span className="stat-pill-label">启用</span><span className="stat-pill-val">{totals.enabled}</span></span>
            <span className="stat-pill stat-pill-red"><span className="stat-pill-dot"/><span className="stat-pill-label">停用</span><span className="stat-pill-val">{totals.disabled}</span></span>
            {dirty && <span className="stat-pill stat-pill-orange"><span className="stat-pill-dot"/><span className="stat-pill-label">有未保存修改</span></span>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button className="btn btn-outline btn-sm" onClick={() => settings.refetch()} disabled={settings.isFetching}><RefreshCw size={13} className={settings.isFetching?'animate-spin':''}/> 重新加载</button>
            <button className="btn btn-outline btn-sm" onClick={addRow}><Plus size={13}/> 新增套餐</button>
            <button className="btn btn-primary btn-sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              <Save size={13}/> {save.isPending?'保存中...':dirty?'保存修改':'已是最新'}
            </button>
          </div>
        </div>
      </div>

      <div className="list-page-body">
        {settings.isLoading ? (
        <div className="table-wrap">
          <table className="data-table min-w-[1180px]">
            <thead><tr>{['排序','套餐 ID','套餐名称','金额','基础积分','赠送积分','标签','备注','状态','操作'].map(h=><th key={h}><span className="th-icon">{h}</span></th>)}</tr></thead>
            <tbody>{Array.from({length:5}).map((_,i)=>(
              <tr key={i} className="table-skeleton">{[76,140,160,110,110,110,100,100,80,100].map((w,j)=><td key={j}><span style={{width:w}} className="block rounded-full"/></td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        ) : (
        <div className="table-wrap">
          <table className="data-table min-w-[1180px]">
            <thead>
              <tr>
                <th><span className="th-icon">排序</span></th>
                <th><span className="th-icon" style={{justifyContent:'flex-start'}}>套餐 ID</span></th>
                <th><span className="th-icon" style={{justifyContent:'flex-start'}}>套餐名称</span></th>
                <th><span className="th-icon">金额（元）</span></th>
                <th><span className="th-icon">基础积分</span></th>
                <th><span className="th-icon">赠送积分</span></th>
                <th><span className="th-icon" style={{justifyContent:'flex-start'}}>标签</span></th>
                <th><span className="th-icon" style={{justifyContent:'flex-start'}}>备注</span></th>
                <th><span className="th-icon">状态</span></th>
                <th><span className="th-icon">操作</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${row.id}-${idx}`}>
                  <td><input className="input w-[76px] tabular-nums" type="number" value={row.sort_order || ''} placeholder="0" onChange={(e) => update(idx, { sort_order: Number(e.target.value) || 0 })} /></td>
                  <td><input className="input min-w-[140px] font-mono" value={row.id} onChange={(e) => update(idx, { id: e.target.value })} placeholder="p100" /></td>
                  <td><input className="input min-w-[160px]" value={row.name} onChange={(e) => update(idx, { name: e.target.value })} placeholder="100 点套餐" /></td>
                  <td><input className="input w-[110px] tabular-nums" type="number" min={0} step="0.01" value={row.amount || ''} placeholder="0.00" onChange={(e) => update(idx, { amount: Number(e.target.value) || 0 })} /></td>
                  <td><input className="input w-[120px] tabular-nums" type="number" min={0} value={row.points || ''} placeholder="0" onChange={(e) => update(idx, { points: Number(e.target.value) || 0 })} /></td>
                  <td><input className="input w-[120px] tabular-nums" type="number" min={0} value={row.bonus_points || ''} placeholder="0" onChange={(e) => update(idx, { bonus_points: Number(e.target.value) || 0 })} /></td>
                  <td><input className="input min-w-[100px]" value={row.badge} onChange={(e) => update(idx, { badge: e.target.value })} placeholder="推荐" /></td>
                  <td><input className="input min-w-[180px]" value={row.remark} onChange={(e) => update(idx, { remark: e.target.value })} placeholder="内部备注" /></td>
                  <td>
                    <button className={row.enabled ? 'btn btn-outline btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => update(idx, { enabled: !row.enabled })}>
                      {row.enabled ? '启用' : '停用'}
                    </button>
                  </td>
                  <td>
                    <div className="inline-grid grid-cols-2 gap-1 w-[108px]">
                      <button className="btn btn-outline btn-action-edit btn-sm" onClick={() => cloneRow(idx)}><Copy size={13}/> 复制</button>
                      <button className="btn btn-outline btn-action-danger btn-sm" onClick={() => { setRows((old) => old.filter((_, i) => i !== idx)); setDirty(true); }}><Trash2 size={13}/> 删除</button>
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

