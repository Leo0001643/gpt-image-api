import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Image as ImageIcon, MessageSquare,
  Play, Plus, RefreshCw, Save, Trash2, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../lib/api';
import { systemApi } from '../../lib/services';
import { toast } from '../../stores/toast';

/* ─── types ─── */
interface PriceRow {
  model_code: string;
  name: string;
  kind: 'text' | 'image' | 'video';
  provider: 'gpt' | 'grok' | string;
  upstream_model: string;
  unit_points: number;
  input_unit_points: number;
  output_unit_points: number;
  enabled: boolean;
}

const PROVIDERS = ['gpt', 'grok'] as const;

/* ─── kind visual config ─── */
const KIND_CFG = {
  image: { label: '图片', Icon: ImageIcon,      bg: 'bg-blue-50',   text: 'text-blue-500',   bar: 'bg-blue-400' },
  video: { label: '视频', Icon: Play,           bg: 'bg-amber-50',  text: 'text-amber-500',  bar: 'bg-amber-400' },
  text:  { label: '文字', Icon: MessageSquare,  bg: 'bg-emerald-50',text: 'text-emerald-600', bar: 'bg-emerald-400' },
} as const;

/* ─── defaults ─── */
const DEFAULT_ROWS: PriceRow[] = [
  { model_code: 'gpt-image-2',       name: 'GPT Image 2',     kind: 'image', provider: 'gpt',  upstream_model: 'gpt-image-2',       unit_points: 40, input_unit_points: 0,   output_unit_points: 0,   enabled: true },
  { model_code: 'grok-imagine-video', name: 'Grok 视频生成',   kind: 'video', provider: 'grok', upstream_model: 'grok-imagine-video', unit_points: 20, input_unit_points: 0,   output_unit_points: 0,   enabled: true },
  { model_code: 'grok-4.20-fast',    name: 'Grok 快速对话',   kind: 'text',  provider: 'grok', upstream_model: 'grok-4.20-fast',    unit_points: 0,  input_unit_points: 1,   output_unit_points: 3,   enabled: true },
  { model_code: 'grok-4.20-auto',    name: 'Grok 自动对话',   kind: 'text',  provider: 'grok', upstream_model: 'grok-4.20-auto',    unit_points: 0,  input_unit_points: 1.5, output_unit_points: 4.5, enabled: true },
];

/* ─── helpers ─── */
function fromValue(v: unknown): PriceRow[] {
  if (Array.isArray(v) && v.length > 0) {
    return v.map((r) => {
      const row = r as Partial<PriceRow>;
      return {
        model_code:         String(row.model_code || ''),
        name:               String(row.name || ''),
        kind:               row.kind === 'text' ? 'text' : row.kind === 'video' ? 'video' : 'image',
        provider:           String(row.provider || 'gpt'),
        upstream_model:     String(row.upstream_model || ''),
        unit_points:        Number(row.unit_points || 0) / 100,
        input_unit_points:  Number(row.input_unit_points || 0) / 100,
        output_unit_points: Number(row.output_unit_points || 0) / 100,
        enabled:            row.enabled !== false,
      };
    });
  }
  return DEFAULT_ROWS;
}

const numDisplay = (v: number) => (v === 0 ? '' : v);
const parseNum   = (s: string) => s === '' ? 0 : Math.max(0, Number(s) || 0);

/* ══════════════════════════════════════════════
   Page
══════════════════════════════════════════════ */
export default function ModelPricesPage() {
  const qc       = useQueryClient();
  const settings = useQuery({ queryKey: ['admin', 'system', 'settings'], queryFn: () => systemApi.get(), retry: 2 });

  const [rows, setRows]             = useState<PriceRow[]>(DEFAULT_ROWS);
  const [dirty, setDirty]           = useState(false);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  useEffect(() => {
    if (settings.data) {
      setRows(fromValue(settings.data['billing.model_prices']));
      setDirty(false);
    }
  }, [settings.data]);

  const upd = (idx: number, patch: Partial<PriceRow>) => {
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const del = (idx: number) => {
    setRows((p) => p.filter((_, i) => i !== idx));
    setConfirmDel(null);
    setDirty(true);
  };

  const add = () => {
    setRows((p) => [...p, { model_code: '', name: '', kind: 'image', provider: 'gpt', upstream_model: '', unit_points: 0, input_unit_points: 0, output_unit_points: 0, enabled: true }]);
    setDirty(true);
    setTimeout(() => document.getElementById('models-end')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const hasError = rows.some((r) => !r.model_code.trim() || !r.name.trim());

  const save = useMutation({
    mutationFn: () => systemApi.update({
      'billing.model_prices': rows.map((r) => ({
        ...r,
        model_code:         r.model_code.trim(),
        name:               r.name.trim(),
        upstream_model:     r.upstream_model.trim(),
        unit_points:        Math.round((Number(r.unit_points) || 0) * 100),
        input_unit_points:  Math.round((Number(r.input_unit_points) || 0) * 100),
        output_unit_points: Math.round((Number(r.output_unit_points) || 0) * 100),
      })),
    }),
    onSuccess: () => {
      toast.success('模型价格已保存');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['admin', 'system'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  /* summary */
  const imgN   = rows.filter((r) => r.kind === 'image').length;
  const vidN   = rows.filter((r) => r.kind === 'video').length;
  const txtN   = rows.filter((r) => r.kind === 'text').length;
  const onN    = rows.filter((r) => r.enabled).length;

  return (
    <div className="page page-wide space-y-6">

      {/* ── Header ── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">模型价格</h1>
          <p className="page-subtitle">配置前台可用模型、上游映射与计费单价</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-md" onClick={() => settings.refetch()} disabled={settings.isFetching}>
            <RefreshCw size={14} className={settings.isFetching ? 'animate-spin' : ''} />
            刷新
          </button>
          <button
            className="btn btn-primary btn-md"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || hasError}
          >
            <Save size={14} />
            {save.isPending ? '保存中…' : dirty ? '保存修改' : '已是最新'}
          </button>
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '全部', value: rows.length,    sub: `${onN} 启用`,  color: 'from-gia-500 to-gia-600' },
          { label: '图片', value: imgN,           sub: '图像生成',     color: 'from-blue-400 to-blue-500' },
          { label: '视频', value: vidN,           sub: '视频生成',     color: 'from-amber-400 to-amber-500' },
          { label: '文字', value: txtN,           sub: '对话模型',     color: 'from-emerald-400 to-emerald-500' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="card overflow-hidden">
            <div className={`h-1 w-full bg-gradient-to-r ${color}`} />
            <div className="px-5 py-4">
              <div className="text-h2 font-semibold tabular-nums">{value}</div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-small text-text-secondary">{label}</span>
                <span className="text-tiny text-text-tertiary">{sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error / Warn ── */}
      {settings.isError && (
        <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-small text-warning">
          <span className="flex items-center gap-2"><AlertCircle size={14} />配置加载失败，当前显示默认模板</span>
          <button className="btn btn-outline btn-sm" onClick={() => settings.refetch()}><RefreshCw size={12} />重试</button>
        </div>
      )}
      {hasError && dirty && (
        <div className="flex items-center gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-small text-danger">
          <AlertCircle size={14} className="shrink-0" />
          请先填写所有行的「模型编码」和「显示名称」
        </div>
      )}

      {/* ── Model list ── */}
      {settings.isLoading ? (
        <div className="card divide-y divide-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="w-10 h-10 rounded-xl bg-surface-2 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 rounded-full bg-surface-2 animate-pulse" />
                <div className="h-3 w-24 rounded-full bg-surface-2 animate-pulse" />
              </div>
              <div className="h-3 w-16 rounded-full bg-surface-2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {/* Column header */}
          <div className="grid items-center gap-3 px-6 py-3 bg-surface-2 rounded-t-[var(--radius-lg)] text-tiny text-text-tertiary font-medium uppercase tracking-wide"
            style={{ gridTemplateColumns: '200px 160px minmax(0,1fr) 200px auto' }}>
            <span>模型编码 / 名称</span>
            <span>供应商 / 类型</span>
            <span>上游模型映射</span>
            <span>计费单价（点）</span>
            <span />
          </div>

          {rows.length === 0 && (
            <div className="py-16 text-center text-text-tertiary text-small">
              暂无模型，点击下方「添加模型」开始配置
            </div>
          )}

          {rows.map((row, idx) => {
            const cfg    = KIND_CFG[row.kind] ?? KIND_CFG.image;
            const KIcon  = cfg.Icon;
            const isText = row.kind === 'text';
            const rowErr = !row.model_code.trim() || !row.name.trim();

            return (
              <div
                key={idx}
                className={`group grid items-center gap-3 px-6 py-4 transition-colors ${
                  rowErr ? 'bg-danger-soft/30' : 'hover:bg-surface-2/60'
                }`}
                style={{ gridTemplateColumns: '200px 160px minmax(0,1fr) 200px auto' }}
              >
                {/* ① 模型编码 + 名称 */}
                <div className="flex flex-col gap-1.5 min-w-0">
                  <GhostInput
                    value={row.model_code}
                    onChange={(v) => upd(idx, { model_code: v })}
                    placeholder="model-code"
                    mono
                    error={rowErr && !row.model_code.trim()}
                  />
                  <GhostInput
                    value={row.name}
                    onChange={(v) => upd(idx, { name: v })}
                    placeholder="显示名称"
                    sm
                    muted
                    error={rowErr && !row.name.trim()}
                  />
                </div>

                {/* ② 供应商 + 类型 */}
                <div className="flex flex-col gap-1.5">
                  {/* provider badge-select */}
                  <select
                    value={row.provider}
                    onChange={(e) => upd(idx, { provider: e.target.value })}
                    className="appearance-none h-7 px-2.5 rounded-md text-tiny font-medium border border-transparent bg-surface-2 text-text-secondary hover:border-border focus:outline-none focus:border-gia-500 transition cursor-pointer w-fit"
                  >
                    {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {/* kind icon-select */}
                  <select
                    value={row.kind}
                    onChange={(e) => upd(idx, { kind: e.target.value as PriceRow['kind'] })}
                    className={`appearance-none h-7 px-2.5 rounded-md text-tiny font-medium border border-transparent ${cfg.bg} ${cfg.text} hover:border-border focus:outline-none focus:border-gia-500 transition cursor-pointer w-fit`}
                  >
                    <option value="image">图片</option>
                    <option value="video">视频</option>
                    <option value="text">文字</option>
                  </select>
                </div>

                {/* ③ 上游模型 */}
                <GhostInput
                  value={row.upstream_model}
                  onChange={(v) => upd(idx, { upstream_model: v })}
                  placeholder="同上游模型名"
                  mono
                  muted
                />

                {/* ④ 计费 */}
                <div className="flex items-center gap-2">
                  {isText ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-tiny text-text-tertiary shrink-0">输入</span>
                        <PriceInput value={row.input_unit_points}  onChange={(v) => upd(idx, { input_unit_points: v })} />
                      </div>
                      <span className="text-text-tertiary text-tiny">/</span>
                      <div className="flex items-center gap-1">
                        <span className="text-tiny text-text-tertiary shrink-0">输出</span>
                        <PriceInput value={row.output_unit_points} onChange={(v) => upd(idx, { output_unit_points: v })} />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <PriceInput value={row.unit_points} onChange={(v) => upd(idx, { unit_points: v })} />
                      <span className="text-tiny text-text-tertiary shrink-0">点 / 次</span>
                    </div>
                  )}
                </div>

                {/* ⑤ 状态 + 删除 */}
                <div className="flex items-center gap-3 justify-end">
                  {/* toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    onClick={() => upd(idx, { enabled: !row.enabled })}
                    title={row.enabled ? '点击停用' : '点击启用'}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      row.enabled ? 'bg-gia-500' : 'bg-surface-3'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      row.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </button>

                  {/* delete with confirm */}
                  {confirmDel === idx ? (
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => del(idx)}
                        title="确认删除"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm text-text-tertiary"
                        onClick={() => setConfirmDel(null)}
                        title="取消"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-icon btn-sm text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setConfirmDel(idx)}
                      title="删除此模型"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <div id="models-end" />
        </div>
      )}

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between">
        <button className="btn btn-outline btn-md" onClick={add}>
          <Plus size={14} /> 添加模型
        </button>
        <p className="text-tiny text-text-tertiary">
          共 {rows.length} 个模型 · {onN} 个已启用 · 单价 0 = 免费
        </p>
      </div>

      {/* ── Field guide ── */}
      <div className="card card-section bg-surface-2/60">
        <p className="text-tiny text-text-tertiary uppercase tracking-wide mb-3">字段说明</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5 text-small text-text-secondary">
          <div><span className="text-text-primary">模型编码</span> — 前端 / API 传入的 model 值</div>
          <div><span className="text-text-primary">上游模型</span> — 实际转发给 OpenAI / Grok 的名称</div>
          <div><span className="text-text-primary">单价</span> — 图片 / 视频每次消耗的积分，0 = 免费</div>
          <div><span className="text-text-primary">输入 / 输出</span> — 文字按千 Token 分别计费</div>
          <div><span className="text-text-primary">供应商</span> — gpt = OpenAI，grok = x.ai</div>
          <div><span className="text-text-primary">状态开关</span> — 关闭后用户端不可见该模型</div>
        </div>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════
   Ghost Input — 默认无边框，交互时显现
══════════════════════════════════════════════ */
function GhostInput({
  value, onChange, placeholder, mono, sm, muted, error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  sm?: boolean;
  muted?: boolean;
  error?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      className={[
        'w-full min-w-0 bg-transparent border-b transition-colors outline-none',
        'placeholder:text-text-tertiary',
        sm ? 'text-small py-0.5' : 'text-body py-0.5',
        mono ? 'font-mono' : '',
        muted ? 'text-text-secondary' : 'text-text-primary',
        error
          ? 'border-danger'
          : 'border-transparent hover:border-border focus:border-gia-500',
      ].join(' ')}
    />
  );
}

/* ══════════════════════════════════════════════
   Price Input — 数字输入框，最小化显示
══════════════════════════════════════════════ */
function PriceInput({
  value, onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      step={0.1}
      value={numDisplay(value)}
      placeholder="0"
      onChange={(e) => onChange(parseNum(e.target.value))}
      className="w-16 min-w-0 bg-transparent border-b border-transparent hover:border-border focus:border-gia-500 transition-colors outline-none text-body tabular-nums text-center py-0.5 placeholder:text-text-tertiary"
    />
  );
}
