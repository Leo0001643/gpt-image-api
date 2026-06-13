import { useQuery } from '@tanstack/react-query';
import {
  Activity, ArrowUpRight, BarChart2, Coins, Image,
  KeyRound, RefreshCw, ShieldCheck, Sparkles, TrendingUp,
  Users, Video, Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { dashboardApi } from '../../lib/services';
import type { DashboardProviderRow, DashboardRecentTask, DashboardTrendPoint } from '../../lib/types';
import { fmtNumber, fmtPoints, fmtTime } from '../../lib/format';

export default function DashboardPage() {
  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'dashboard', 'overview'],
    queryFn: () => dashboardApi.overview(),
    refetchInterval: 15_000,
  });

  const providers        = data?.account_providers ?? [];
  const totalAccounts    = providers.reduce((s, r) => s + r.total, 0);
  const availableAccounts = providers.reduce((s, r) => s + r.available, 0);
  const quotaRemaining   = providers.reduce((s, r) => s + r.quota_remaining, 0);
  const quotaTotal       = providers.reduce((s, r) => s + r.quota_total, 0);
  const quotaUsed        = Math.max(0, quotaTotal - quotaRemaining);

  return (
    <div className="list-page">

      {/* ── sticky header ────────────────────────────── */}
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#6366f1,#4f46e5)',boxShadow:'0 4px 14px rgba(99,102,241,.35)'}}>
            <Activity size={16}/>
          </div>
          <div>
            <div className="list-page-title">运营仪表盘</div>
            <div className="list-page-subtitle">实时追踪生成量、账号池状态、积分消耗与用户活跃</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {isFetching
              ? <span className="text-tiny text-gia-500 animate-pulse font-medium">刷新中…</span>
              : <span className="text-tiny text-text-tertiary">每 15 秒自动刷新</span>
            }
            <button className="btn btn-outline btn-sm gap-1.5" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              手动刷新
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white px-6 pt-5 pb-8 space-y-5">

        {/* ── Row 1: Quick-stat cards ───────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<Users size={18}/>}
            iconCls="bg-violet-100 text-violet-600"
            label="注册用户"
            value={fmtNumber(data?.users_total)}
            sub={`今日新增 +${fmtNumber(data?.users_today)}`}
            trend="up"
          />
          <StatCard
            icon={<Coins size={18}/>}
            iconCls="bg-amber-100 text-amber-600"
            label="今日积分消耗"
            value={fmtPoints(data?.cost_points_today)}
            sub={`累计 ${fmtPoints(data?.cost_points_total)}`}
            trend="neutral"
          />
          <StatCard
            icon={<Image size={18}/>}
            iconCls="bg-blue-100 text-blue-600"
            label="图片产出"
            value={fmtNumber(data?.image_today)}
            sub={`累计 ${fmtNumber(data?.image_total)} 张`}
            trend="up"
          />
          <StatCard
            icon={<Video size={18}/>}
            iconCls="bg-orange-100 text-orange-600"
            label="视频产出"
            value={fmtNumber(data?.video_today)}
            sub={`累计 ${fmtNumber(data?.video_total)} 个`}
            trend="up"
          />
        </div>

        {/* ── Row 2: Hero + KPI ─────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-[1fr_300px]">

          {/* hero gradient card */}
          <div className="relative overflow-hidden rounded-2xl bg-gia-gradient p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/8" />
            <div className="pointer-events-none absolute -bottom-8 left-1/3 h-40 w-40 rounded-full bg-white/6" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white/75 text-small">
                    <Zap size={13} className="fill-white/60" />
                    今日生成任务
                  </div>
                  <div className="mt-2 text-[64px] font-extrabold leading-none tabular-nums tracking-tight">
                    {isLoading ? '—' : fmtNumber(data?.generated_today)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-small">
                    <Tag text={`累计 ${fmtNumber(data?.generated_total)}`} />
                    <Tag text={`成功率 ${percent(data?.success_rate_today)}`} />
                    <Tag text={`活跃用户 ${fmtNumber(data?.active_users_today)}`} />
                  </div>
                </div>
                <div className="shrink-0 hidden sm:flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-tiny font-medium">
                    <ArrowUpRight size={12} />
                    实时监控
                  </div>
                  <div className="mt-2 text-tiny text-white/60">每 15 秒刷新</div>
                </div>
              </div>

              {/* sub metrics */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                <SubMetric label="图片" value={fmtNumber(data?.image_today)} sub={`总 ${fmtNumber(data?.image_total)}`} icon={<Image size={15}/>} />
                <SubMetric label="视频" value={fmtNumber(data?.video_today)} sub={`总 ${fmtNumber(data?.video_total)}`} icon={<Video size={15}/>} />
                <SubMetric label="Token" value={compact(data?.text_tokens_today)} sub={`总 ${compact(data?.text_tokens_total)}`} icon={<Sparkles size={15}/>} />
              </div>
            </div>
          </div>

          {/* right KPI column */}
          <div className="flex flex-col gap-3">
            <KpiCard
              icon={<KeyRound size={18} />}
              iconCls="bg-blue-100 text-blue-600"
              label="账号池状态"
              value={`${fmtNumber(availableAccounts)} / ${fmtNumber(totalAccounts)}`}
              sub="可用 / 总量"
              ratio={totalAccounts > 0 ? availableAccounts / totalAccounts : 0}
              ratioColor="bg-blue-500"
            />
            <KpiCard
              icon={<ShieldCheck size={18} />}
              iconCls="bg-emerald-100 text-emerald-600"
              label="剩余 API 额度"
              value={fmtNumber(quotaRemaining)}
              sub={quotaTotal > 0 ? `已用 ${fmtNumber(quotaUsed)}` : '等待探测'}
              ratio={quotaTotal > 0 ? quotaRemaining / quotaTotal : 0}
              ratioColor="bg-emerald-500"
            />
            <KpiCard
              icon={<Coins size={18} />}
              iconCls="bg-amber-100 text-amber-600"
              label="今日消耗积分"
              value={fmtPoints(data?.wallet_spend_today)}
              sub={`累计 ${fmtPoints(data?.wallet_spend_total)}`}
            />
          </div>
        </div>

        {/* ── Row 3: Trend chart (dedicated full-width row) ── */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-50 text-indigo-600">
                <TrendingUp size={15}/>
              </span>
              <h2 className="text-[14px] font-semibold text-text-primary">近 7 天生成趋势</h2>
            </div>
            <div className="flex items-center gap-4 text-tiny text-text-tertiary">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-6 rounded-full bg-indigo-500"/>生成量
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-2 w-6 rounded-full bg-amber-400"/>积分消耗
              </span>
            </div>
          </div>
          <div className="px-5 py-4">
            <TrendChartLight points={data?.trend ?? []} loading={isLoading} />
          </div>
        </div>

        {/* ── Row 4: Provider status + Recent tasks ──────── */}
        <div className="grid gap-4 xl:grid-cols-2">

          {/* providers */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-50 text-blue-600"><BarChart2 size={15}/></span>
                <h2 className="text-[14px] font-semibold text-text-primary">账号池与额度</h2>
              </div>
              <span className="badge badge-outline text-[11px]">每 15s 刷新</span>
            </div>
            <div className="divide-y divide-border">
              {providers.map((row) => <ProviderRow key={row.provider} row={row} />)}
              {providers.length === 0 && <div className="py-12 text-center text-small text-text-tertiary">暂无账号池数据</div>}
            </div>
          </div>

          {/* recent generations */}
          <div className="card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-rose-50 text-rose-500"><Activity size={15}/></span>
                <h2 className="text-[14px] font-semibold text-text-primary">最近生成任务</h2>
              </div>
              <span className="text-tiny text-text-tertiary">最新 8 条</span>
            </div>
            <div className="divide-y divide-border">
              {(data?.recent_generations ?? []).map((row) => <RecentRow key={row.task_id} row={row} />)}
              {(data?.recent_generations ?? []).length === 0 && <div className="py-12 text-center text-small text-text-tertiary">暂无生成记录</div>}
            </div>
          </div>
        </div>

      </div>{/* end bg-white content */}
    </div>
  );
}

/* ── Sub components ─────────────────────────────── */

function Tag({ text }: { text: string }) {
  return <span className="rounded-lg bg-white/15 px-2.5 py-1 text-small backdrop-blur-sm">{text}</span>;
}

function SubMetric({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/12 p-3.5 backdrop-blur-sm">
      <div className="flex items-center justify-between text-white/70 text-tiny mb-2">
        <span>{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="text-[26px] font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 text-tiny text-white/60">{sub}</div>
    </div>
  );
}

function TrendChartLight({ points, loading }: { points: DashboardTrendPoint[]; loading?: boolean }) {
  const rows  = points.length > 0 ? points : Array.from({ length: 7 }, (_, i) => ({ date: `D${i+1}`, generated: 0, cost_points: 0 }));
  const W = 880, H = 140, padX = 20, padY = 16;
  const maxG  = Math.max(1, ...rows.map((p) => p.generated));
  const maxC  = Math.max(1, ...rows.map((p) => p.cost_points));
  const step  = (W - padX * 2) / Math.max(1, rows.length - 1);
  const yG    = (v: number) => H - padY - (v / maxG) * (H - padY * 2);
  const yC    = (v: number) => H - padY - (v / maxC) * (H - padY * 2);
  const lineG = rows.map((p, i) => `${padX + i * step},${yG(p.generated)}`).join(' ');
  const lineC = rows.map((p, i) => `${padX + i * step},${yC(p.cost_points)}`).join(' ');
  const areaG = `${padX},${H - padY} ${lineG} ${W - padX},${H - padY}`;
  const areaC = `${padX},${H - padY} ${lineC} ${W - padX},${H - padY}`;

  if (loading) return <div className="h-[140px] animate-pulse rounded-xl bg-surface-2" />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[140px] w-full overflow-visible">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={padX} x2={W - padX}
          y1={padY + i * ((H - padY * 2) / 3)} y2={padY + i * ((H - padY * 2) / 3)}
          stroke="rgba(99,102,241,.08)" strokeWidth="1" strokeDasharray="4,4" />
      ))}
      <defs>
        <linearGradient id="lgG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(99,102,241,.18)" />
          <stop offset="100%" stopColor="rgba(99,102,241,.01)" />
        </linearGradient>
        <linearGradient id="lgC" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(245,158,11,.14)" />
          <stop offset="100%" stopColor="rgba(245,158,11,.01)" />
        </linearGradient>
      </defs>
      <polygon points={areaG} fill="url(#lgG)" />
      <polygon points={areaC} fill="url(#lgC)" />
      <polyline points={lineG} fill="none" stroke="rgb(99,102,241)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={lineC} fill="none" stroke="rgb(245,158,11)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />
      {rows.map((p, i) => (
        <g key={p.date}>
          <circle cx={padX + i * step} cy={yG(p.generated)} r="3.5" fill="white" stroke="rgb(99,102,241)" strokeWidth="2"/>
          <text x={padX + i * step} y={H + 2} textAnchor="middle" fontSize="14" fill="rgb(156,163,175)">{formatDay(p.date)}</text>
        </g>
      ))}
    </svg>
  );
}

function KpiCard({ icon, iconCls, label, value, sub, ratio, ratioColor }: {
  icon: ReactNode; iconCls: string; label: string; value: string; sub: string;
  ratio?: number; ratioColor?: string;
}) {
  return (
    <div className="card flex-1 p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconCls}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-tiny text-text-tertiary">{label}</div>
          <div className="mt-0.5 text-[22px] font-bold tabular-nums text-text-primary leading-none">{value}</div>
        </div>
      </div>
      {ratio !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className={`h-full rounded-full transition-all ${ratioColor}`} style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
          </div>
        </div>
      )}
      <div className="mt-2 text-tiny text-text-tertiary">{sub}</div>
    </div>
  );
}

function StatCard({ icon, iconCls, label, value, sub, trend }: {
  icon: ReactNode; iconCls: string; label: string; value: string; sub: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-tiny text-text-tertiary">{label}</div>
          <div className="mt-1.5 text-[28px] font-bold tabular-nums text-text-primary leading-none">{value}</div>
          <div className="mt-1.5 flex items-center gap-1 text-tiny">
            {trend === 'up' && <span className="text-emerald-500">↑</span>}
            {trend === 'down' && <span className="text-red-500">↓</span>}
            <span className="text-text-tertiary">{sub}</span>
          </div>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconCls}`}>{icon}</span>
      </div>
    </div>
  );
}

function ProviderRow({ row }: { row: DashboardProviderRow }) {
  const avail = row.total > 0 ? row.available / row.total : 0;
  const quota = row.quota_total > 0 ? row.quota_remaining / row.quota_total : 0;
  const health = avail === 0 ? 'danger' : avail < 0.5 ? 'warning' : 'success';
  const healthDot = health === 'danger' ? 'bg-red-400' : health === 'warning' ? 'bg-amber-400' : 'bg-emerald-400';
  const healthBadge = health === 'danger' ? 'badge-danger' : health === 'warning' ? 'badge-warning' : 'badge-success';

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${healthDot} shadow-sm`} />
          <span className="text-[14px] font-bold uppercase text-text-primary">{row.provider}</span>
          <span className="text-tiny text-text-tertiary hidden sm:inline">
            OK {fmtNumber(row.test_ok)} · 熔断 {fmtNumber(row.broken)} · 成功 {fmtNumber(row.success_count)}
          </span>
        </div>
        <span className={`badge ${healthBadge} text-[11px]`}>
          可用 {fmtNumber(row.available)}/{fmtNumber(row.total)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MiniProgress label="账号可用率" pct={avail} />
        <MiniProgress label="额度剩余率" pct={quota} text={row.quota_total > 0 ? `${fmtNumber(row.quota_remaining)}/${fmtNumber(row.quota_total)}` : '未探测'} />
      </div>
    </div>
  );
}

function MiniProgress({ label, pct, text }: { label: string; pct: number; text?: string }) {
  const color = pct === 0 ? 'bg-red-400' : pct < 0.5 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-tiny text-text-tertiary">
        <span>{label}</span>
        <span>{text ?? `${Math.round(pct * 100)}%`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }} />
      </div>
    </div>
  );
}

function RecentRow({ row }: { row: DashboardRecentTask }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2/50 transition-colors">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-text-tertiary">
        {row.kind === 'video' ? <Video size={14}/> : <Image size={14}/>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-text-primary">{row.user_label}</span>
          <span className="badge badge-outline text-[11px]">{row.model_code}</span>
          <span className={statusBadge(row.status)}>{statusText(row.status)}</span>
        </div>
        <div className="mt-0.5 text-tiny text-text-tertiary">{fmtTime(row.created_at)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[13px] font-semibold tabular-nums text-text-primary">{fmtPoints(row.cost_points)}</div>
        <div className="text-tiny text-text-tertiary">点</div>
      </div>
    </div>
  );
}

function statusText(s: number) {
  if (s === 2) return '成功';
  if (s === 3) return '失败';
  if (s === 4) return '已退款';
  if (s === 1) return '运行中';
  return '排队中';
}
function statusBadge(s: number) {
  if (s === 2) return 'badge badge-success text-[11px]';
  if (s === 3 || s === 4) return 'badge badge-danger text-[11px]';
  if (s === 1) return 'badge badge-warning text-[11px]';
  return 'badge badge-outline text-[11px]';
}
function percent(v?: number) { return v == null ? '—' : `${Math.round(v * 100)}%`; }
function compact(v?: number | null) {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return fmtNumber(n);
}
function formatDay(v: string) {
  if (!v.includes('-')) return v;
  return v.slice(5).replace('-', '/');
}
