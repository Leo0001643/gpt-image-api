import { useQuery } from '@tanstack/react-query';
import {
  Activity, ArrowUp, BarChart3, Clock, Coins, Image,
  Inbox, KeyRound, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Users, Video, Zap,
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

  const providers         = data?.account_providers ?? [];
  const totalAccounts     = providers.reduce((s, r) => s + r.total, 0);
  const availableAccounts = providers.reduce((s, r) => s + r.available, 0);
  const quotaRemaining    = providers.reduce((s, r) => s + r.quota_remaining, 0);
  const quotaTotal        = providers.reduce((s, r) => s + r.quota_total, 0);
  const quotaUsed         = Math.max(0, quotaTotal - quotaRemaining);
  const trendTotal        = (data?.trend ?? []).reduce((s, p) => s + p.generated, 0);

  return (
    <div className="list-page">

      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 4px 14px rgba(99,102,241,.35)' }}>
            <Activity size={16} />
          </div>
          <div>
            <div className="list-page-title">运营仪表盘</div>
            <div className="list-page-subtitle">实时追踪生成量、账号池状态、积分消耗与用户活跃</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-tiny text-text-tertiary">
              <span className="dash-live-dot" />
              {isFetching
                ? <span className="text-indigo-500 animate-pulse font-medium flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin"/>刷新中…</span>
                : '每 15 秒自动刷新'
              }
            </span>
            <button className="btn btn-outline btn-sm gap-1.5" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              手动刷新
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-body">

        {/* Row 1: hero metrics */}
        <div className="dashboard-grid-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="dash-hero-skeleton" />)
          ) : (
            <>
              <HeroCard
                gradient="linear-gradient(135deg,#667eea 0%,#764ba2 100%)"
                icon={<Users size={20} />}
                label="注册用户总数"
                value={fmtNumber(data?.users_total)}
                badge={`今日 +${fmtNumber(data?.users_today)}`}
                badgeIcon={<ArrowUp size={10} />}
                sub="累计注册用户"
              />
              <HeroCard
                gradient="linear-gradient(135deg,#f093fb 0%,#f5576c 100%)"
                icon={<Zap size={20} />}
                label="今日生成任务"
                value={fmtNumber(data?.generated_today)}
                badge={`累计 ${fmtNumber(data?.generated_total)}`}
                sub={`成功率 ${percent(data?.success_rate_today)}`}
              />
              <HeroCard
                gradient="linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)"
                icon={<Image size={20} />}
                label="图片产出"
                value={fmtNumber(data?.image_today)}
                badge="今日"
                sub={`累计 ${fmtNumber(data?.image_total)} 张`}
              />
              <HeroCard
                gradient="linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)"
                icon={<Coins size={20} />}
                label="今日积分消耗"
                value={fmtPoints(data?.cost_points_today)}
                badge="今日"
                sub={`累计 ${fmtPoints(data?.cost_points_total)}`}
              />
            </>
          )}
        </div>

        {/* Row 2: trend chart */}
        <div className="dash-panel">
          <div className="dash-panel-head" style={{ padding: '16px 20px 12px' }}>
            <div className="dash-panel-title">
              <span className="dash-panel-icon" style={{ background: 'rgba(99,102,241,.1)', color: '#6366f1' }}>
                <TrendingUp size={15} />
              </span>
              <div>
                <div>近 7 天生成趋势</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1, fontWeight: 400 }}>生成量 · 积分消耗双轴对比</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-text-tertiary">
              {!isLoading && trendTotal > 0 && (
                <span className="stat-pill stat-pill-violet" style={{ padding: '2px 10px' }}>
                  <span className="stat-pill-label">7 日合计</span>
                  <span className="stat-pill-val">{fmtNumber(trendTotal)}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-[3px] w-6 rounded-sm bg-indigo-500" />生成量
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-[3px] w-6 rounded-sm bg-amber-500 opacity-80" />积分消耗
              </span>
            </div>
          </div>
          <div style={{ padding: '16px 20px 12px' }}>
            <TrendChartSmooth points={data?.trend ?? []} loading={isLoading} />
          </div>
        </div>

        {/* Row 3: KPI + providers + recent */}
        <div className="dashboard-grid-3">

          <div className="flex flex-col gap-3">
            <SectionTitle icon={<ShieldCheck size={14} />} title="资源状态" color="#6366f1" />
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="dash-kpi-card">
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                    <div className="skeleton skeleton-text" style={{ width: '60%', height: 18 }} />
                  </div>
                </div>
              ))
            ) : (
              <>
                <KpiCard2
                  icon={<KeyRound size={18} />}
                  iconBg="linear-gradient(135deg,#667eea,#764ba2)"
                  label="账号池"
                  value={`${fmtNumber(availableAccounts)} / ${fmtNumber(totalAccounts)}`}
                  sub="可用 / 总量"
                  ratio={totalAccounts > 0 ? availableAccounts / totalAccounts : 0}
                  ratioColor="#6366f1"
                />
                <KpiCard2
                  icon={<ShieldCheck size={18} />}
                  iconBg="linear-gradient(135deg,#43e97b,#38f9d7)"
                  label="剩余 API 额度"
                  value={fmtNumber(quotaRemaining)}
                  sub={quotaTotal > 0 ? `已用 ${fmtNumber(quotaUsed)}` : '等待探测'}
                  ratio={quotaTotal > 0 ? quotaRemaining / quotaTotal : 0}
                  ratioColor="#10b981"
                />
                <KpiCard2
                  icon={<Coins size={18} />}
                  iconBg="linear-gradient(135deg,#f093fb,#f5576c)"
                  label="今日钱包消费"
                  value={fmtPoints(data?.wallet_spend_today)}
                  sub={`累计 ${fmtPoints(data?.wallet_spend_total)}`}
                  ratioColor="#f59e0b"
                />
                <KpiCard2
                  icon={<Video size={18} />}
                  iconBg="linear-gradient(135deg,#4facfe,#00f2fe)"
                  label="视频产出"
                  value={fmtNumber(data?.video_today)}
                  sub={`累计 ${fmtNumber(data?.video_total)} 个`}
                  ratioColor="#3b82f6"
                />
                <KpiCard2
                  icon={<Sparkles size={18} />}
                  iconBg="linear-gradient(135deg,#f6d365,#fda085)"
                  label="Token 消耗"
                  value={compact(data?.text_tokens_today)}
                  sub={`累计 ${compact(data?.text_tokens_total)}`}
                  ratioColor="#f59e0b"
                />
              </>
            )}
          </div>

          <div className="dash-panel">
            <div className="dash-panel-head">
              <div className="dash-panel-title">
                <span className="dash-panel-icon" style={{ background: 'rgba(59,130,246,.1)', color: '#3b82f6' }}>
                  <BarChart3 size={14} />
                </span>
                账号池 · 额度状态
              </div>
              <span className="dash-panel-badge">每 15s 刷新</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="dash-list-row">
                  <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 10 }} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="skeleton" style={{ height: 24 }} />
                    <div className="skeleton" style={{ height: 24 }} />
                  </div>
                </div>
              ))}
              {!isLoading && providers.map((row) => <ProviderRow key={row.provider} row={row} />)}
              {!isLoading && providers.length === 0 && (
                <div className="empty-state-compact">
                  <div className="empty-state-icon" style={{ background: 'rgba(59,130,246,.08)', color: '#3b82f6' }}>
                    <KeyRound size={20} />
                  </div>
                  <p className="empty-state-title">暂无账号池数据</p>
                  <p className="empty-state-desc">添加 Token 账号后将在此显示健康状态</p>
                </div>
              )}
            </div>
          </div>

          <div className="dash-panel flex flex-col">
            <div className="dash-panel-head">
              <div className="dash-panel-title">
                <span className="dash-panel-icon" style={{ background: 'rgba(239,68,68,.08)', color: '#ef4444' }}>
                  <Activity size={14} />
                </span>
                最近生成任务
              </div>
              <span className="text-[11px] text-text-tertiary">最新 8 条</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="dash-list-row flex items-center gap-3">
                  <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0 }} />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                    <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  </div>
                </div>
              ))}
              {!isLoading && (data?.recent_generations ?? []).map((row) => <RecentRow key={row.task_id} row={row} />)}
              {!isLoading && (data?.recent_generations ?? []).length === 0 && (
                <div className="empty-state-compact">
                  <div className="empty-state-icon" style={{ background: 'rgba(99,102,241,.08)', color: '#6366f1' }}>
                    <Inbox size={20} />
                  </div>
                  <p className="empty-state-title">暂无生成记录</p>
                  <p className="empty-state-desc">用户发起生成任务后将在此实时展示</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────── */

function SectionTitle({ icon, title, color }: { icon: ReactNode; title: string; color: string }) {
  return (
    <div className="dash-section-label" style={{ color }}>
      {icon}{title}
    </div>
  );
}

function HeroCard({ gradient, icon, label, value, badge, badgeIcon, sub }: {
  gradient: string; icon: ReactNode; label: string; value: string;
  badge: string; badgeIcon?: ReactNode; sub: string;
}) {
  return (
    <div className="dash-hero-card" style={{ background: gradient }}>
      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-2">
          <div className="dash-hero-label">{label}</div>
          <span className="dash-hero-icon">{icon}</span>
        </div>
        <div className="dash-hero-value">{value}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] opacity-70">{sub}</span>
          <span className="dash-hero-badge">{badgeIcon}{badge}</span>
        </div>
      </div>
    </div>
  );
}

function KpiCard2({ icon, iconBg, label, value, sub, ratio, ratioColor }: {
  icon: ReactNode; iconBg: string; label: string; value: string; sub: string;
  ratio?: number; ratioColor: string;
}) {
  return (
    <div className="dash-kpi-card">
      <span className="dash-kpi-icon" style={{ background: iconBg }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-text-tertiary font-medium">{label}</div>
        <div className="text-[18px] font-bold text-[#1e1b4b] leading-tight tabular-nums">{value}</div>
        {ratio !== undefined && (
          <div className="h-[3px] rounded-sm bg-[#eef0f8] mt-1">
            <div
              className="h-full rounded-sm transition-[width] duration-400 ease-out"
              style={{ background: ratioColor, width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
            />
          </div>
        )}
        <div className="text-[11px] text-[#b0b7c8] mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function TrendChartSmooth({ points, loading }: { points: DashboardTrendPoint[]; loading?: boolean }) {
  const rows   = points.length > 0 ? points : Array.from({ length: 7 }, (_, i) => ({ date: `D${i + 1}`, generated: 0, cost_points: 0 }));
  const W = 900, H = 160, padX = 32, padY = 20, padBottom = 28;
  const innerH = H - padY - padBottom;
  const innerW = W - padX * 2;
  const n      = rows.length;
  const step   = n > 1 ? innerW / (n - 1) : innerW;
  const maxG   = Math.max(1, ...rows.map((p) => p.generated));
  const maxC   = Math.max(1, ...rows.map((p) => p.cost_points));
  const xAt    = (i: number) => padX + i * step;
  const yG     = (v: number) => padY + innerH - (v / maxG) * innerH;
  const yC     = (v: number) => padY + innerH - (v / maxC) * innerH;

  const smoothPath = (pts: Array<[number, number]>) => {
    if (pts.length < 2) return '';
    const first = pts[0]!;
    const d: string[] = [`M${first[0]},${first[1]}`];
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]!;
      const cur  = pts[i]!;
      const cx   = (prev[0] + cur[0]) / 2;
      d.push(`C${cx},${prev[1]} ${cx},${cur[1]} ${cur[0]},${cur[1]}`);
    }
    return d.join(' ');
  };

  const ptsG: [number, number][] = rows.map((p, i) => [xAt(i), yG(p.generated)]);
  const ptsC: [number, number][] = rows.map((p, i) => [xAt(i), yC(p.cost_points)]);
  const pathG   = smoothPath(ptsG);
  const pathC   = smoothPath(ptsC);
  const areaGEnd = `L${xAt(n - 1)},${padY + innerH} L${xAt(0)},${padY + innerH} Z`;
  const areaCEnd = `L${xAt(n - 1)},${padY + innerH} L${xAt(0)},${padY + innerH} Z`;

  if (loading) {
    return <div className="skeleton" style={{ height: 160, borderRadius: 12 }} />;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160, overflow: 'visible' }}>
      <defs>
        <linearGradient id="dashGradG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(99,102,241,.2)" />
          <stop offset="100%" stopColor="rgba(99,102,241,.01)" />
        </linearGradient>
        <linearGradient id="dashGradC" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(245,158,11,.15)" />
          <stop offset="100%" stopColor="rgba(245,158,11,.01)" />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3].map((i) => {
        const y = padY + (i / 3) * innerH;
        return <line key={i} x1={padX} x2={W - padX} y1={y} y2={y} stroke="rgba(99,102,241,.08)" strokeWidth="1" strokeDasharray="4,5" />;
      })}

      <path d={`${pathG} ${areaGEnd}`} fill="url(#dashGradG)" />
      <path d={`${pathC} ${areaCEnd}`} fill="url(#dashGradC)" />

      <path d={pathG} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathC} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />

      {rows.map((p, i) => (
        <g key={p.date}>
          <circle cx={xAt(i)} cy={yG(p.generated)} r="4" fill="#fff" stroke="#6366f1" strokeWidth="2.5" />
          <text x={xAt(i)} y={padY + innerH + 18} textAnchor="middle" fontSize="13" fill="#9ca3af" fontFamily="inherit">{formatDay(p.date)}</text>
          {p.generated > 0 && (
            <text x={xAt(i)} y={yG(p.generated) - 8} textAnchor="middle" fontSize="11" fill="#6366f1" fontWeight="600" fontFamily="inherit">{p.generated}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function ProviderRow({ row }: { row: DashboardProviderRow }) {
  const avail   = row.total > 0 ? row.available / row.total : 0;
  const quota   = row.quota_total > 0 ? row.quota_remaining / row.quota_total : 0;
  const health  = avail === 0 ? 'danger' : avail < 0.5 ? 'warning' : 'ok';
  const dotCls  = health === 'danger' ? '#ef4444' : health === 'warning' ? '#f59e0b' : '#10b981';
  const badgeBg = health === 'danger' ? 'rgba(239,68,68,.1)' : health === 'warning' ? 'rgba(245,158,11,.1)' : 'rgba(16,185,129,.1)';
  const badgeColor = health === 'danger' ? '#dc2626' : health === 'warning' ? '#d97706' : '#059669';

  return (
    <div className="dash-list-row">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotCls, boxShadow: `0 0 0 3px ${dotCls}22`, flexShrink: 0 }} />
          <span className="text-[14px] font-bold uppercase text-[#1e1b4b] tracking-wide">{row.provider}</span>
          <span className="text-[11px] text-text-tertiary">OK {fmtNumber(row.test_ok)} · 熔断 {fmtNumber(row.broken)}</span>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>
          {fmtNumber(row.available)}/{fmtNumber(row.total)} 可用
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <RingProgress label="账号可用率" pct={avail} />
        <RingProgress label="额度剩余率" pct={quota} text={row.quota_total > 0 ? `${fmtNumber(row.quota_remaining)}` : '未探测'} />
      </div>
    </div>
  );
}

function RingProgress({ label, pct, text }: { label: string; pct: number; text?: string }) {
  const color = pct === 0 ? '#ef4444' : pct < 0.5 ? '#f59e0b' : '#10b981';
  const pctStr = text ?? `${Math.round(pct * 100)}%`;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-text-tertiary mb-1">
        <span>{label}</span><span className="font-semibold" style={{ color }}>{pctStr}</span>
      </div>
      <div className="h-1 rounded-sm bg-[#eef0f8]">
        <div
          className="h-full rounded-sm transition-[width] duration-400 ease-out"
          style={{ background: color, width: `${Math.max(0, Math.min(100, pct * 100))}%` }}
        />
      </div>
    </div>
  );
}

function RecentRow({ row }: { row: DashboardRecentTask }) {
  const isVideo   = row.kind === 'video';
  const statusCfg = statusConfig(row.status);
  return (
    <div className="dash-list-row flex items-center gap-3">
      <div
        className="grid place-items-center w-[34px] h-[34px] rounded-[10px] shrink-0"
        style={{ background: isVideo ? 'rgba(59,130,246,.1)' : 'rgba(99,102,241,.1)', color: isVideo ? '#3b82f6' : '#6366f1' }}
      >
        {isVideo ? <Video size={14} /> : <Image size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold text-[#1e1b4b] truncate max-w-[100px]">{row.user_label}</span>
          <span className="text-[11px] px-1.5 py-px rounded bg-[#f0f4ff] text-indigo-500 font-medium">{row.model_code}</span>
          <span className="text-[11px] px-1.5 py-px rounded-full font-semibold" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.text}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-tertiary">
          <Clock size={10} />
          {fmtTime(row.created_at)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold text-[#1e1b4b] tabular-nums">{fmtPoints(row.cost_points)}</div>
        <div className="text-[11px] text-text-tertiary">pt</div>
      </div>
    </div>
  );
}

function statusConfig(s: number): { text: string; bg: string; color: string } {
  if (s === 2) return { text: '成功', bg: 'rgba(16,185,129,.1)', color: '#059669' };
  if (s === 3) return { text: '失败', bg: 'rgba(239,68,68,.1)', color: '#dc2626' };
  if (s === 4) return { text: '已退款', bg: 'rgba(245,158,11,.1)', color: '#d97706' };
  if (s === 1) return { text: '运行中', bg: 'rgba(59,130,246,.1)', color: '#2563eb' };
  return { text: '准备中', bg: 'rgba(156,163,175,.1)', color: '#6b7280' };
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
