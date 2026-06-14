import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ChevronDown, ChevronLeft, ChevronRight, Clock, Coins, Eye,
  ImageIcon, Key, MessageSquare, RefreshCw, Search, Settings2, Signal, Tag, Trash2, User, Video, X,
} from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

import { ApiError } from '../../lib/api';
import { fmtPoints, fmtTime } from '../../lib/format';
import { logsApi } from '../../lib/services';
import type { AdminGenerationLogItem, AdminGenerationUpstreamLogItem } from '../../lib/types';
import { toast } from '../../stores/toast';

const pageSize = 20;

function statusInfo(s: number): { label: string; cls: string } {
  switch (s) {
    case 0:
      return { label: '待处理', cls: 'badge badge-outline' };
    case 1:
      return { label: '生成中', cls: 'badge badge-warning' };
    case 2:
      return { label: '成功', cls: 'badge badge-success' };
    case 3:
      return { label: '失败', cls: 'badge badge-danger' };
    case 4:
      return { label: '已退款', cls: 'badge badge-warning' };
    default:
      return { label: String(s), cls: 'badge badge-outline' };
  }
}

function kindInfo(kind: string) {
  if (kind === 'video') return { label: '视频', icon: Video };
  if (kind === 'chat' || kind === 'text') return { label: '文字', icon: MessageSquare };
  return { label: '图片', icon: ImageIcon };
}

function fmtDuration(ms?: number): string {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

function Preview({ row }: { row: AdminGenerationLogItem }) {
  if (!row.preview_url) return <span className="text-text-tertiary">-</span>;
  if (row.kind === 'video') {
    return (
      <a className="btn btn-ghost btn-sm" href={row.preview_url} target="_blank" rel="noreferrer">
        <Video size={14} /> 查看
      </a>
    );
  }
  return (
    <a
      href={row.preview_url}
      target="_blank"
      rel="noreferrer"
      className="block h-10 w-10 overflow-hidden rounded-md border border-border bg-surface-2"
    >
      <img src={row.preview_url} alt="" className="h-full w-full object-cover" />
    </a>
  );
}

export default function LogsPage() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [kind, setKind] = useState<'all' | 'image' | 'video' | 'chat'>('all');
  const [status, setStatus] = useState<'all' | '0' | '1' | '2' | '3' | '4'>('all');
  const [page, setPage] = useState(1);
  const [purgeDays, setPurgeDays] = useState('30');
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [upstreamTask, setUpstreamTask] = useState<AdminGenerationLogItem | null>(null);

  const query = useMemo(
    () => ({
      keyword: keyword.trim() || undefined,
      kind: kind === 'all' ? undefined : kind,
      status: status === 'all' ? undefined : (Number(status) as 0 | 1 | 2 | 3 | 4),
      page,
      page_size: pageSize,
    }),
    [keyword, kind, status, page],
  );

  const list = useQuery({
    queryKey: ['admin', 'logs', 'generations', query],
    queryFn: () => logsApi.generations(query),
  });

  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const purgeDayNum = Math.max(1, Math.floor(Number(purgeDays) || 0));

  const purge = useMutation({
    mutationFn: () => logsApi.purgeGenerations(purgeDayNum),
    onSuccess: (r) => {
      toast.success(`已删除 ${purgeDayNum} 天前的 ${r.deleted} 条请求日志`);
      setConfirmPurge(false);
      setPage(1);
      qc.invalidateQueries({ queryKey: ['admin', 'logs'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const successCount = (list.data?.list ?? []).filter(r=>r.status===2).length;
  const failCount    = (list.data?.list ?? []).filter(r=>r.status===3).length;

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#f43f5e,#ec4899)',boxShadow:'0 4px 14px rgba(244,63,94,.35)'}}>
            <Eye size={16}/>
          </div>
          <div>
            <div className="list-page-title">请求日志</div>
            <div className="list-page-subtitle">按任务查看用户、模型、状态与费用；提示词、错误和上游返回收进详情行</div>
          </div>
          <div className="list-divider"/>
          <div className="flex flex-wrap gap-1.5">
            <span className="stat-pill stat-pill-blue"><span className="stat-pill-dot"/><span className="stat-pill-label">总记录</span><span className="stat-pill-val">{total}</span></span>
            <span className="stat-pill stat-pill-green"><span className="stat-pill-dot"/><span className="stat-pill-label">成功</span><span className="stat-pill-val">{successCount}</span></span>
            <span className="stat-pill stat-pill-red"><span className="stat-pill-dot"/><span className="stat-pill-label">失败</span><span className="stat-pill-val">{failCount}</span></span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <div className="purge-widget">
              <span className="purge-widget-label">清除</span>
              <input
                value={purgeDays} inputMode="numeric"
                onChange={(e) => setPurgeDays(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <span className="purge-widget-label">天前</span>
              <button className="btn btn-danger btn-sm !h-6 !px-2" disabled={purge.isPending || purgeDayNum <= 0} onClick={() => setConfirmPurge(true)}>
                <Trash2 size={12}/>
              </button>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'logs'] })}>
              <RefreshCw size={13}/> 刷新
            </button>
          </div>
        </div>
        <div className="list-page-filter-row">
          <div className="search-wrap">
            <Search size={13}/>
            <input className="filter-input" style={{width:240}} placeholder="搜索用户 / Key / 模型 / 提示词 / task_id"
              value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
          </div>
          <div className="tabs">
            {[['all','全部'],['chat','文字'],['image','图片'],['video','视频']].map(([k,label]) => (
              <button key={k} className="tab" aria-selected={kind===k} onClick={() => { setKind(k as typeof kind); setPage(1); }}>{label}</button>
            ))}
          </div>
          <select className="filter-select" style={{minWidth:100}} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
            <option value="all">全部状态</option>
            <option value="0">待处理</option>
            <option value="1">生成中</option>
            <option value="2">成功</option>
            <option value="3">失败</option>
            <option value="4">已退款</option>
          </select>
          <div className="ml-auto filter-count">共 <strong>{total}</strong> 条</div>
        </div>
      </div>

      <div className="list-page-body">
        <div className="table-wrap">
        <table className="data-table text-small min-w-[960px]">
          <thead>
            <tr>
              <th className="sticky-l w-[42px]" />
              <th className="w-[150px]"><span className="th-icon"><Clock size={13}/>时间</span></th>
              <th className="w-[150px]"><span className="th-icon"><User size={13}/>用户</span></th>
              <th className="w-[140px]"><span className="th-icon"><Key size={13}/>Key</span></th>
              <th className="w-[160px]"><span className="th-icon"><Tag size={13}/>模型</span></th>
              <th className="w-[88px]"><span className="th-icon"><Signal size={13}/>状态</span></th>
              <th className="w-[80px]"><span className="th-icon"><Activity size={13}/>耗时</span></th>
              <th className="w-[80px]"><span className="th-icon"><Coins size={13}/>费用</span></th>
              <th className="w-[80px]"><span className="th-icon"><Eye size={13}/>预览</span></th>
              <th className="sticky-r w-[110px]"><span className="th-icon"><Settings2 size={13}/>上游</span></th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="table-skeleton">
                {[42, 150, 150, 140, 160, 88, 80, 80, 80, 110].map((w, j) => (
                  <td key={j} className={j === 0 ? 'sticky-l' : j === 9 ? 'sticky-r' : ''}>
                    {j === 1 ? (
                      <div className="skeleton-stack">
                        <span style={{ width: w }} />
                        <span style={{ width: 100 }} />
                      </div>
                    ) : (
                      <span style={{ width: w }} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!list.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-icon" style={{ background: 'rgba(244,63,94,.08)', color: '#f43f5e' }}>
                      <Eye size={24} />
                    </div>
                    <p className="empty-state-title">暂无生成记录</p>
                    <p className="empty-state-desc">调整筛选条件，或等待用户发起新的生成任务。</p>
                  </div>
                </td>
              </tr>
            )}
            {items.map((row) => {
              const st = statusInfo(row.status);
              const ki = kindInfo(row.kind);
              const KindIcon = ki.icon;
              const isOpen = expanded === row.task_id;
              return (
                <Fragment key={row.task_id}>
                  <tr className={`align-middle ${isOpen ? 'table-row-expanded' : ''}`}>
                    <td className="sticky-l">
                      <button
                        className="btn btn-outline btn-sm gap-1"
                        onClick={() => setExpanded(isOpen ? null : row.task_id)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                        {isOpen ? '收起' : '详情'}
                      </button>
                    </td>
                    <td className="whitespace-nowrap">
                      <div>{fmtTime(row.created_at)}</div>
                      <div className="truncate text-tiny text-text-tertiary">{row.task_id}</div>
                    </td>
                    <td>
                      <div className="truncate">{row.user_label}</div>
                      <div className="text-tiny text-text-tertiary">UID {row.user_id}</div>
                    </td>
                    <td className="truncate" title={row.key_label || '-'}>
                      {row.key_label || '-'}
                    </td>
                    <td>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <KindIcon size={14} className="shrink-0 text-text-tertiary" />
                        <span className="truncate" title={row.model_code}>{row.model_code}</span>
                      </div>
                    </td>
                    <td><span className={st.cls}>{st.label}</span></td>
                    <td>{fmtDuration(row.duration_ms)}</td>
                    <td>{fmtPoints(row.cost_points)}</td>
                    <td><Preview row={row} /></td>
                    <td className="sticky-r">
                      <button className="btn btn-outline btn-action-view btn-sm" onClick={() => setUpstreamTask(row)}>
                        <Eye size={14} /> 日志
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="table-row-detail">
                      <td colSpan={10}>
                        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr]">
                          <DetailBlock title="提示词" value={row.prompt || '-'} />
                          <DetailBlock title="错误信息" value={row.error || '-'} danger={Boolean(row.error)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
        <div className="list-page-pager">
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'linear-gradient(135deg,#f43f5e,#ec4899)'}}/>
            <span>共 <strong style={{color:'#f43f5e'}}>{total}</strong> 条记录 · 第 <strong style={{color:'#374151'}}>{page}</strong> 页</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="btn btn-outline btn-sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={13}/> 上一页</button>
            <span style={{fontSize:12,color:'#374151'}}>{page} / {lastPage}</span>
            <button className="btn btn-outline btn-sm" disabled={page>=lastPage} onClick={()=>setPage(p=>Math.min(lastPage,p+1))}>下一页 <ChevronRight size={13}/></button>
          </div>
        </div>
      </div>

      {upstreamTask && <UpstreamDialog task={upstreamTask} onClose={() => setUpstreamTask(null)} />}
      {confirmPurge && (
        <ConfirmDialog
          days={purgeDayNum}
          loading={purge.isPending}
          onClose={() => setConfirmPurge(false)}
          onConfirm={() => purge.mutate()}
        />
      )}
    </div>
  );
}

function DetailBlock({ title, value, danger }: { title: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3">
      <div className="mb-2 text-tiny text-text-tertiary">{title}</div>
      <div className={`max-h-36 overflow-auto whitespace-pre-wrap break-words text-small leading-relaxed ${danger ? 'text-danger' : 'text-text-secondary'}`}>
        {value}
      </div>
    </div>
  );
}

function UpstreamDialog({ task, onClose }: { task: AdminGenerationLogItem; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['admin', 'logs', 'generations', task.task_id, 'upstream'],
    queryFn: () => logsApi.generationUpstream(task.task_id),
  });
  const rows = q.data ?? [];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
      <div className="dialog-surface gia-fade-in max-h-[86vh] w-full max-w-5xl overflow-hidden">
        <div className="modal-header-grad mhg-indigo">
          <div className="flex items-center gap-3 min-w-0">
            <div className="modal-icon"><Eye size={20}/></div>
            <div className="min-w-0">
              <h3>上游日志</h3>
              <p>{task.task_id} · {task.model_code}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body max-h-[70vh] space-y-3 overflow-auto">
          {q.isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-surface-1 p-3 space-y-2">
                  <div className="skeleton skeleton-text" style={{ width: '30%' }} />
                  <div className="skeleton" style={{ height: 48 }} />
                </div>
              ))}
            </div>
          )}
          {!q.isLoading && rows.length === 0 && (
            <div className="empty-state-compact">
              <div className="empty-state-icon" style={{ background: 'rgba(99,102,241,.08)', color: '#6366f1' }}>
                <Eye size={20} />
              </div>
              <p className="empty-state-title">暂无上游日志</p>
              <p className="empty-state-desc">新任务会自动记录上游请求与响应。</p>
            </div>
          )}
          {rows.map((row) => <UpstreamRow key={row.id} row={row} />)}
        </div>
      </div>
    </div>
  );
}

function UpstreamRow({ row }: { row: AdminGenerationUpstreamLogItem }) {
  return (
    <section className="rounded-xl border border-border bg-surface-1 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-outline">{row.stage}</span>
          {row.method && <span className="text-small text-text-tertiary">{row.method}</span>}
          {row.status_code > 0 && <span className="text-small text-text-tertiary">HTTP {row.status_code}</span>}
          {row.duration_ms > 0 && <span className="text-small text-text-tertiary">{fmtDuration(row.duration_ms)}</span>}
        </div>
        <span className="text-tiny text-text-tertiary">{fmtTime(row.created_at)}</span>
      </div>
      {row.url && <div className="mt-2 break-all text-tiny text-text-tertiary">{row.url}</div>}
      <LogBlock title="请求" value={row.request_excerpt} />
      <LogBlock title="响应" value={row.response_excerpt} />
      <LogBlock title="错误" value={row.error} danger />
      <LogBlock title="附加信息" value={prettyMeta(row.meta)} />
    </section>
  );
}

function LogBlock({ title, value, danger }: { title: string; value?: string; danger?: boolean }) {
  if (!value) return null;
  return (
    <div className="mt-3">
      <div className="mb-1 text-tiny text-text-tertiary">{title}</div>
      <pre className={`max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-2 p-3 text-tiny ${danger ? 'text-danger' : 'text-text-secondary'}`}>
        {value}
      </pre>
    </div>
  );
}

function ConfirmDialog({ days, loading, onClose, onConfirm }: { days: number; loading: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="dialog-surface gia-fade-in w-full max-w-md flex flex-col" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header-grad mhg-rose">
          <div className="flex items-center gap-3">
            <div className="modal-icon"><Trash2 size={20}/></div>
            <div>
              <h3>确认删除日志</h3>
              <p>删除 {days} 天前的所有请求记录</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-small text-danger">
            该操作不可恢复，请谨慎操作。
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline btn-md" disabled={loading} onClick={onClose}>取消</button>
          <button className="btn btn-danger btn-md" disabled={loading} onClick={onConfirm}>
            {loading ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}

function prettyMeta(v?: string) {
  if (!v) return '';
  try {
    return JSON.stringify(JSON.parse(v), null, 2);
  } catch {
    return v;
  }
}
