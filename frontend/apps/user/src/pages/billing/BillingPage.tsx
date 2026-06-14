import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CreditCard, Gift, Loader2, Sparkles, TrendingUp, Wallet, Zap } from 'lucide-react';
import clsx from 'clsx';

import { ApiError } from '../../lib/api';
import { fmtBiz, fmtPoints, fmtTime, pointsClass } from '../../lib/format';
import { billingApi } from '../../lib/services';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';

export default function BillingPage() {
  const me        = useAuthStore((s) => s.me);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const qc        = useQueryClient();

  const [page, setPage] = useState(1);
  const logsQ = useQuery({
    queryKey: ['billing.logs', page],
    queryFn: () => billingApi.logs(page, 20),
  });

  const [code, setCode] = useState('');
  const redeemMut = useMutation({
    mutationFn: () => billingApi.redeemCDK(code.trim()),
    onSuccess: async (resp) => {
      toast.success(`兑换成功 +${fmtPoints(resp.points)} 点`);
      setCode('');
      await refreshMe();
      await qc.invalidateQueries({ queryKey: ['billing.logs'] });
      setPage(1);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '兑换失败'),
  });

  const logs       = logsQ.data?.list ?? [];
  const total      = logsQ.data?.total ?? 0;
  const pageSize   = logsQ.data?.page_size ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen" style={{ background: '#F5F6FA' }}>
      <div className="max-w-4xl mx-auto px-5 py-6">

        {/* 页头 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'var(--gia-gradient)' }}>
            <CreditCard size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-semibold text-neutral-900 leading-tight">充值 & 余额</h1>
            <p className="text-xs text-neutral-400 mt-0.5">管理你的点数、兑换码和消费记录</p>
          </div>
        </div>

        {/* KPI 卡片组 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* 可用点数 - 主卡 */}
          <div className="col-span-2 lg:col-span-1 rounded-2xl p-4 text-white relative overflow-hidden"
               style={{ background: 'var(--gia-gradient)' }}>
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap size={13} className="text-white/80" />
                <p className="text-xs text-white/80 font-medium">可用点数</p>
              </div>
              <p className="text-[26px] font-bold leading-tight tabular-nums">
                {fmtPoints(me?.points ?? 0)}
              </p>
              <p className="text-[11px] text-white/60 mt-1">点</p>
            </div>
          </div>

          {[
            { icon: TrendingUp, label: '冻结点数', value: fmtPoints(me?.frozen_points ?? 0), unit: '点', hint: '进行中的任务' },
            { icon: Sparkles,   label: '当前套餐', value: me?.plan_code?.toUpperCase() ?? 'FREE', unit: '', hint: '订阅计划' },
            { icon: Gift,       label: '邀请码',   value: me?.invite_code ?? '—', unit: '', hint: '分享给好友' },
          ].map(({ icon: Icon, label, value, unit, hint }) => (
            <div key={label} className="rounded-2xl bg-white border border-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={13} className="text-neutral-400" />
                <p className="text-xs text-neutral-400 font-medium">{label}</p>
              </div>
              <p className="text-[20px] font-bold text-neutral-900 leading-tight truncate tabular-nums">{value}</p>
              {unit && <p className="text-[11px] text-neutral-400 mt-1">{unit}</p>}
              <p className="text-[10px] text-neutral-300 mt-1">{hint}</p>
            </div>
          ))}
        </div>

        {/* 功能卡片区 */}
        <div className="grid gap-4 mb-6 lg:grid-cols-2">
          {/* 兑换码 */}
          <div className="rounded-2xl bg-white border border-neutral-200 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Gift size={16} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-neutral-900">兑换码 CDK</h2>
                <p className="text-[11px] text-neutral-400">输入兑换码立即到账</p>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
              输入活动码或邀请码即可立刻到账点数，同一个兑换码不可重复使用。
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 h-10 px-3 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#002FA7] focus:ring-2 focus:ring-[#002FA7]/10 transition bg-neutral-50 focus:bg-white uppercase"
                placeholder="GPT2API-2026-XXXXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={32}
                onKeyDown={(e) => e.key === 'Enter' && code.trim().length >= 4 && !redeemMut.isPending && redeemMut.mutate()}
              />
              <button
                className="h-10 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap flex items-center gap-1.5 hover:opacity-90"
                style={{ background: 'var(--gia-gradient)' }}
                disabled={code.trim().length < 4 || redeemMut.isPending}
                onClick={() => redeemMut.mutate()}
                type="button"
              >
                {redeemMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                兑换
              </button>
            </div>
          </div>

          {/* 充值套餐 */}
          <div className="rounded-2xl border border-dashed border-neutral-200 bg-gradient-to-br from-[#F0F4FF] to-white p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-[#002FA7]" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-neutral-900">充值套餐</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#002FA7] text-white font-medium">即将上线</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
              微信 / 支付宝 / Stripe 支付通道正在开发中，当前请通过 CDK 兑换码获得点数。
            </p>
            <button className="h-9 px-4 rounded-xl border border-neutral-200 text-sm text-neutral-400 cursor-not-allowed bg-white" disabled>
              敬请期待
            </button>
          </div>
        </div>

        {/* 交易记录 */}
        <div className="rounded-2xl bg-white border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Wallet size={15} className="text-neutral-400" />
              <span className="text-sm font-semibold text-neutral-800">消费记录</span>
            </div>
            <span className="text-xs text-neutral-400">共 {total} 条</span>
          </div>

          {logsQ.isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-neutral-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">加载中…</span>
            </div>
          )}

          {!logsQ.isLoading && logs.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-2 text-neutral-400">
              <div className="w-12 h-12 rounded-2xl border border-dashed border-neutral-200 grid place-items-center">
                <Wallet size={20} strokeWidth={1.5} className="text-neutral-300" />
              </div>
              <p className="text-sm font-medium text-neutral-500 mt-1">暂无消费记录</p>
              <p className="text-xs text-neutral-400">生成图片或视频后，相关账单会在此呈现</p>
            </div>
          )}

          {logs.length > 0 && (
            <div className="divide-y divide-neutral-100">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-neutral-50 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {fmtBiz(l.biz_type)}
                      {l.remark ? <span className="text-neutral-400 font-normal"> · {l.remark}</span> : ''}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">{fmtTime(l.created_at)}</p>
                  </div>
                  <p className={clsx('text-sm font-bold whitespace-nowrap ml-4 tabular-nums', pointsClass(l.direction))}>
                    {l.direction > 0 ? '+' : '-'}{fmtPoints(Math.abs(l.points))} 点
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4">
              <span className="text-xs text-neutral-400">第 {page} / {totalPages} 页</span>
              <div className="flex items-center gap-2">
                <button
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-xs transition',
                    page <= 1 || logsQ.isFetching
                      ? 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                      : 'border-neutral-200 text-neutral-600 hover:border-[#002FA7] hover:text-[#002FA7]',
                  )}
                  disabled={page <= 1 || logsQ.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >上一页</button>
                <button
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-xs transition',
                    page >= totalPages || logsQ.isFetching
                      ? 'border-neutral-200 text-neutral-300 cursor-not-allowed'
                      : 'border-neutral-200 text-neutral-600 hover:border-[#002FA7] hover:text-[#002FA7]',
                  )}
                  disabled={page >= totalPages || logsQ.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >下一页</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
