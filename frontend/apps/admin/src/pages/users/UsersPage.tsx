import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Coins, MinusCircle, Pencil, Plus, PlusCircle, RefreshCw, Search, Settings2, Signal, Tag, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ApiError } from '../../lib/api';
import { fmtPoints, fmtRelative, fmtTime } from '../../lib/format';
import { usersApi } from '../../lib/services';
import type { AdminUserCreateBody, AdminUserItem, AdminUserUpdateBody } from '../../lib/types';
import { toast } from '../../stores/toast';

type UserDialog =
  | { mode: 'create' }
  | { mode: 'edit'; row: AdminUserItem }
  | { mode: 'points'; row: AdminUserItem; action: 'recharge' | 'deduct' };

const pageSize = 20;

function toPointUnits(v: string): number {
  return Math.round((Number(v) || 0) * 100);
}

function userName(u: AdminUserItem): string {
  return u.username || u.email || u.phone || `用户 #${u.id}`;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [page, setPage] = useState(1);
  const [dlg, setDlg] = useState<UserDialog | null>(null);

  const query = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      status: status === 'all' ? undefined : status === 'enabled' ? (1 as const) : (0 as const),
      page,
      page_size: pageSize,
    }),
    [keyword, page, status],
  );

  const list = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => usersApi.list(query),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const toggle = useMutation({
    mutationFn: ({ id, next }: { id: number; next: 0 | 1 }) => usersApi.update(id, { status: next }),
    onSuccess: () => { refresh(); toast.success('已更新用户状态'); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#10b981,#34d399)',boxShadow:'0 4px 14px rgba(16,185,129,.35)'}}>
            <Users size={16}/>
          </div>
          <div>
            <div className="list-page-title">用户管理</div>
            <div className="list-page-subtitle">管理注册用户、账号状态、资料和积分余额</div>
          </div>
          <div className="list-divider"/>
          <div className="flex flex-wrap gap-1.5">
            <span className="stat-pill stat-pill-violet"><span className="stat-pill-dot"/><span className="stat-pill-label">总数</span><span className="stat-pill-val">{total}</span></span>
            <span className="stat-pill stat-pill-green"><span className="stat-pill-dot"/><span className="stat-pill-label">当页正常</span><span className="stat-pill-val">{items.filter(u=>u.status===1).length}</span></span>
            <span className="stat-pill stat-pill-red"><span className="stat-pill-dot"/><span className="stat-pill-label">当页停用</span><span className="stat-pill-val">{items.filter(u=>u.status!==1).length}</span></span>
            <span className="stat-pill stat-pill-amber"><span className="stat-pill-dot"/><span className="stat-pill-label">总积分</span><span className="stat-pill-val">{(items.reduce((s,u)=>s+(u.points||0),0)/100).toFixed(0)}</span></span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button className="btn btn-outline btn-sm" onClick={refresh}><RefreshCw size={11}/> 刷新</button>
            <button className="list-page-btn-add" onClick={() => setDlg({ mode: 'create' })}><Plus size={11}/> 新增用户</button>
          </div>
        </div>
        <div className="list-page-filter-row">
          <div className="search-wrap">
            <Search size={11}/>
            <input className="filter-input" style={{width:220}} placeholder="搜索 ID / 邮箱 / 手机 / 用户名 / 邀请码"
              value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
          </div>
          <div className="tabs" style={{border:'1px solid #eaecf0',borderRadius:8,padding:'2px',background:'#f5f7fa'}}>
            {[['all','全部'],['enabled','正常'],['disabled','暂停']].map(([k,label]) => (
              <button key={k} className="tab" aria-selected={status===k} onClick={() => { setStatus(k as typeof status); setPage(1); }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="list-page-body">
        <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="sticky-l"><span className="th-icon"><Users size={11}/>用户</span></th>
              <th><span className="th-icon"><Signal size={11}/>状态</span></th>
              <th><span className="th-icon"><Coins size={11}/>积分</span></th>
              <th><span className="th-icon"><Tag size={11}/>套餐</span></th>
              <th><span className="th-icon"><Calendar size={11}/>注册 / 登录</span></th>
              <th className="sticky-r"><span className="th-icon"><Settings2 size={11}/>操作</span></th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && Array.from({length: 5}).map((_, i) => (
              <tr key={i} className="table-skeleton">
                {[160, 80, 100, 80, 160, 80].map((w, j) => (
                  <td key={j} className={j===0?"sticky-l":j===5?"sticky-r":""}><span style={{width: w}} className="block rounded-full"/></td>
                ))}
              </tr>
            ))}
            {!list.isLoading && items.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <div className="empty-state-icon"><Users size={24}/></div>
                  <p className="empty-state-title">暂无用户</p>
                  <p className="empty-state-desc">新用户注册后将出现在这里。</p>
                </div>
              </td></tr>
            )}
            {items.map((u) => (
              <tr key={u.id}>
                <td className="sticky-l">
                  <div className="font-medium">{userName(u)}</div>
                  <div className="text-tiny text-text-tertiary mt-0.5">
                    ID {u.id} · {u.email || u.phone || u.uuid}
                  </div>
                  <div className="text-tiny text-text-tertiary mt-0.5">邀请码 {u.invite_code || '—'}</div>
                </td>
                <td>
                  <span className={u.status === 1 ? 'badge badge-success' : 'badge badge-warning'}>
                    {u.status === 1 ? '正常' : '暂停'}
                  </span>
                </td>
                <td>
                  <div className="font-semibold">{fmtPoints(u.points)}</div>
                  <div className="text-tiny text-text-tertiary">
                    冻结 {fmtPoints(u.frozen_points)} · 累充 {fmtPoints(u.total_recharge)}
                  </div>
                </td>
                <td>
                  <div>{u.plan_code || 'free'}</div>
                  <div className="text-tiny text-text-tertiary">{u.plan_expire_at ? fmtTime(u.plan_expire_at) : '长期'}</div>
                </td>
                <td>
                  <div className="text-small">{fmtTime(u.created_at)}</div>
                  <div className="text-tiny text-text-tertiary">
                    {u.last_login_at ? `${fmtRelative(u.last_login_at)} · ${u.last_login_ip || '未知 IP'}` : '未登录'}
                  </div>
                </td>
                <td className="sticky-r">
                  <div className="inline-grid grid-cols-2 gap-1">
                    <button className="btn btn-outline btn-action-edit btn-xs" onClick={() => setDlg({ mode: 'edit', row: u })}>
                      <Pencil size={11}/> 编辑
                    </button>
                    <button className="btn btn-outline btn-action-view btn-xs" onClick={() => setDlg({ mode: 'points', row: u, action: 'recharge' })}>
                      <PlusCircle size={11} /> 充值
                    </button>
                    <button className="btn btn-outline btn-action-warn btn-xs" onClick={() => setDlg({ mode: 'points', row: u, action: 'deduct' })}>
                      <MinusCircle size={11} /> 扣除
                    </button>
                    <button
                      className={u.status === 1 ? 'btn btn-outline btn-action-danger btn-xs' : 'btn btn-outline btn-action-view btn-xs'}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ id: u.id, next: u.status === 1 ? 0 : 1 })}
                    >
                      {u.status === 1 ? <Ban size={11}/> : <CheckCircle2 size={11}/>}
                      {u.status === 1 ? '暂停' : '启用'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="list-page-pager">
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'linear-gradient(135deg,#10b981,#34d399)'}}/>
            <span>共 <strong style={{color:'#10b981'}}>{total}</strong> 个用户 · 第 <strong style={{color:'#374151'}}>{page}</strong> 页</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="btn btn-outline btn-sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={11}/> 上一页</button>
            <span style={{fontSize:12,color:'#374151'}}>{page} / {lastPage}</span>
            <button className="btn btn-outline btn-sm" disabled={page>=lastPage} onClick={()=>setPage(p=>Math.min(lastPage,p+1))}>下一页 <ChevronRight size={11}/></button>
          </div>
        </div>
      </div>

      {dlg?.mode === 'create' && <UserFormDialog mode="create" onClose={() => setDlg(null)} onDone={refresh} />}
      {dlg?.mode === 'edit' && <UserFormDialog mode="edit" row={dlg.row} onClose={() => setDlg(null)} onDone={refresh} />}
      {dlg?.mode === 'points' && <PointsDialog row={dlg.row} action={dlg.action} onClose={() => setDlg(null)} onDone={refresh} />}
    </div>
  );
}

function UserFormDialog(props: {
  mode: 'create' | 'edit';
  row?: AdminUserItem;
  onClose: () => void;
  onDone: () => void;
}) {
  const isCreate = props.mode === 'create';
  const [body, setBody] = useState({
    account: props.row?.email || props.row?.phone || props.row?.username || '',
    password: '',
    username: props.row?.username || '',
    email: props.row?.email || '',
    phone: props.row?.phone || '',
    plan_code: props.row?.plan_code || 'free',
    status: (props.row?.status === 0 ? 0 : 1) as 0 | 1,
    points: '',
  });

  const mut = useMutation({
    mutationFn: () => {
      if (isCreate) {
        const payload: AdminUserCreateBody = {
          account: body.account.trim(),
          password: body.password,
          username: body.username.trim() || undefined,
          points: toPointUnits(body.points),
          status: body.status,
        };
        return usersApi.create(payload);
      }
      const payload: AdminUserUpdateBody = {
        email: body.email.trim() || null,
        phone: body.phone.trim() || null,
        username: body.username.trim() || null,
        plan_code: body.plan_code.trim() || 'free',
        status: body.status,
      };
      if (body.password.trim()) payload.password = body.password;
      return usersApi.update(props.row!.id, payload).then(() => ({ id: props.row!.id }));
    },
    onSuccess: () => {
      props.onDone();
      props.onClose();
      toast.success(isCreate ? '已新增用户' : '已保存用户');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md" onClick={props.onClose}>
      <div className="dialog-surface w-full max-w-xl gia-fade-in flex flex-col max-h-[88vh]" onClick={(e)=>e.stopPropagation()}>
        <div className={`modal-header-grad ${isCreate ? 'mhg-blue' : 'mhg-violet'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="modal-icon">{isCreate ? <Users size={20}/> : <Pencil size={20}/>}</div>
            <div className="min-w-0">
              <h3>{isCreate ? '新增用户' : '编辑用户'}</h3>
              <p>{isCreate ? '创建新账号并设置初始积分' : '修改用户基本信息与状态'}</p>
            </div>
          </div>
          <button className="modal-close" onClick={props.onClose} aria-label="关闭"><X size={16}/></button>
        </div>
        <div className="modal-body grid gap-3">
          {isCreate ? (
            <label className="field">
              <span>账号</span>
              <input className="input" value={body.account} onChange={(e) => setBody((s) => ({ ...s, account: e.target.value }))} placeholder="邮箱 / 手机号 / 用户名" />
            </label>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="field"><span>邮箱</span><input className="input" value={body.email} onChange={(e) => setBody((s) => ({ ...s, email: e.target.value }))} /></label>
              <label className="field"><span>手机号</span><input className="input" value={body.phone} onChange={(e) => setBody((s) => ({ ...s, phone: e.target.value }))} /></label>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="field"><span>用户名</span><input className="input" value={body.username} onChange={(e) => setBody((s) => ({ ...s, username: e.target.value }))} /></label>
            <label className="field"><span>密码{isCreate ? '' : '（留空不改）'}</span><input className="input" type="password" value={body.password} onChange={(e) => setBody((s) => ({ ...s, password: e.target.value }))} /></label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="field"><span>套餐</span><input className="input" value={body.plan_code} onChange={(e) => setBody((s) => ({ ...s, plan_code: e.target.value }))} /></label>
            <label className="field">
              <span>状态</span>
              <select className="input" value={body.status} onChange={(e) => setBody((s) => ({ ...s, status: Number(e.target.value) as 0 | 1 }))}>
                <option value={1}>正常</option>
                <option value={0}>暂停</option>
              </select>
            </label>
            {isCreate && (
              <label className="field"><span>初始积分</span><input className="input" value={body.points} onChange={(e) => setBody((s) => ({ ...s, points: e.target.value }))} placeholder="例如 100" /></label>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={props.onClose}>取消</button>
          <button className="btn btn-primary" disabled={mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

function PointsDialog(props: {
  row: AdminUserItem;
  action: 'recharge' | 'deduct';
  onClose: () => void;
  onDone: () => void;
}) {
  const [points, setPoints] = useState('');
  const isRecharge = props.action === 'recharge';
  const [remark, setRemark] = useState(isRecharge ? '管理员充值' : '管理员扣除');
  const pointUnits = toPointUnits(points);
  const nextPoints = props.row.points + (isRecharge ? pointUnits : -pointUnits);
  const isValid = pointUnits > 0 && (isRecharge || nextPoints >= 0);

  const mut = useMutation({
    mutationFn: () => usersApi.adjustPoints(props.row.id, {
      action: props.action,
      points: pointUnits,
      remark: remark.trim() || (isRecharge ? '管理员充值' : '管理员扣除'),
    }),
    onSuccess: (r) => {
      props.onDone();
      props.onClose();
      toast.success(`${isRecharge ? '充值' : '扣除'}成功：${fmtPoints(r.points_before)} → ${fmtPoints(r.points_after)}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md" onClick={props.onClose}>
      <div className="dialog-surface w-full max-w-lg gia-fade-in flex flex-col max-h-[88vh]" onClick={(e)=>e.stopPropagation()}>
        <div className={`modal-header-grad ${isRecharge ? 'mhg-emerald' : 'mhg-rose'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="modal-icon">{isRecharge ? <PlusCircle size={20}/> : <MinusCircle size={20}/>}</div>
            <div className="min-w-0">
              <h3>{isRecharge ? '充值积分' : '扣除积分'}</h3>
              <p>{userName(props.row)}</p>
            </div>
          </div>
          <button className="modal-close" onClick={props.onClose} aria-label="关闭"><X size={16}/></button>
        </div>
        <div className="modal-body grid gap-3">
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-small">
            <div className="text-text-secondary">{userName(props.row)}</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <div className="text-text-tertiary">当前可用</div>
                <div className="mt-1 text-lg">{fmtPoints(props.row.points)}</div>
              </div>
              <div>
                <div className="text-text-tertiary">{isRecharge ? '本次充值' : '本次扣除'}</div>
                <div className={isRecharge ? 'mt-1 text-lg text-success' : 'mt-1 text-lg text-danger'}>
                  {pointUnits > 0 ? `${isRecharge ? '+' : '-'}${fmtPoints(pointUnits)}` : '-'}
                </div>
              </div>
              <div>
                <div className="text-text-tertiary">调整后</div>
                <div className="mt-1 text-lg">{pointUnits > 0 ? fmtPoints(nextPoints) : '-'}</div>
              </div>
            </div>
          </div>
          <label className="field">
            <span>{isRecharge ? '充值积分' : '扣除积分'}</span>
            <input
              className="input"
              value={points}
              inputMode="decimal"
              onChange={(e) => setPoints(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="例如 100"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {['100', '500', '1000', '5000'].map((v) => (
              <button key={v} type="button" className="btn btn-outline btn-sm" onClick={() => setPoints(v)}>
                {v} 点
              </button>
            ))}
          </div>
          {!isRecharge && pointUnits > props.row.points && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
              扣除金额不能超过用户当前可用积分。
            </div>
          )}
          <label className="field">
            <span>备注</span>
            <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="显示在钱包流水中" />
          </label>
          <div className="text-tiny text-text-tertiary">
            充值会计入用户累计充值，扣除只记录人工扣除流水，不会减少累计充值。
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={props.onClose}>取消</button>
          <button className={isRecharge ? 'btn btn-primary' : 'btn btn-danger'} disabled={mut.isPending || !isValid} onClick={() => mut.mutate()}>
            {mut.isPending ? '处理中…' : isRecharge ? '确认充值' : '确认扣除'}
          </button>
        </div>
      </div>
    </div>
  );
}
