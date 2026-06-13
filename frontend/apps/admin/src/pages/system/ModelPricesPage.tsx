import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Image as ImageIcon, MessageSquare,
  Pencil, Play, Plus, RefreshCw, Save, Trash2, X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../lib/api';
import { systemApi } from '../../lib/services';
import { toast } from '../../stores/toast';

/* ─────────────────── types ─────────────────── */
interface PriceRow {
  model_code:         string;
  name:               string;
  kind:               'text' | 'image' | 'video';
  provider:           string;
  upstream_model:     string;
  unit_points:        number;
  input_unit_points:  number;
  output_unit_points: number;
  enabled:            boolean;
}

/* ─────────────────── visual config ─────────────────── */
const KIND_CFG = {
  image: { label: '图片', Icon: ImageIcon,     cls: 'bg-blue-100 text-blue-600',    dot: 'bg-blue-500'   },
  video: { label: '视频', Icon: Play,          cls: 'bg-amber-100 text-amber-600',  dot: 'bg-amber-500'  },
  text:  { label: '文字', Icon: MessageSquare, cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
} as const;

const PROVIDER_CLR: Record<string, string> = {
  gpt:  'bg-violet-100 text-violet-700',
  grok: 'bg-cyan-100 text-cyan-700',
};

/* ─────────────────── default rows ─────────────────── */
const DEFAULT_ROWS: PriceRow[] = [
  { model_code:'gpt-image-2',        name:'GPT Image 2',     kind:'image', provider:'gpt',  upstream_model:'gpt-image-2',        unit_points:40,  input_unit_points:0,   output_unit_points:0,   enabled:true },
  { model_code:'grok-imagine-video', name:'Grok 视频生成',   kind:'video', provider:'grok', upstream_model:'grok-imagine-video', unit_points:20,  input_unit_points:0,   output_unit_points:0,   enabled:true },
  { model_code:'grok-4.20-fast',     name:'Grok 快速对话',   kind:'text',  provider:'grok', upstream_model:'grok-4.20-fast',     unit_points:0,   input_unit_points:1,   output_unit_points:3,   enabled:true },
  { model_code:'grok-4.20-auto',     name:'Grok 自动对话',   kind:'text',  provider:'grok', upstream_model:'grok-4.20-auto',     unit_points:0,   input_unit_points:1.5, output_unit_points:4.5, enabled:true },
];

/* ─────────────────── helpers ─────────────────── */
function fromValue(v: unknown): PriceRow[] {
  if (!Array.isArray(v) || v.length === 0) return DEFAULT_ROWS;
  return v.map((r: unknown) => {
    const o = r as Partial<PriceRow>;
    return {
      model_code:         String(o.model_code || ''),
      name:               String(o.name || ''),
      kind:               o.kind === 'text' ? 'text' : o.kind === 'video' ? 'video' : 'image',
      provider:           String(o.provider || 'gpt'),
      upstream_model:     String(o.upstream_model || ''),
      unit_points:        Number(o.unit_points || 0) / 100,
      input_unit_points:  Number(o.input_unit_points || 0) / 100,
      output_unit_points: Number(o.output_unit_points || 0) / 100,
      enabled:            o.enabled !== false,
    };
  });
}

const priceLabel = (r: PriceRow) =>
  r.kind === 'text'
    ? `${r.input_unit_points} / ${r.output_unit_points} 点/千Token`
    : r.unit_points === 0 ? '免费' : `${r.unit_points} 点/次`;

/* ══════════════════════════════════════════════════════
   Main page
══════════════════════════════════════════════════════ */
export default function ModelPricesPage() {
  const qc   = useQueryClient();
  const cfg  = useQuery({ queryKey:['admin','system','settings'], queryFn:()=>systemApi.get(), retry:2 });

  const [rows, setRows]     = useState<PriceRow[]>(DEFAULT_ROWS);
  const [dirty, setDirty]   = useState(false);
  const [editing, setEdit]  = useState<number | null>(null);   // index in rows, -1 = new
  const [draft, setDraft]   = useState<PriceRow | null>(null);
  const [delIdx, setDelIdx] = useState<number | null>(null);

  useEffect(() => {
    if (cfg.data) { setRows(fromValue(cfg.data['billing.model_prices'])); setDirty(false); }
  }, [cfg.data]);

  /* save */
  const saveMut = useMutation({
    mutationFn: () => systemApi.update({
      'billing.model_prices': rows.map((r: PriceRow) => ({
        ...r,
        model_code:         r.model_code.trim(),
        name:               r.name.trim(),
        upstream_model:     r.upstream_model.trim(),
        unit_points:        Math.round((r.unit_points || 0) * 100),
        input_unit_points:  Math.round((r.input_unit_points || 0) * 100),
        output_unit_points: Math.round((r.output_unit_points || 0) * 100),
      })),
    }),
    onSuccess: () => { toast.success('已保存'); setDirty(false); qc.invalidateQueries({ queryKey:['admin','system'] }); },
    onError: (e: ApiError) => toast.error(e.message),
  });

  /* edit helpers */
  const openNew = () => {
    setDraft({ model_code:'', name:'', kind:'image', provider:'gpt', upstream_model:'', unit_points:0, input_unit_points:0, output_unit_points:0, enabled:true });
    setEdit(-1);
  };
  const openEdit = (i: number) => { setDraft({ ...rows[i] }); setEdit(i); };
  const closeEdit = () => { setEdit(null); setDraft(null); };

  const commitDraft = () => {
    if (!draft || !draft.model_code.trim() || !draft.name.trim()) { toast.error('请填写模型编码和名称'); return; }
    setRows((prev: PriceRow[]) => {
      const next = [...prev];
      if (editing === -1) next.push(draft);
      else next[editing!] = draft;
      return next;
    });
    setDirty(true);
    closeEdit();
  };

  const del = (i: number) => { setRows((p: PriceRow[]) => p.filter((_: PriceRow, j: number) => j !== i)); setDirty(true); setDelIdx(null); };

  const toggle = (i: number) => { setRows((p: PriceRow[]) => p.map((r: PriceRow, j: number) => j===i ? {...r, enabled:!r.enabled} : r)); setDirty(true); };

  /* summary counts */
  const imgN = rows.filter((r: PriceRow)=>r.kind==='image').length;
  const vidN = rows.filter((r: PriceRow)=>r.kind==='video').length;
  const txtN = rows.filter((r: PriceRow)=>r.kind==='text').length;
  const onN  = rows.filter((r: PriceRow)=>r.enabled).length;

  return (
    <div className="page page-wide space-y-6">

      {/* ── page header ─────────────────── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">模型价格</h1>
          <p className="page-subtitle">配置前台可用模型、上游映射与计费单价</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-md" onClick={()=>cfg.refetch()} disabled={cfg.isFetching}>
            <RefreshCw size={14} className={cfg.isFetching?'animate-spin':''}/> 刷新
          </button>
          <button
            className="btn btn-primary btn-md"
            onClick={()=>saveMut.mutate()}
            disabled={!dirty||saveMut.isPending}
          >
            <Save size={14}/> {saveMut.isPending?'保存中…':'保存修改'}
          </button>
        </div>
      </header>

      {/* ── kpi strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label:'全部模型', value:rows.length, sub:`${onN} 启用`,  accent:'#6366f1' },
          { label:'图片模型', value:imgN,        sub:'image',         accent:'#3b82f6' },
          { label:'视频模型', value:vidN,        sub:'video',         accent:'#f59e0b' },
          { label:'文字模型', value:txtN,        sub:'text',          accent:'#10b981' },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="card overflow-hidden">
            <div style={{ height:3, background:accent }} />
            <div className="px-5 py-4">
              <div className="text-2xl font-bold tabular-nums">{value}</div>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-small text-text-secondary">{label}</span>
                <span className="text-tiny text-text-tertiary font-mono">{sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── alerts ─────────────────────────────────────── */}
      {cfg.isError && (
        <div className="flex items-center justify-between rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-small text-warning">
          <span className="flex items-center gap-2"><AlertCircle size={14}/>配置加载失败，显示默认模板</span>
          <button className="btn btn-sm btn-outline" onClick={()=>cfg.refetch()}><RefreshCw size={12}/>重试</button>
        </div>
      )}

      {/* ── model list ─────────────────────────────────── */}
      <div className="card">
        {/* list header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="text-small font-semibold text-text-secondary uppercase tracking-wide">
            模型列表 · {rows.length} 个
          </span>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={13}/> 添加模型
          </button>
        </div>

        {/* skeleton */}
        {cfg.isLoading && (
          <div className="divide-y divide-border">
            {[0,1,2,3].map(i=>(
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="w-10 h-10 rounded-xl bg-surface-2 animate-pulse shrink-0"/>
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-surface-2 animate-pulse"/>
                  <div className="h-3 w-24 rounded bg-surface-2 animate-pulse"/>
                </div>
                <div className="h-6 w-20 rounded-full bg-surface-2 animate-pulse"/>
              </div>
            ))}
          </div>
        )}

        {/* empty */}
        {!cfg.isLoading && rows.length === 0 && (
          <div className="py-20 text-center text-text-tertiary text-small">
            暂无模型，点击「添加模型」开始配置
          </div>
        )}

        {/* rows */}
        {!cfg.isLoading && (
          <div className="divide-y divide-border">
            {rows.map((row: PriceRow, i: number) => {
              const kcfg   = KIND_CFG[row.kind as keyof typeof KIND_CFG] ?? KIND_CFG.image;
              const KIcon  = kcfg.Icon;
              const pcolor = PROVIDER_CLR[row.provider] ?? 'bg-surface-3 text-text-secondary';

              return (
                <div key={i} className="group flex items-center gap-4 px-6 py-4 hover:bg-surface-2/50 transition-colors">

                  {/* kind icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kcfg.cls}`}>
                    <KIcon size={16}/>
                  </div>

                  {/* model info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-body font-medium text-text-primary">{row.model_code || '—'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-tiny font-medium ${pcolor}`}>{row.provider}</span>
                      <span className={`px-2 py-0.5 rounded-full text-tiny font-medium ${kcfg.cls}`}>{kcfg.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-small text-text-secondary truncate">{row.name}</span>
                      {row.upstream_model && row.upstream_model !== row.model_code && (
                        <span className="text-tiny text-text-tertiary font-mono">↗ {row.upstream_model}</span>
                      )}
                    </div>
                  </div>

                  {/* price badge */}
                  <div className="text-small font-medium tabular-nums text-text-primary min-w-[120px] text-right shrink-0">
                    {priceLabel(row)}
                  </div>

                  {/* status toggle */}
                  <button
                    type="button"
                    title={row.enabled ? '点击停用' : '点击启用'}
                    onClick={() => toggle(i)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none ${
                      row.enabled ? 'bg-gia-500' : 'bg-surface-3'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform my-0.5 ${
                      row.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}/>
                  </button>

                  {/* action buttons — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      className="btn btn-ghost btn-icon btn-sm text-text-secondary"
                      onClick={() => openEdit(i)}
                      title="编辑"
                    >
                      <Pencil size={14}/>
                    </button>
                    {delIdx === i ? (
                      <>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={()=>del(i)} title="确认删除">
                          <Trash2 size={13}/>
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm text-text-tertiary" onClick={()=>setDelIdx(null)} title="取消">
                          <X size={13}/>
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost btn-icon btn-sm text-text-tertiary" onClick={()=>setDelIdx(i)} title="删除">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── footer note ─────────────────────────────────── */}
      <p className="text-tiny text-text-tertiary text-center pb-2">
        单价 0 = 免费 · 文字模型按千 Token 分输入/输出计费 · 图片视频按次计费
      </p>

      {/* ══════════════════════════════════════════════
          Edit Modal
      ══════════════════════════════════════════════ */}
      {editing !== null && draft && (
        <EditModal
          draft={draft}
          isNew={editing === -1}
          onChange={setDraft}
          onConfirm={commitDraft}
          onClose={closeEdit}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Edit Modal
══════════════════════════════════════════════════════ */
interface EditModalProps {
  draft:     PriceRow;
  isNew:     boolean;
  onChange:  (r: PriceRow) => void;
  onConfirm: () => void;
  onClose:   () => void;
}
function EditModal({ draft, isNew, onChange, onConfirm, onClose }: EditModalProps) {
  const upd = (patch: Partial<PriceRow>) => onChange({ ...draft, ...patch });
  const isText = draft.kind === 'text';
  const ref = useRef<HTMLDivElement>(null);

  /* close on backdrop click */
  const onBackdrop = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => { if (e.target === e.currentTarget) onClose(); };
  /* close on Escape */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const hasErr = !draft.model_code.trim() || !draft.name.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onBackdrop}
    >
      <div ref={ref} className="card w-full max-w-lg shadow-2xl animate-fade-up" onClick={e=>e.stopPropagation()}>
        {/* modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-heading font-semibold">{isNew ? '添加模型' : '编辑模型'}</h2>
          <button className="btn btn-ghost btn-icon btn-sm text-text-tertiary" onClick={onClose}><X size={16}/></button>
        </div>

        {/* modal body */}
        <div className="px-6 py-5 space-y-5">

          {/* code + name */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="模型编码 *" error={!draft.model_code.trim()}>
              <input
                autoFocus
                className="input font-mono"
                value={draft.model_code}
                onChange={e=>upd({ model_code: e.target.value })}
                placeholder="gpt-image-2"
              />
            </Field>
            <Field label="显示名称 *" error={!draft.name.trim()}>
              <input
                className="input"
                value={draft.name}
                onChange={e=>upd({ name: e.target.value })}
                placeholder="GPT Image 2"
              />
            </Field>
          </div>

          {/* kind + provider */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="模型类型">
              <select className="input" value={draft.kind} onChange={e=>upd({ kind: e.target.value as PriceRow['kind'] })}>
                <option value="image">🖼 图片</option>
                <option value="video">▶ 视频</option>
                <option value="text">💬 文字</option>
              </select>
            </Field>
            <Field label="供应商">
              <select className="input" value={draft.provider} onChange={e=>upd({ provider: e.target.value })}>
                <option value="gpt">gpt (OpenAI)</option>
                <option value="grok">grok (x.ai)</option>
              </select>
            </Field>
          </div>

          {/* upstream */}
          <Field label="上游模型映射">
            <input
              className="input font-mono"
              value={draft.upstream_model}
              onChange={e=>upd({ upstream_model: e.target.value })}
              placeholder="留空则与编码相同"
            />
          </Field>

          {/* pricing */}
          {isText ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="输入单价（点/千Token）">
                <input type="number" className="input" min={0} step={0.1} value={draft.input_unit_points || ''}
                  placeholder="0" onChange={e=>upd({ input_unit_points: Number(e.target.value)||0 })}/>
              </Field>
              <Field label="输出单价（点/千Token）">
                <input type="number" className="input" min={0} step={0.1} value={draft.output_unit_points || ''}
                  placeholder="0" onChange={e=>upd({ output_unit_points: Number(e.target.value)||0 })}/>
              </Field>
            </div>
          ) : (
            <Field label="单次价格（点/次）" hint="0 = 免费">
              <input type="number" className="input" min={0} value={draft.unit_points || ''}
                placeholder="0" onChange={e=>upd({ unit_points: Number(e.target.value)||0 })}/>
            </Field>
          )}

          {/* enabled */}
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-body font-medium">启用状态</p>
              <p className="text-tiny text-text-tertiary mt-0.5">关闭后用户端不可选择此模型</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft.enabled}
              onClick={()=>upd({ enabled: !draft.enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${draft.enabled?'bg-gia-500':'bg-surface-3'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow my-0.5 transition-transform ${draft.enabled?'translate-x-5':'translate-x-0.5'}`}/>
            </button>
          </div>
        </div>

        {/* modal footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-surface-2/50 rounded-b-[var(--radius-lg)]">
          <button className="btn btn-outline btn-md" onClick={onClose}>取消</button>
          <button className="btn btn-primary btn-md" onClick={onConfirm} disabled={hasErr}>
            {isNew ? <><Plus size={14}/> 添加</> : <><Save size={14}/> 保存</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Field wrapper ─── */
function Field({ label, children, error, hint }: { label: string; children: ReactNode; error?: boolean; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className={`block text-small font-medium ${error ? 'text-danger' : 'text-text-primary'}`}>{label}</label>
      {children}
      {hint && <p className="text-tiny text-text-tertiary">{hint}</p>}
      {error && <p className="text-tiny text-danger">此项不能为空</p>}
    </div>
  );
}
