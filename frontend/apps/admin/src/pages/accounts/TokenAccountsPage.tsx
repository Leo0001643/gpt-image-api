import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertCircle, BarChart2, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, Clock, Database, KeyRound, Pencil, Plus, Power, RefreshCw,
  RotateCw, Search, Settings2, ShieldCheck, Signal, Tag, Trash2, Upload, X, XCircle,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../lib/api';
import { fmtNumber, fmtRelative, fmtTime, statusLabel } from '../../lib/format';
import { accountsApi, proxiesApi } from '../../lib/services';
import type {
  AccountBatchAssignProxyBody,
  AccountBatchImportBody,
  AccountCreateBody,
  AccountItem,
  AccountUpdateBody,
  Sub2APIAccountItem,
} from '../../lib/types';
import { toast } from '../../stores/toast';

type ProviderFilter = 'all' | 'gpt' | 'grok';
type PlanTypeFilter = 'all' | 'basic' | 'super' | 'heavy';
type AuthType = 'api_key' | 'oauth' | 'cookie';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

const PLAN_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'basic', label: 'Basic' },
  { value: 'super', label: 'Super' },
  { value: 'heavy', label: 'Heavy' },
] as const;

function normalizeBaseURL(value?: string): string | undefined {
  const trimmed = (value || '').trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function defaultAuthType(provider: 'gpt' | 'grok'): AuthType {
  return provider === 'gpt' ? 'oauth' : 'cookie';
}

function planTypeLabel(planType?: string): string {
  switch ((planType || '').toLowerCase()) {
    case 'basic':
      return 'Basic';
    case 'super':
      return 'Super';
    case 'heavy':
      return 'Heavy';
    default:
      return planType ? planType : '--';
  }
}

function planTypeClass(planType?: string): string {
  switch ((planType || '').toLowerCase()) {
    case 'basic':
      return 'badge';
    case 'super':
      return 'badge badge-gia';
    case 'heavy':
      return 'badge badge-warning';
    default:
      return 'badge badge-outline';
  }
}

function testLabel(status?: number): { label: string; cls: string; icon: typeof CheckCircle2 } {
  switch (status) {
    case 1:
      return { label: 'OK', cls: 'text-success', icon: CheckCircle2 };
    case 2:
      return { label: 'FAIL', cls: 'text-danger', icon: XCircle };
    default:
      return { label: '未测', cls: 'text-text-tertiary', icon: Clock };
  }
}

function expireState(expireAt?: number): { label: string; detail: string; cls: string } {
  if (!expireAt) return { label: '未设置', detail: '未记录过期时间', cls: 'text-text-tertiary' };
  const diff = expireAt - Date.now() / 1000;
  if (diff <= 0) return { label: '已过期', detail: fmtTime(expireAt), cls: 'text-danger' };
  if (diff < 3600) return { label: `${Math.max(1, Math.floor(diff / 60))} 分钟`, detail: fmtTime(expireAt), cls: 'text-warning' };
  if (diff < 86400) return { label: `${Math.floor(diff / 3600)} 小时`, detail: fmtTime(expireAt), cls: 'text-warning' };
  return { label: `${Math.floor(diff / 86400)} 天`, detail: fmtTime(expireAt), cls: 'text-text-secondary' };
}

function accountRowStatus(item: AccountItem): { label: string; tone: 'ok' | 'warn' | 'err' | 'mute' } {
  const base = statusLabel(item.status);
  if (item.status !== 1) return { label: base.label, tone: base.tone };
  const hasError = !!(item.last_error || '').trim() || item.last_test_status === 2 || !!(item.last_test_error || '').trim();
  return hasError ? { label: '异常', tone: 'err' } : { label: base.label, tone: base.tone };
}

const TONE_CLS: Record<'ok' | 'warn' | 'err' | 'mute', string> = {
  ok: 'badge badge-success',
  warn: 'badge badge-warning',
  err: 'badge badge-danger',
  mute: 'badge',
};

function parseSub2ExportJson(raw: string): Sub2APIAccountItem[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('文件不是合法 JSON');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('JSON 根节点必须是对象');
  }
  const accounts = (data as { accounts?: unknown }).accounts;
  if (!Array.isArray(accounts)) {
    throw new Error('导入文件必须包含 accounts 数组');
  }
  return accounts as Sub2APIAccountItem[];
}

export default function TokenAccountsPage() {
  const qc = useQueryClient();

  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [planType, setPlanType] = useState<PlanTypeFilter>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [openCreate, setOpenCreate] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openAssignProxy, setOpenAssignProxy] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountItem | null>(null);

  const query = useMemo(
    () => ({
      provider: provider === 'all' ? undefined : provider,
      plan_type: planType === 'all' ? undefined : planType,
      keyword: keyword.trim() || undefined,
      page,
      page_size: pageSize,
    }),
    [provider, planType, keyword, page, pageSize],
  );

  const list = useQuery({
    queryKey: ['admin', 'accounts', 'list', query],
    queryFn: () => accountsApi.list(query),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'accounts'] });
    qc.invalidateQueries({ queryKey: ['admin', 'pool', 'stats'] });
  };

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 0 | 1 }) => accountsApi.update(id, { status }),
    onSuccess: () => {
      refresh();
      toast.success('状态已更新');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => accountsApi.remove(id),
    onSuccess: () => {
      refresh();
      toast.success('账号已删除');
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: (id: number) => accountsApi.test(id),
    onSuccess: (res) => {
      refresh();
      if (res.ok) toast.success(`连通性正常，延迟 ${res.latency_ms}ms`);
      else toast.error(`测试失败：${res.error || '未知错误'}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const refreshOAuthMut = useMutation({
    mutationFn: (id: number) => accountsApi.refresh(id),
    onSuccess: (res) => {
      refresh();
      const extra = res.expires_in ? `，有效期约 ${Math.floor(res.expires_in / 3600)}h` : '';
      toast.success(`access_token 已刷新${extra}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const batchRefresh = useMutation({
    mutationFn: async (value: 'gpt' | 'grok' | '') => {
      let current = 1;
      let refreshed = 0;
      const failedIDs: number[] = [];
      const batchSize = Math.min(Math.max(pageSize, 1), 1000);
      for (;;) {
        const res = await accountsApi.batchRefresh(value || undefined, current, batchSize);
        refreshed += res.refreshed;
        failedIDs.push(...res.failed_ids);
        if (res.has_more && res.next_page) {
          current = res.next_page;
          continue;
        }
        break;
      }
      return { refreshed, failedIDs };
    },
    onSuccess: (res) => {
      refresh();
      toast.success(`已刷新 ${res.refreshed} 个 OAuth 账号${res.failedIDs.length ? `，失败 ${res.failedIDs.length} 个` : ''}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const batchProbe = useMutation({
    mutationFn: async (value: 'gpt' | 'grok' | '') => {
      let current = 1;
      let probed = 0;
      const failedIDs: number[] = [];
      const batchSize = Math.min(Math.max(pageSize, 1), 1000);
      for (;;) {
        const res = await accountsApi.batchProbe(value || undefined, current, batchSize);
        probed += res.probed;
        failedIDs.push(...res.failed_ids);
        if (res.has_more && res.next_page) {
          current = res.next_page;
          continue;
        }
        break;
      }
      return { probed, failedIDs };
    },
    onSuccess: (res) => {
      refresh();
      toast.success(`已检测 ${res.probed} 个账号${res.failedIDs.length ? `，失败 ${res.failedIDs.length} 个` : ''}`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const batchDelete = useMutation({
    mutationFn: (ids: number[]) => accountsApi.batchDelete(ids),
    onSuccess: (res) => {
      refresh();
      setSelected(new Set());
      toast.success(`已删除 ${res.deleted} 个账号`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const batchAssignProxy = useMutation({
    mutationFn: (body: AccountBatchAssignProxyBody) => accountsApi.batchAssignProxy(body),
    onSuccess: (res) => {
      refresh();
      setSelected(new Set());
      setOpenAssignProxy(false);
      toast.success(`已更新 ${res.updated} 个 Token 的代理`);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const pageIDs = items.map((item) => item.id);
  const pageAllSelected = pageIDs.length > 0 && pageIDs.every((id) => selected.has(id));
  const headerCbRef = useRef<HTMLInputElement | null>(null);

  const selectedAccountIDs = useMemo(() => {
    const visible = items.filter((item) => selected.has(item.id)).map((item) => item.id);
    const visibleSet = new Set(visible);
    return [...visible, ...[...selected].filter((id) => !visibleSet.has(id))];
  }, [items, selected]);

  useEffect(() => {
    const el = headerCbRef.current;
    if (!el) return;
    const some = pageIDs.some((id) => selected.has(id));
    el.indeterminate = some && !pageAllSelected;
  }, [pageIDs, pageAllSelected, selected]);

  useEffect(() => {
    setSelected(new Set());
  }, [provider, planType, keyword]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) pageIDs.forEach((id) => next.delete(id));
      else pageIDs.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="list-page">
      {/* ── 吸顶头部 ── */}
      <div className="list-page-head">
        {/* 标题行 */}
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',boxShadow:'0 4px 14px rgba(99,102,241,.35)'}}>
            <KeyRound size={16} />
          </div>
          <div>
            <div className="list-page-title">Token 账号管理</div>
            <div className="list-page-subtitle">统一管理 GPT / GROK 账号、额度、账户类型和代理绑定</div>
          </div>
          <div className="list-divider" />
          {/* 统计徽章 */}
          <div className="flex flex-wrap gap-1.5">
            <span className="stat-pill stat-pill-blue"><span className="stat-pill-dot"/><span className="stat-pill-label">总数</span><span className="stat-pill-val">{total}</span></span>
            <span className="stat-pill stat-pill-green"><span className="stat-pill-dot"/><span className="stat-pill-label">当页启用</span><span className="stat-pill-val">{items.filter(a=>a.status===1).length}</span></span>
            <span className="stat-pill stat-pill-red"><span className="stat-pill-dot"/><span className="stat-pill-label">当页禁用</span><span className="stat-pill-val">{items.filter(a=>a.status!==1).length}</span></span>
            <span className="stat-pill stat-pill-amber"><span className="stat-pill-dot"/><span className="stat-pill-label">异常</span><span className="stat-pill-val">{items.filter(a=>{const r=accountRowStatus(a);return r.tone==='err'||r.tone==='warn';}).length}</span></span>
            {selected.size > 0 && <span className="stat-pill stat-pill-violet"><span className="stat-pill-dot"/><span className="stat-pill-label">已选</span><span className="stat-pill-val">{selected.size}</span></span>}
          </div>
          {/* 操作按钮 */}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button className="btn btn-outline btn-sm" onClick={refresh}><RefreshCw size={13}/> 刷新</button>
            <button className="btn btn-outline btn-sm" onClick={() => batchRefresh.mutate(provider === 'all' ? '' : provider)} disabled={batchRefresh.isPending}>
              <RotateCw size={13} className={batchRefresh.isPending ? 'animate-spin' : ''}/> 批量刷新
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => batchProbe.mutate(provider === 'all' ? '' : provider)} disabled={batchProbe.isPending}>
              <Activity size={13} className={batchProbe.isPending ? 'animate-pulse' : ''}/> 批量检测
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setOpenImport(true)}><Upload size={13}/> 导入</button>
            <button className="btn btn-outline btn-sm" disabled={selected.size === 0 || batchAssignProxy.isPending} onClick={() => setOpenAssignProxy(true)}>
              <ChevronDown size={13}/> 批量代理
            </button>
            {selected.size > 0 && (
              <button className="btn btn-danger btn-sm" disabled={batchDelete.isPending} onClick={() => { if (!confirm(`确认删除选中的 ${selected.size} 个账号吗？`)) return; batchDelete.mutate([...selected]); }}>
                <Trash2 size={13}/> 批量删除
              </button>
            )}
            <button className="list-page-btn-add" onClick={() => setOpenCreate(true)}><Plus size={14}/> 新增账号</button>
          </div>
        </div>

        {/* 筛选行 */}
        <div className="list-page-filter-row">
          <div className="search-wrap">
            <Search size={13}/>
            <input
              className="filter-input"
              style={{width:180}}
              placeholder="搜索名称或备注"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
          </div>
          <div className="tabs" style={{border:'1px solid #eaecf0',borderRadius:8,padding:'2px',background:'#f5f7fa'}}>
            {(['all', 'gpt', 'grok'] as const).map((item) => (
              <button key={item} type="button" className="tab" aria-selected={provider === item} onClick={() => { setProvider(item); setPage(1); }}>
                {item === 'all' ? '全部' : item.toUpperCase()}
              </button>
            ))}
          </div>
          <select className="filter-select" style={{minWidth:110}} value={planType} onChange={(e) => { setPlanType(e.target.value as PlanTypeFilter); setPage(1); }}>
            {PLAN_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <div className="ml-auto filter-count">共 <strong>{fmtNumber(total)}</strong> 条</div>
        </div>
      </div>

      {/* ── 表格区域 ── */}
      <div className="list-page-body">
        <div className="table-wrap">
        <table className="data-table min-w-[1100px]">
          <thead>
            <tr>
              <th className="sticky-l w-10">
                <input
                  ref={headerCbRef}
                  type="checkbox"
                  className="rounded border-border"
                  checked={pageAllSelected}
                  onChange={toggleSelectPage}
                  disabled={list.isLoading || items.length === 0}
                />
              </th>
              <th><span className="th-icon"><KeyRound size={13}/>名称</span></th>
              <th><span className="th-icon"><Database size={13}/>Provider</span></th>
              <th><span className="th-icon"><Tag size={13}/>账户类型</span></th>
              <th><span className="th-icon"><Signal size={13}/>状态</span></th>
              <th><span className="th-icon"><ShieldCheck size={13}/>凭证 / 测试</span></th>
              <th><span className="th-icon"><BarChart2 size={13}/>用量</span></th>
              <th><span className="th-icon"><Clock size={13}/>到期时间</span></th>
              <th className="sticky-r"><span className="th-icon"><Settings2 size={13}/>操作</span></th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && Array.from({length: 5}).map((_, i) => (
              <tr key={i} className="table-skeleton">
                {[10, 160, 80, 80, 80, 140, 100, 80, 80].map((w, j) => (
                  <td key={j} className={j===0?"sticky-l":j===8?"sticky-r":""}><span style={{width: w}} className="block rounded-full" /></td>
                ))}
              </tr>
            ))}
            {!list.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><KeyRound size={24}/></div>
                    <p className="empty-state-title">暂无账号</p>
                    <p className="empty-state-desc">点击右上角“新增”或“导入”开始添加账号。</p>
                  </div>
                </td>
              </tr>
            )}
            {items.map((item) => {
              const rowStatus = accountRowStatus(item);
              const enabled = item.status === 1;
              const isOAuth = item.auth_type === 'oauth';
              const check = testLabel(item.last_test_status);
              const CheckIcon = check.icon;
              const expire = expireState(item.access_token_expire_at);
              const lastError = (item.last_error || '').trim();
              const testError = (item.last_test_error || '').trim();
              const statusErrorText = [lastError, testError].filter(Boolean).join('\n\n');
              const needsAttention = isOAuth && (!item.has_access_token || item.last_test_status === 2 || !!testError);

              return (
                <tr key={item.id}>
                  <td className="sticky-l w-10">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`选择 ${item.name}`}
                    />
                  </td>
                  <td className="font-medium text-text-primary">
                    {item.name}
                    {item.remark && <span className="mt-0.5 block text-small text-text-tertiary">{item.remark}</span>}
                  </td>
                  <td className="font-semibold uppercase text-gia-500">{item.provider}</td>
                  <td className="whitespace-nowrap">
                    <span className={planTypeClass(item.plan_type)}>{planTypeLabel(item.plan_type)}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={TONE_CLS[rowStatus.tone]}>{rowStatus.label}</span>
                    {!!statusErrorText && (
                      <span className="ml-1 inline-flex align-middle text-danger" title={statusErrorText}>
                        <AlertCircle size={14} strokeWidth={2} />
                      </span>
                    )}
                  </td>
                  <td className="text-small">
                    {isOAuth ? (
                      <div className="flex flex-col gap-1">
                        <div className="inline-flex items-center gap-1">
                          <span className={`badge text-tiny ${item.has_refresh_token ? 'badge-success' : 'badge-warning'}`}>
                            RT {item.has_refresh_token ? '已存' : '缺失'}
                          </span>
                          <span className={`badge text-tiny ${item.has_access_token ? 'badge-success' : needsAttention ? 'badge-warning' : 'badge-outline'}`}>
                            AT {item.has_access_token ? '已取到' : '缺失'}
                          </span>
                        </div>
                        <div className={`inline-flex flex-wrap items-center gap-1 ${check.cls}`}>
                          <CheckIcon size={12} />
                          <span className="text-tiny">
                            {check.label}
                            {item.last_test_latency_ms ? ` / ${item.last_test_latency_ms}ms` : ''}
                          </span>
                          {item.last_test_at && <span className="text-tiny text-text-tertiary">{fmtRelative(item.last_test_at)}</span>}
                          {testError && (
                            <span className="inline-flex text-danger" title={item.last_test_error}>
                              <AlertCircle size={12} strokeWidth={2} />
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={`inline-flex flex-wrap items-center gap-1 ${check.cls}`}>
                        <CheckIcon size={12} />
                        <span className="text-tiny">
                          {check.label}
                          {item.last_test_latency_ms ? ` / ${item.last_test_latency_ms}ms` : ''}
                        </span>
                        {item.last_test_at && <span className="text-tiny text-text-tertiary">{fmtRelative(item.last_test_at)}</span>}
                        {testError && (
                          <span className="inline-flex text-danger" title={item.last_test_error}>
                            <AlertCircle size={12} strokeWidth={2} />
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-small">
                    {item.image_quota_total ? (
                      <span className="text-text-primary">
                        已用 {fmtNumber(Math.max(0, item.image_quota_total - (item.image_quota_remaining ?? 0)))} / {fmtNumber(item.image_quota_total)}
                      </span>
                    ) : typeof item.image_quota_remaining === 'number' ? (
                      <span className="text-text-secondary">剩余 {fmtNumber(item.image_quota_remaining)} / 总额未知</span>
                    ) : (
                      <span className="text-text-tertiary">未检测</span>
                    )}
                  </td>
                  <td className="text-small">
                    <div className="flex flex-col">
                      <span className={expire.cls}>{expire.label}</span>
                      <span className="text-tiny text-text-tertiary">{expire.detail}</span>
                    </div>
                  </td>
                  <td className="sticky-r">
                    <div className="inline-flex flex-wrap gap-1 justify-end">
                      <button
                        className="btn btn-outline btn-action-view btn-sm"
                        onClick={() => testMut.mutate(item.id)}
                        disabled={testMut.isPending && testMut.variables === item.id}
                      >
                        <Activity size={13} className={testMut.isPending && testMut.variables === item.id ? 'animate-pulse' : ''}/>
                        {testMut.isPending && testMut.variables === item.id ? '测试中' : '测试'}
                      </button>
                      {isOAuth && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => refreshOAuthMut.mutate(item.id)}
                          disabled={refreshOAuthMut.isPending && refreshOAuthMut.variables === item.id}
                        >
                          <RotateCw size={13} className={refreshOAuthMut.isPending && refreshOAuthMut.variables === item.id ? 'animate-spin' : ''}/>
                          刷新
                        </button>
                      )}
                      <button className="btn btn-outline btn-action-edit btn-sm" onClick={() => setEditTarget(item)}>
                        <Pencil size={13}/> 编辑
                      </button>
                      <button
                        className={`btn btn-sm btn-outline ${enabled ? 'btn-action-warn' : 'btn-action-view'}`}
                        onClick={() => toggleStatus.mutate({ id: item.id, status: enabled ? 0 : 1 })}
                      >
                        <Power size={13}/>{enabled ? '禁用' : '启用'}
                      </button>
                      <button
                        className="btn btn-outline btn-action-danger btn-sm"
                        onClick={() => {
                          if (!confirm(`确认删除账号"${item.name}"吗？`)) return;
                          remove.mutate(item.id);
                        }}
                      >
                        <Trash2 size={13}/> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>{/* end table-wrap */}

        {/* 吸底分页器 */}
        <div className="list-page-pager">
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}/>
            <span>共 <strong style={{color:'#6366f1'}}>{fmtNumber(total)}</strong> 条账号 · 第 <strong style={{color:'#374151'}}>{page}</strong> 页</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#9ca3af'}}>
              每页
              <select className="filter-select" style={{width:72}} value={pageSize} onChange={(e)=>{setPageSize(Number(e.target.value)||20);setPage(1);}}>
                {PAGE_SIZE_OPTIONS.map(s=><option key={s} value={s}>{s} 条</option>)}
              </select>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button className="btn btn-outline btn-icon btn-sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={13}/></button>
              <span style={{minWidth:'3rem',textAlign:'center',fontSize:12,color:'#374151'}}>{page} / {lastPage}</span>
              <button className="btn btn-outline btn-icon btn-sm" disabled={page>=lastPage} onClick={()=>setPage(p=>Math.min(lastPage,p+1))}><ChevronRight size={13}/></button>
            </div>
          </div>
        </div>
      </div>{/* end list-page-body */}

      {openCreate && (
        <CreateDialog
          onClose={() => setOpenCreate(false)}
          onSuccess={() => {
            setOpenCreate(false);
            refresh();
          }}
        />
      )}

      {openImport && (
        <ImportDialog
          onClose={() => setOpenImport(false)}
          onSuccess={() => {
            setOpenImport(false);
            refresh();
          }}
        />
      )}

      {openAssignProxy && (
        <BatchAssignProxyDialog
          accountIDs={selectedAccountIDs}
          selectedCount={selectedAccountIDs.length}
          onClose={() => setOpenAssignProxy(false)}
          onSubmit={(body) => batchAssignProxy.mutate(body)}
          submitting={batchAssignProxy.isPending}
        />
      )}

      {editTarget && (
        <EditDialog
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function CreateDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [body, setBody] = useState<AccountCreateBody>({
    provider: 'gpt',
    name: '',
    auth_type: 'oauth',
    access_token: '',
    refresh_token: '',
    session_token: '',
    client_id: '',
    credential: '',
    base_url: '',
    proxy_id: undefined,
    weight: 10,
    rpm_limit: 0,
    tpm_limit: 0,
    daily_quota: 0,
    monthly_quota: 0,
    remark: '',
  });

  const proxiesQ = useQuery({
    queryKey: ['admin', 'proxies', 'create-select'],
    queryFn: () => proxiesApi.list({ status: 1, page_size: 200 }),
    staleTime: 30_000,
  });

  const proxies = proxiesQ.data?.list ?? [];

  const create = useMutation({
    mutationFn: (payload: AccountCreateBody) => accountsApi.create(payload),
    onSuccess: () => {
      toast.success('账号已创建');
      onSuccess();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.name.trim()) {
      toast.error('请填写账号名称');
      return;
    }
    const isOAuth = body.auth_type === 'oauth';
    if (isOAuth) {
      if (!body.access_token?.trim() && !body.refresh_token?.trim() && !body.credential?.trim()) {
        toast.error('OAuth 账号至少填写 access_token、refresh_token 或 credential 之一');
        return;
      }
    } else if (!body.credential?.trim()) {
      toast.error('请填写凭证');
      return;
    }

    create.mutate({
      ...body,
      name: body.name.trim(),
      credential: body.credential?.trim() || undefined,
      access_token: body.access_token?.trim() || undefined,
      refresh_token: body.refresh_token?.trim() || undefined,
      session_token: body.session_token?.trim() || undefined,
      client_id: body.client_id?.trim() || undefined,
      base_url: normalizeBaseURL(body.base_url),
      proxy_id: body.proxy_id && body.proxy_id > 0 ? body.proxy_id : undefined,
      weight: body.weight || 10,
      rpm_limit: Math.max(0, body.rpm_limit || 0),
      tpm_limit: Math.max(0, body.tpm_limit || 0),
      daily_quota: Math.max(0, body.daily_quota || 0),
      monthly_quota: Math.max(0, body.monthly_quota || 0),
      remark: body.remark?.trim() || undefined,
    });
  };

  return (
    <Modal title="新增账号" subtitle="配置 GPT / GROK 账号凭证与策略" icon={<KeyRound size={20}/>} gradientCls="mhg-blue" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <select
              className="select"
              value={body.provider}
              onChange={(e) => {
                const nextProvider = e.target.value as 'gpt' | 'grok';
                setBody((prev) => ({ ...prev, provider: nextProvider, auth_type: defaultAuthType(nextProvider) }));
              }}
            >
              <option value="gpt">GPT</option>
              <option value="grok">GROK</option>
            </select>
          </Field>
          <Field label="认证类型">
            <select className="select" value={body.auth_type} onChange={(e) => setBody((prev) => ({ ...prev, auth_type: e.target.value as AuthType }))}>
              <option value="api_key">API Key</option>
              <option value="oauth">OAuth</option>
              <option value="cookie">Grok Token</option>
            </select>
          </Field>
        </div>

        <Field label="名称">
          <input className="input" value={body.name} onChange={(e) => setBody((prev) => ({ ...prev, name: e.target.value }))} />
        </Field>

        {body.auth_type === 'oauth' ? (
          <div className="space-y-3">
            <Field label="Access Token">
              <textarea className="textarea min-h-[72px] font-mono text-small" value={body.access_token || ''} onChange={(e) => setBody((prev) => ({ ...prev, access_token: e.target.value }))} />
            </Field>
            <Field label="Refresh Token">
              <textarea className="textarea min-h-[72px] font-mono text-small" value={body.refresh_token || ''} onChange={(e) => setBody((prev) => ({ ...prev, refresh_token: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Session Token">
                <input className="input font-mono text-small" value={body.session_token || ''} onChange={(e) => setBody((prev) => ({ ...prev, session_token: e.target.value }))} />
              </Field>
              <Field label="Client ID">
                <input className="input font-mono text-small" value={body.client_id || ''} onChange={(e) => setBody((prev) => ({ ...prev, client_id: e.target.value }))} />
              </Field>
            </div>
            <Field label="兼容 Credential">
              <input className="input font-mono text-small" value={body.credential || ''} onChange={(e) => setBody((prev) => ({ ...prev, credential: e.target.value }))} />
            </Field>
          </div>
        ) : (
          <Field label={body.auth_type === 'cookie' ? 'Grok Token' : 'API Key'}>
            <textarea className="textarea min-h-[96px] font-mono text-small" value={body.credential || ''} onChange={(e) => setBody((prev) => ({ ...prev, credential: e.target.value }))} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Base URL">
            <input className="input" value={body.base_url || ''} onChange={(e) => setBody((prev) => ({ ...prev, base_url: e.target.value }))} placeholder="可选" />
          </Field>
          <Field label="代理">
            <select
              className="select"
              value={body.proxy_id ?? 0}
              onChange={(e) => {
                const proxyID = Number(e.target.value) || 0;
                setBody((prev) => ({ ...prev, proxy_id: proxyID > 0 ? proxyID : undefined }));
              }}
            >
              <option value={0}>无</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="权重">
            <input type="number" className="input" min={1} max={1000} value={body.weight || ''} placeholder="10" onChange={(e) => setBody((prev) => ({ ...prev, weight: e.target.value === '' ? 10 : Math.max(1, Number(e.target.value)) }))} />
          </Field>
          <Field label="备注">
            <input className="input" value={body.remark || ''} onChange={(e) => setBody((prev) => ({ ...prev, remark: e.target.value }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="RPM">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.rpm_limit || ''} onChange={(e) => setBody((prev) => ({ ...prev, rpm_limit: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
          <Field label="TPM">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.tpm_limit || ''} onChange={(e) => setBody((prev) => ({ ...prev, tpm_limit: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="日额度">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.daily_quota || ''} onChange={(e) => setBody((prev) => ({ ...prev, daily_quota: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
          <Field label="月额度">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.monthly_quota || ''} onChange={(e) => setBody((prev) => ({ ...prev, monthly_quota: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary btn-md" disabled={create.isPending}>
            {create.isPending ? '提交中…' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [importMode, setImportMode] = useState<'lines' | 'sub2api'>('lines');
  const [body, setBody] = useState<AccountBatchImportBody>({
    provider: 'gpt',
    auth_type: 'oauth',
    base_url: '',
    proxy_id: undefined,
    weight: 10,
    text: '',
  });
  const [sub2Accounts, setSub2Accounts] = useState<Sub2APIAccountItem[] | null>(null);
  const [sub2FileLabel, setSub2FileLabel] = useState('');
  const [sub2Busy, setSub2Busy] = useState(false);
  const [sub2ChunkSize, setSub2ChunkSize] = useState(300);

  const proxiesQ = useQuery({
    queryKey: ['admin', 'proxies', 'import-select'],
    queryFn: () => proxiesApi.list({ status: 1, page_size: 200 }),
    staleTime: 30_000,
  });

  const proxies = proxiesQ.data?.list ?? [];

  const linePlaceholder = useMemo(() => {
    switch (body.auth_type) {
      case 'oauth':
        return '每行一个 refresh_token，或 name@@token';
      case 'cookie':
        return '每行一个 Grok Token，或 name@@token';
      default:
        return 'sk-xxxx 或 name@@sk-xxxx 或 key@https://example.com';
    }
  }, [body.auth_type]);

  const importLines = useMutation({
    mutationFn: (payload: AccountBatchImportBody) => accountsApi.batchImport(payload),
    onSuccess: (res) => {
      const parts = [
        `成功导入 ${res.imported} 条`,
        res.skipped ? `跳过 ${res.skipped} 条` : '',
        typeof res.detected === 'number' ? `已识别 ${res.detected} 条` : '',
        typeof res.pending === 'number' ? `待识别 ${res.pending} 条` : '',
        typeof res.failed === 'number' && res.failed > 0 ? `失败 ${res.failed} 条` : '',
      ].filter(Boolean);
      toast.success(parts.join('，'));
      onSuccess();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const runSub2Import = async () => {
    if (!sub2Accounts?.length) {
      toast.error('请先选择有效的 JSON 导入文件');
      return;
    }
    const chunkSize = Math.min(500, Math.max(50, sub2ChunkSize));
    setSub2Busy(true);
    let imported = 0;
    let skipped = 0;
    let detected = 0;
    let pending = 0;
    let failed = 0;
    try {
      for (let index = 0; index < sub2Accounts.length; index += chunkSize) {
        const slice = sub2Accounts.slice(index, index + chunkSize);
        const res = await accountsApi.batchImport({
          format: 'sub2api',
          provider: body.provider,
          base_url: normalizeBaseURL(body.base_url),
          proxy_id: body.proxy_id && body.proxy_id > 0 ? body.proxy_id : undefined,
          weight: body.weight || 10,
          accounts: slice,
        });
        imported += res.imported;
        skipped += res.skipped;
        detected += res.detected ?? 0;
        pending += res.pending ?? 0;
        failed += res.failed ?? 0;
      }
      const parts = [
        `导入 ${imported} 条`,
        skipped ? `跳过 ${skipped} 条` : '',
        detected ? `已识别 ${detected} 条` : '',
        pending ? `待识别 ${pending} 条` : '',
        failed ? `失败 ${failed} 条` : '',
      ].filter(Boolean);
      toast.success(parts.join('，'));
      onSuccess();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : '导入失败');
    } finally {
      setSub2Busy(false);
    }
  };

  return (
    <Modal title="批量导入账号" subtitle="从文件或文本批量添加账号" icon={<Upload size={20}/>} gradientCls="mhg-indigo" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn btn-sm ${importMode === 'lines' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setImportMode('lines')}>
            文本导入
          </button>
          <button type="button" className={`btn btn-sm ${importMode === 'sub2api' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setImportMode('sub2api')}>
            JSON 导入
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Provider">
            <select
              className="select select-sm"
              value={body.provider}
              onChange={(e) => {
                const provider = e.target.value as 'gpt' | 'grok';
                setBody((prev) => ({ ...prev, provider, auth_type: defaultAuthType(provider) }));
              }}
            >
              <option value="gpt">GPT</option>
              <option value="grok">GROK</option>
            </select>
          </Field>
          <Field label="认证类型">
            <select className="select select-sm" value={body.auth_type} onChange={(e) => setBody((prev) => ({ ...prev, auth_type: e.target.value as AuthType }))}>
              <option value="api_key">API Key</option>
              <option value="oauth">OAuth</option>
              <option value="cookie">Grok Token</option>
            </select>
          </Field>
          <Field label="默认代理">
            <select
              className="select select-sm"
              value={body.proxy_id ?? 0}
              onChange={(e) => {
                const proxyID = Number(e.target.value) || 0;
                setBody((prev) => ({ ...prev, proxy_id: proxyID > 0 ? proxyID : undefined }));
              }}
            >
              <option value={0}>无</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="权重">
            <input type="number" className="input input-sm" min={1} max={1000} value={body.weight || ''} placeholder="10" onChange={(e) => setBody((prev) => ({ ...prev, weight: e.target.value === '' ? 10 : Math.max(1, Number(e.target.value)) }))} />
          </Field>
        </div>

        <Field label="Base URL">
          <input className="input input-sm" value={body.base_url || ''} onChange={(e) => setBody((prev) => ({ ...prev, base_url: e.target.value }))} placeholder="可选" />
        </Field>

        {importMode === 'lines' ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.text?.trim()) {
                toast.error('请粘贴账号列表');
                return;
              }
              importLines.mutate({
                format: 'lines',
                provider: body.provider,
                auth_type: body.auth_type,
                base_url: normalizeBaseURL(body.base_url),
                proxy_id: body.proxy_id && body.proxy_id > 0 ? body.proxy_id : undefined,
                weight: body.weight || 10,
                text: body.text,
              });
            }}
          >
            <Field label="每行一条">
              <textarea
                className="textarea min-h-[180px] font-mono text-small"
                placeholder={linePlaceholder}
                value={body.text || ''}
                onChange={(e) => setBody((prev) => ({ ...prev, text: e.target.value }))}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary btn-md" disabled={importLines.isPending}>
                {importLines.isPending ? '导入中…' : '开始导入'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <Field label="JSON 文件">
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn btn-outline btn-sm cursor-pointer">
                  选择文件
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const accounts = parseSub2ExportJson(text);
                        setSub2Accounts(accounts);
                        setSub2FileLabel(`${file.name} / ${accounts.length} 条`);
                        toast.success(`已读取 ${accounts.length} 条账号`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : '文件解析失败');
                      }
                    }}
                  />
                </label>
                <span className="text-small text-text-tertiary">{sub2FileLabel || '未选择文件'}</span>
              </div>
            </Field>
            <Field label="每批数量">
              <input type="number" className="input input-sm w-[160px]" min={50} max={500} value={sub2ChunkSize} onChange={(e) => setSub2ChunkSize(Math.min(500, Math.max(50, Number(e.target.value) || 300)))} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-md" onClick={() => void runSub2Import()} disabled={sub2Busy}>
                {sub2Busy ? '导入中…' : '开始导入'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function BatchAssignProxyDialog({
  accountIDs,
  selectedCount,
  onClose,
  onSubmit,
  submitting,
}: {
  accountIDs: number[];
  selectedCount: number;
  onClose: () => void;
  onSubmit: (body: AccountBatchAssignProxyBody) => void;
  submitting: boolean;
}) {
  const [mode, setMode] = useState<'single' | 'cycle'>('single');
  const [proxyID, setProxyID] = useState(0);
  const [proxyIDs, setProxyIDs] = useState<number[]>([]);

  const proxiesQ = useQuery({
    queryKey: ['admin', 'proxies', 'assign-select'],
    queryFn: () => proxiesApi.list({ status: 1, page_size: 200 }),
    staleTime: 30_000,
  });

  const proxies = proxiesQ.data?.list ?? [];

  const toggleCycleProxy = (id: number) => {
    setProxyIDs((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
  };

  const submit = () => {
    if (accountIDs.length === 0) {
      toast.error('请先选择 Token');
      return;
    }
    if (mode === 'single') {
      if (!proxyID) {
        toast.error('请选择一个代理');
        return;
      }
      onSubmit({ mode, account_ids: accountIDs, proxy_id: proxyID });
      return;
    }
    if (proxyIDs.length === 0) {
      toast.error('请至少选择一个代理');
      return;
    }
    onSubmit({ mode, account_ids: accountIDs, proxy_ids: proxyIDs });
  };

  return (
    <Modal title="批量设置代理" subtitle={`为 ${selectedCount} 个账号统一绑定代理`} icon={<ChevronDown size={20}/>} gradientCls="mhg-teal" onClose={onClose}>
      <div className="space-y-4">
        <div className="card card-flat p-3 text-small text-text-secondary">
          已选择 <span className="font-medium text-text-primary">{selectedCount}</span> 个 Token。
          单代理模式会全部绑定同一个代理，循环模式会按你勾选的代理顺序轮流分配。
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn btn-sm ${mode === 'single' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('single')}>
            单代理批量绑定
          </button>
          <button type="button" className={`btn btn-sm ${mode === 'cycle' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('cycle')}>
            循环分配代理
          </button>
        </div>

        {proxiesQ.isLoading ? (
          <div className="text-small text-text-tertiary">正在加载代理列表…</div>
        ) : proxies.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">没有可用代理</p>
            <p className="empty-state-desc">请先在代理管理中启用至少一个代理。</p>
          </div>
        ) : mode === 'single' ? (
          <Field label="选择代理">
            <select className="select" value={proxyID} onChange={(e) => setProxyID(Number(e.target.value) || 0)}>
              <option value={0}>请选择</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.name} / {proxy.host}:{proxy.port}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="space-y-2">
            <div className="text-small text-text-secondary">
              当前顺序：
              {proxyIDs.length > 0
                ? ` ${proxyIDs.map((id) => proxies.find((proxy) => proxy.id === id)?.name || `#${id}`).join(' → ')}`
                : ' 暂无'}
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-lg border border-border p-3">
              {proxies.map((proxy) => (
                <label key={proxy.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block text-small font-medium text-text-primary">{proxy.name}</span>
                    <span className="block text-tiny text-text-tertiary">
                      {proxy.protocol} / {proxy.host}:{proxy.port}
                    </span>
                  </span>
                  <input type="checkbox" className="rounded border-border" checked={proxyIDs.includes(proxy.id)} onChange={() => toggleCycleProxy(proxy.id)} />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary btn-md" onClick={submit} disabled={submitting || proxiesQ.isLoading || proxies.length === 0}>
            {submitting ? '保存中…' : '确认分配'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditDialog({
  item,
  onClose,
  onSuccess,
}: {
  item: AccountItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [body, setBody] = useState<AccountUpdateBody>({
    name: item.name,
    credential: '',
    access_token: '',
    refresh_token: '',
    session_token: '',
    client_id: '',
    base_url: item.base_url || '',
    proxy_id: item.proxy_id || 0,
    weight: item.weight,
    rpm_limit: item.rpm_limit,
    tpm_limit: item.tpm_limit,
    daily_quota: item.daily_quota,
    monthly_quota: item.monthly_quota,
    remark: item.remark || '',
  });

  const isOAuth = item.auth_type === 'oauth';

  const proxiesQ = useQuery({
    queryKey: ['admin', 'proxies', 'edit-select'],
    queryFn: () => proxiesApi.list({ status: 1, page_size: 200 }),
    staleTime: 30_000,
  });

  const secretsQ = useQuery({
    queryKey: ['admin', 'accounts', item.id, 'secrets'],
    queryFn: () => accountsApi.secrets(item.id),
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    const secrets = secretsQ.data;
    if (!secrets) return;
    setBody((prev) => ({
      ...prev,
      credential: secrets.credential || '',
      access_token: secrets.access_token || '',
      refresh_token: secrets.refresh_token || '',
      session_token: secrets.session_token || '',
      client_id: secrets.client_id || '',
    }));
  }, [secretsQ.data]);

  const proxies = proxiesQ.data?.list ?? [];

  const update = useMutation({
    mutationFn: (payload: AccountUpdateBody) => accountsApi.update(item.id, payload),
    onSuccess: () => {
      toast.success('账号已更新');
      onSuccess();
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.name?.trim()) {
      toast.error('请填写账号名称');
      return;
    }
    update.mutate({
      ...body,
      name: body.name.trim(),
      credential: body.credential?.trim() || undefined,
      access_token: body.access_token?.trim() || undefined,
      refresh_token: body.refresh_token?.trim() || undefined,
      session_token: body.session_token?.trim() || undefined,
      client_id: body.client_id?.trim() || undefined,
      base_url: normalizeBaseURL(body.base_url),
      proxy_id: body.proxy_id && body.proxy_id > 0 ? body.proxy_id : 0,
      weight: body.weight || 10,
      rpm_limit: Math.max(0, body.rpm_limit || 0),
      tpm_limit: Math.max(0, body.tpm_limit || 0),
      daily_quota: Math.max(0, body.daily_quota || 0),
      monthly_quota: Math.max(0, body.monthly_quota || 0),
      remark: body.remark?.trim() || '',
    });
  };

  return (
    <Modal title={`编辑账号 · ${item.name}`} subtitle="修改凭证、额度与代理设置" icon={<Pencil size={20}/>} gradientCls="mhg-violet" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider">
            <input className="input bg-bg-elevated text-text-secondary" value={item.provider.toUpperCase()} readOnly disabled />
          </Field>
          <Field label="名称">
            <input className="input" value={body.name || ''} onChange={(e) => setBody((prev) => ({ ...prev, name: e.target.value }))} />
          </Field>
        </div>

        {isOAuth ? (
          <div className="space-y-3">
            <Field label="Access Token" hint={secretsQ.isLoading ? '正在读取已存凭证…' : undefined}>
              <textarea className="textarea min-h-[72px] font-mono text-small" value={body.access_token || ''} onChange={(e) => setBody((prev) => ({ ...prev, access_token: e.target.value }))} />
            </Field>
            <Field label="Refresh Token">
              <textarea className="textarea min-h-[72px] font-mono text-small" value={body.refresh_token || ''} onChange={(e) => setBody((prev) => ({ ...prev, refresh_token: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Session Token">
                <input className="input font-mono text-small" value={body.session_token || ''} onChange={(e) => setBody((prev) => ({ ...prev, session_token: e.target.value }))} />
              </Field>
              <Field label="Client ID">
                <input className="input font-mono text-small" value={body.client_id || ''} onChange={(e) => setBody((prev) => ({ ...prev, client_id: e.target.value }))} />
              </Field>
            </div>
          </div>
        ) : (
          <Field label={item.auth_type === 'cookie' ? 'Grok Token' : 'API Key'} hint={secretsQ.isLoading ? '正在读取已存凭证…' : undefined}>
            <textarea className="textarea min-h-[96px] font-mono text-small" value={body.credential || ''} onChange={(e) => setBody((prev) => ({ ...prev, credential: e.target.value }))} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Base URL">
            <input className="input" value={body.base_url || ''} onChange={(e) => setBody((prev) => ({ ...prev, base_url: e.target.value }))} placeholder="可选" />
          </Field>
          <Field label="代理">
            <select
              className="select"
              value={body.proxy_id ?? 0}
              onChange={(e) => {
                const proxyID = Number(e.target.value) || 0;
                setBody((prev) => ({ ...prev, proxy_id: proxyID > 0 ? proxyID : 0 }));
              }}
            >
              <option value={0}>无</option>
              {proxies.map((proxy) => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="权重">
            <input type="number" className="input" min={1} max={1000} value={body.weight || ''} placeholder="10" onChange={(e) => setBody((prev) => ({ ...prev, weight: e.target.value === '' ? 10 : Math.max(1, Number(e.target.value)) }))} />
          </Field>
          <Field label="备注">
            <input className="input" value={body.remark || ''} onChange={(e) => setBody((prev) => ({ ...prev, remark: e.target.value }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="RPM">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.rpm_limit || ''} onChange={(e) => setBody((prev) => ({ ...prev, rpm_limit: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
          <Field label="TPM">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.tpm_limit || ''} onChange={(e) => setBody((prev) => ({ ...prev, tpm_limit: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="日额度">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.daily_quota || ''} onChange={(e) => setBody((prev) => ({ ...prev, daily_quota: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
          <Field label="月额度">
            <input type="number" className="input" min={0} placeholder="0 (不限)" value={body.monthly_quota || ''} onChange={(e) => setBody((prev) => ({ ...prev, monthly_quota: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) }))} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-outline btn-md" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary btn-md" disabled={update.isPending}>
            {update.isPending ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  subtitle,
  icon,
  gradientCls = 'mhg-blue',
  onClose,
  wide,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  gradientCls?: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        className={`dialog-surface w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} gia-fade-in flex flex-col max-h-[88vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-header-grad ${gradientCls}`}>
          <div className="flex items-center gap-3 min-w-0">
            {icon && <div className="modal-icon">{icon}</div>}
            <div className="min-w-0">
              <h3>{title}</h3>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭"><X size={16}/></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${className || ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
