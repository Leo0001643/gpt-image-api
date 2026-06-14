import { useQuery } from '@tanstack/react-query';
import {
  Activity, ArrowUp, BarChart3, Clock, Coins, Image,
  KeyRound, RefreshCw, ShieldCheck, Sparkles, TrendingUp, Users, Video, Zap,
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

  return (
    <div className="list-page">

      {/* ── sticky header ─────────────────────────────── */}
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
            {isFetching
              ? <span className="text-tiny text-indigo-500 animate-pulse font-medium flex items-center gap-1.5"><RefreshCw size={11} className="animate-spin"/>刷新中…</span>
              : <span className="text-tiny text-text-tertiary">每 15 秒自动刷新</span>
            }
            <button className="btn btn-outline btn-sm gap-1.5" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              手动刷新
            </button>
          </div>
        </div>
      </div>

      {/* ── dashboard body ─────────────────────────────── */}
      <div style={{ padding: '20px 24px 32px', background: '#f5f7ff', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Row 1: 4 gradient hero metric cards ─────── */}
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(4,1fr)' }}>
          <HeroCard
            gradient="linear-gradient(135deg,#667eea 0%,#764ba2 100%)"
            icon={<Users size={20} />}
            label="注册用户总数"
            value={isLoading ? '—' : fmtNumber(data?.users_total)}
            badge={`今日 +${fmtNumber(data?.users_today)}`}
            badgeIcon={<ArrowUp size={10} />}
            sub="累计注册用户"
          />
          <HeroCard
            gradient="linear-gradient(135deg,#f093fb 0%,#f5576c 100%)"
            icon={<Zap size={20} />}
            label="今日生成任务"
            value={isLoading ? '—' : fmtNumber(data?.generated_today)}
            badge={`累计 ${fmtNumber(data?.generated_total)}`}
            sub={`成功率 ${percent(data?.success_rate_today)}`}
          />
          <HeroCard
            gradient="linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)"
            icon={<Image size={20} />}
            label="图片产出"
            value={isLoading ? '—' : fmtNumber(data?.image_today)}
            badge={`今日`}
            sub={`累计 ${fmtNumber(data?.image_total)} 张`}
          />
          <HeroCard
            gradient="linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)"
            icon={<Coins size={20} />}
            label="今日积分消耗"
            value={isLoading ? '—' : fmtPoints(data?.cost_points_today)}
            badge="今日"
            sub={`累计 ${fmtPoints(data?.cost_points_total)}`}
          />
        </div>

        {/* ── Row 2: Trend chart (full width) ─────────── */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06),0 4px 20px rgba(99,102,241,.06)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #eef0f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,.1)', color: '#6366f1' }}>
                <TrendingUp size={15} />
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e1b4b' }}>近 7 天生成趋势</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>生成量 · 积分消耗双轴对比</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#9ca3af' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i style={{ display: 'inline-block', width: 24, height: 3, borderRadius: 2, background: '#6366f1' }} />生成量
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i style={{ display: 'inline-block', width: 24, height: 3, borderRadius: 2, background: '#f59e0b', opacity: 0.8 }} />积分消耗
              </span>
            </div>
          </div>
          <div style={{ padding: '16px 20px 12px' }}>
            <TrendChartSmooth points={data?.trend ?? []} loading={isLoading} />
          </div>
        </div>

        {/* ── Row 3: KPI cards + Provider + Recent tasks ── */}
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr 1fr' }}>

          {/* KPI column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionTitle icon={<ShieldCheck size={14} />} title="资源状态" color="#6366f1" />
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
          </div>

          {/* Provider health */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06),0 4px 20px rgba(99,102,241,.06)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eef0f8' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(59,130,246,.1)', color: '#3b82f6' }}>
                <BarChart3 size={14} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e1b4b' }}>账号池 · 额度状态</div>
              <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f0f4ff', color: '#6366f1', fontWeight: 500 }}>每 15s 刷新</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {providers.map((row) => <ProviderRow key={row.provider} row={row} />)}
              {providers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af', fontSize: 13 }}>暂无账号池数据</div>
              )}
            </div>
          </div>

          {/* Recent tasks */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06),0 4px 20px rgba(99,102,241,.06)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eef0f8', flexShrink: 0 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(239,68,68,.08)', color: '#ef4444' }}>
                <Activity size={14} />
              </span>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e1b4b' }}>最近生成任务</div>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>最新 8 条</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(data?.recent_generations ?? []).map((row) => <RecentRow key={row.task_id} row={row} />)}
              {(data?.recent_generations ?? []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9ca3af', fontSize: 13 }}>暂无生成记录</div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color, letterSpacing: '0.02em', textTransform: 'uppercase', marginBottom: -4 }}>
      {icon}{title}
    </div>
  );
}

function HeroCard({ gradient, icon, label, value, badge, badgeIcon, sub }: {
  gradient: string; icon: ReactNode; label: string; value: string;
  badge: string; badgeIcon?: ReactNode; sub: string;
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, background: gradient, padding: '20px 20px 18px', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
      {/* decorative circles */}
      <div style={{ position: 'absolute', top: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.12)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -16, left: '30%', width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85, letterSpacing: '0.01em' }}>{label}</div>
          <span style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.22)', flexShrink: 0 }}>
            {icon}
          </span>
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1, marginTop: 6, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>{sub}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,.2)', borderRadius: 20, padding: '2px 8px' }}>
            {badgeIcon}{badge}
          </span>
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
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,.05),0 2px 8px rgba(99,102,241,.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, background: iconBg, color: '#fff', flexShrink: 0 }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {ratio !== undefined && (
          <div style={{ height: 3, borderRadius: 2, background: '#eef0f8', marginTop: 4 }}>
            <div style={{ height: '100%', borderRadius: 2, background: ratioColor, width: `${Math.max(0, Math.min(100, ratio * 100))}%`, transition: 'width .4s ease' }} />
          </div>
        )}
        <div style={{ fontSize: 11, color: '#b0b7c8', marginTop: ratio !== undefined ? 3 : 2 }}>{sub}</div>
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
    return <div style={{ height: 160, borderRadius: 12, background: 'linear-gradient(90deg,#f0f4ff 0%,#e8edff 50%,#f0f4ff 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s ease infinite' }} />;
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

      {/* grid lines */}
      {[0, 1, 2, 3].map((i) => {
        const y = padY + (i / 3) * innerH;
        return <line key={i} x1={padX} x2={W - padX} y1={y} y2={y} stroke="rgba(99,102,241,.08)" strokeWidth="1" strokeDasharray="4,5" />;
      })}

      {/* area fills */}
      <path d={`${pathG} ${areaGEnd}`} fill="url(#dashGradG)" />
      <path d={`${pathC} ${areaCEnd}`} fill="url(#dashGradC)" />

      {/* lines */}
      <path d={pathG} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathC} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />

      {/* dots + labels */}
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
    <div style={{ padding: '12px 18px', borderBottom: '1px solid #f4f5fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotCls, boxShadow: `0 0 0 3px ${dotCls}22`, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#1e1b4b', letterSpacing: '0.04em' }}>{row.provider}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>OK {fmtNumber(row.test_ok)} · 熔断 {fmtNumber(row.broken)}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: badgeBg, color: badgeColor }}>
          {fmtNumber(row.available)}/{fmtNumber(row.total)} 可用
        </span>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 5 }}>
        <span>{label}</span><span style={{ fontWeight: 600, color }}>{pctStr}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: '#eef0f8' }}>
        <div style={{ height: '100%', borderRadius: 3, background: color, width: `${Math.max(0, Math.min(100, pct * 100))}%`, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
}

function RecentRow({ row }: { row: DashboardRecentTask }) {
  const isVideo   = row.kind === 'video';
  const statusCfg = statusConfig(row.status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: '1px solid #f4f5fb' }}>
      <div style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 10, background: isVideo ? 'rgba(59,130,246,.1)' : 'rgba(99,102,241,.1)', color: isVideo ? '#3b82f6' : '#6366f1', flexShrink: 0 }}>
        {isVideo ? <Video size={14} /> : <Image size={14} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{row.user_label}</span>
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 5, background: '#f0f4ff', color: '#6366f1', fontWeight: 500 }}>{row.model_code}</span>
          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontWeight: 600 }}>{statusCfg.text}</span>
        </div>
        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, color: '#9ca3af', fontSize: 11 }}>
          <Clock size={10} />
          {fmtTime(row.created_at)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(row.cost_points)}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>pt</div>
      </div>
    </div>
  );
}

function statusConfig(s: number): { text: string; bg: string; color: string } {
  if (s === 2) return { text: '成功', bg: 'rgba(16,185,129,.1)', color: '#059669' };
  if (s === 3) return { text: '失败', bg: 'rgba(239,68,68,.1)', color: '#dc2626' };
  if (s === 4) return { text: '已退款', bg: 'rgba(245,158,11,.1)', color: '#d97706' };
  if (s === 1) return { text: '运行中', bg: 'rgba(59,130,246,.1)', color: '#2563eb' };
  return { text: '排队中', bg: 'rgba(156,163,175,.1)', color: '#6b7280' };
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
