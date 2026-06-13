import { useMutation } from '@tanstack/react-query';
import { Ticket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '../../lib/api';
import { cdkApi } from '../../lib/services';
import type { CDKCreateBatchBody, CDKCreateBatchResp } from '../../lib/types';
import { fmtNumber, fmtPoints } from '../../lib/format';
import { toast } from '../../stores/toast';

export default function CDKPage() {
  const [body, setBody] = useState<CDKCreateBatchBody>({
    batch_no: '',
    name: '',
    points: 1000, // 后端 *100，1000 = 10 点
    qty: 100,
    per_user_limit: 1,
    expire_at: 0,
  });
  const [last, setLast] = useState<CDKCreateBatchResp | null>(null);

  const m = useMutation({
    mutationFn: (b: CDKCreateBatchBody) => cdkApi.createBatch(b),
    onSuccess: (r) => {
      toast.success(`已生成批次 ${r.batch_no}（共 ${r.total_qty} 张）`);
      setLast(r);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.batch_no.trim() || !body.name.trim()) {
      toast.error('请填写批次号和名称');
      return;
    }
    if (body.points <= 0 || body.qty <= 0) {
      toast.error('点数和数量必须 > 0');
      return;
    }
    m.mutate({
      ...body,
      batch_no: body.batch_no.trim(),
      name: body.name.trim(),
      per_user_limit: body.per_user_limit || 0,
      expire_at: body.expire_at || undefined,
    });
  };

  return (
    <div className="list-page">
      <div className="list-page-head">
        <div className="list-page-title-row">
          <div className="page-icon-box" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)',boxShadow:'0 4px 14px rgba(245,158,11,.35)'}}>
            <Ticket size={16}/>
          </div>
          <div>
            <div className="list-page-title">兑换码 CDK</div>
            <div className="list-page-subtitle">按批次生成；每张 CDK 只能被使用一次，使用后写入 wallet_log 并入账</div>
          </div>
        </div>
      </div>
      <div className="-mx-6 space-y-5 py-5">

      <div className="dialog-surface w-full">
        <div className="modal-header-grad mhg-amber">
          <div className="flex items-center gap-3">
            <div className="modal-icon"><Ticket size={20}/></div>
            <div>
              <h3>生成兑换码批次</h3>
              <p>每张 CDK 唯一，使用后自动入账积分</p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="modal-body grid w-full gap-5 lg:grid-cols-2">
        <Field label="批次号" hint="同批次唯一，如 SPRING2026-A">
          <input
            className="input"
            value={body.batch_no}
            onChange={(e) => setBody((s) => ({ ...s, batch_no: e.target.value }))}
            placeholder="SPRING2026-A"
          />
        </Field>

        <Field label="批次名称" hint="展示给运营 / 客服的友好名称">
          <input
            className="input"
            value={body.name}
            onChange={(e) => setBody((s) => ({ ...s, name: e.target.value }))}
            placeholder="春节活动 100 点"
          />
        </Field>

        <Field
          label="单码点数（×100 储存）"
          hint={`输入 1000 = 实际 10.00 点；当前等价：${fmtPoints(body.points)} 点`}
        >
          <input
            type="number"
            min={1}
            className="input"
            value={body.points}
            onChange={(e) =>
              setBody((s) => ({ ...s, points: Math.max(1, Number(e.target.value) || 0) }))
            }
          />
        </Field>

        <Field label="生成数量" hint="单批次最多 100,000 张">
          <input
            type="number"
            min={1}
            max={100_000}
            className="input"
            value={body.qty}
            onChange={(e) =>
              setBody((s) => ({ ...s, qty: Math.max(1, Number(e.target.value) || 0) }))
            }
          />
        </Field>

        <Field label="每用户限领次数" hint="0 表示不限制；建议 1（防止羊毛党）">
          <input
            type="number"
            min={0}
            className="input"
            value={body.per_user_limit ?? 0}
            onChange={(e) => setBody((s) => ({ ...s, per_user_limit: Number(e.target.value) || 0 }))}
          />
        </Field>

        <Field label="过期时间（可选）" hint="留空表示永久有效">
          <input
            type="datetime-local"
            className="input"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setBody((s) => ({ ...s, expire_at: 0 }));
                return;
              }
              const t = Math.floor(new Date(v).getTime() / 1000);
              setBody((s) => ({ ...s, expire_at: t }));
            }}
          />
        </Field>

        <div className="lg:col-span-2 flex flex-col items-stretch justify-between gap-3 rounded-md bg-gia-gradient-soft p-4 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-small text-text-secondary">
            <AlertCircle size={16} className="text-gia-500" />
            预计生成：
            <strong className="text-text-primary mx-1">{fmtNumber(body.qty)}</strong>
            张，单码价值
            <strong className="text-text-primary mx-1">{fmtPoints(body.points)} 点</strong>，
            合计
            <strong className="text-gia-500 mx-1">{fmtPoints(body.points * body.qty)} 点</strong>
          </div>
          <button type="submit" className="btn btn-primary btn-md md:shrink-0" disabled={m.isPending}>
            {m.isPending ? '生成中…' : '立即生成批次'}
          </button>
        </div>
        </form>
      </div>

      {last && (
        <div className="dialog-surface w-full">
          <div className="modal-header-grad mhg-emerald">
            <div className="flex items-center gap-3">
              <div className="modal-icon"><CheckCircle2 size={20}/></div>
              <div>
                <h3>批次生成成功</h3>
                <p>批次 #{last.id} · {last.batch_no}</p>
              </div>
            </div>
          </div>
          <div className="modal-body">
            <div className="flex flex-wrap gap-6 text-small">
              <div><div className="text-text-tertiary mb-1">批次 ID</div><div className="font-mono font-bold">#{last.id}</div></div>
              <div><div className="text-text-tertiary mb-1">批次号</div><code className="kbd">{last.batch_no}</code></div>
              <div><div className="text-text-tertiary mb-1">生成数量</div><div className="font-bold text-success">{fmtNumber(last.total_qty)} 张</div></div>
            </div>
            <p className="mt-3 text-tiny text-text-tertiary">详细码列表请前往数据库或后续 CDK 导出功能（CSV）查看。</p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
