import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ReceiptText, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../lib/api';
import { systemApi } from '../../lib/services';
import type { SystemSettings } from '../../lib/types';
import { toast } from '../../stores/toast';

interface FormState { refund_on_failure: boolean; free_initial_points: number }
const DEFAULT: FormState = { refund_on_failure: true, free_initial_points: 0 };

const asBool = (v: unknown, fb = false) => (v == null ? fb : Boolean(v));
const asNum  = (v: unknown, fb: number) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

function fromSettings(s?: SystemSettings): FormState {
  if (!s) return DEFAULT;
  return {
    refund_on_failure:   asBool(s['billing.refund_on_failure'], true),
    free_initial_points: asNum(s['billing.free_initial_points'], 0) / 100,
  };
}
function toPayload(f: FormState): Partial<SystemSettings> {
  return {
    'billing.refund_on_failure':   f.refund_on_failure,
    'billing.free_initial_points': Math.round((Number(f.free_initial_points) || 0) * 100),
  };
}

export default function BillingSettingsPage() {
  const qc       = useQueryClient();
  const settings = useQuery({ queryKey:['admin','system','settings'], queryFn:()=>systemApi.get() });
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings.data) { setForm(fromSettings(settings.data)); setDirty(false); }
  }, [settings.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm(f=>({...f,[k]:v})); setDirty(true); };

  const save = useMutation({
    mutationFn: () => systemApi.update(toPayload(form)),
    onSuccess: () => { toast.success('扣费设置已保存'); setDirty(false); qc.invalidateQueries({ queryKey:['admin','system'] }); },
    onError: (e: ApiError | Error) => toast.error(e.message),
  });

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#f97316,#ea580c)',boxShadow:'0 4px 14px rgba(249,115,22,.35)'}}>
            <ReceiptText size={16}/>
          </div>
          <div>
            <div className="list-page-title">扣费设置</div>
            <div className="list-page-subtitle">通用扣费规则。模型单价在「模型价格」维护，充值商品在「充值套餐」维护</div>
          </div>
          {dirty && <span className="stat-pill stat-pill-orange"><span className="stat-pill-dot"/><span className="stat-pill-label">有未保存修改</span></span>}
          <div className="ml-auto flex gap-2">
            <button className="btn btn-outline btn-sm" onClick={()=>settings.refetch()} disabled={settings.isFetching}>
              <RefreshCw size={13} className={settings.isFetching?'animate-spin':''}/> 刷新
            </button>
            <button className="btn btn-primary btn-sm" onClick={()=>save.mutate()} disabled={!dirty||save.isPending}>
              <Save size={13}/> {save.isPending?'保存中…':dirty?'保存修改':'已是最新'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white px-6 pt-5 pb-8">
        {settings.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0,1].map(i=><div key={i} className="card h-44 animate-pulse bg-surface-2"/>)}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">

            {/* 失败退款 */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-100 text-orange-600">
                  <ReceiptText size={16}/>
                </span>
                <div>
                  <h2 className="text-[14px] font-semibold text-text-primary">失败退款</h2>
                  <p className="text-tiny text-text-tertiary">任务失败时是否自动归还预扣积分</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-2/50 px-4 py-4">
                  <div>
                    <div className="text-[14px] font-medium text-text-primary">失败自动退款</div>
                    <div className="mt-0.5 text-tiny text-text-tertiary">
                      {form.refund_on_failure ? '✓ 已启用，失败任务积分自动退还' : '已关闭，失败积分不退还'}
                    </div>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={form.refund_on_failure}
                    onClick={()=>set('refund_on_failure',!form.refund_on_failure)}
                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${form.refund_on_failure?'bg-gia-500':'bg-surface-3'}`}
                  >
                    <span className={`my-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${form.refund_on_failure?'translate-x-5':'translate-x-0.5'}`}/>
                  </button>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-tiny text-text-tertiary">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500"/>
                  建议保持开启，防止因上游错误导致用户积分损失。
                </div>
              </div>
            </div>

            {/* 注册赠送 */}
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-600">
                  <Sparkles size={16}/>
                </span>
                <div>
                  <h2 className="text-[14px] font-semibold text-text-primary">注册赠送</h2>
                  <p className="text-tiny text-text-tertiary">新用户注册后自动赠送的初始积分</p>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <label className="field">
                  <span className="field-label">赠送积分（点）</span>
                  <div className="relative">
                    <input
                      className="input pr-12 text-[22px] font-bold tabular-nums"
                      type="number" min={0}
                      value={form.free_initial_points || ''}
                      placeholder="0"
                      onChange={(e)=>set('free_initial_points', Number(e.target.value)||0)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-small font-medium text-text-tertiary">点</span>
                  </div>
                </label>
                <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-tiny text-text-tertiary">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-gia-500"/>
                  设为 0 表示不赠送。修改不影响已注册用户。
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
