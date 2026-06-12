import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Image as ImageIcon, MessageSquare, Play,
  Plus, RefreshCw, Save, Trash2, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../../lib/api';
import { systemApi } from '../../lib/services';
import { toast } from '../../stores/toast';

/* ─────────────────── types ─────────────────── */
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

/* ─────────────────── defaults ─────────────────── */
const DEFAULT_ROWS: PriceRow[] = [
  {
    model_code: 'gpt-image-2', name: 'GPT Image 2',
    kind: 'image', provider: 'gpt', upstream_model: 'gpt-image-2',
    unit_points: 40, input_unit_points: 0, output_unit_points: 0, enabled: true,
  },
  {
    model_code: 'grok-imagine-video', name: 'Grok 视频生成',
    kind: 'video', provider: 'grok', upstream_model: 'grok-imagine-video',
    unit_points: 20, input_unit_points: 0, output_unit_points: 0, enabled: true,
  },
  {
    model_code: 'grok-4.20-fast', name: 'Grok 快速对话',
    kind: 'text', provider: 'grok', upstream_model: 'grok-4.20-fast',
    unit_points: 0, input_unit_points: 1, output_unit_points: 3, enabled: true,
  },
  {
    model_code: 'grok-4.20-auto', name: 'Grok 自动对话',
    kind: 'text', provider: 'grok', upstream_model: 'grok-4.20-auto',
    unit_points: 0, input_unit_points: 1.5, output_unit_points: 4.5, enabled: true,
  },
];

/* ─────────────────── helpers ─────────────────── */
const KIND_META = {
  image: { label: '图片', icon: ImageIcon,       cls: 'bg-info-soft text-gia-600' },
  video: { label: '视频', icon: Play,            cls: 'bg-warning-soft text-warning' },
  text:  { label: '文字', icon: MessageSquare,   cls: 'bg-success-soft text-success' },
} as const;

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

/** 避免 `|| 0` 死循环：0 显示为空字符串，让用户可以清除后重新输入 */
const numDisplay = (v: number) => (v === 0 ? '' : v);
const parseNum   = (s: string) => s === '' ? 0 : Math.max(0, Number(s) || 0);

/* ─────────────────── page ─────────────────── */
export default function ModelPricesPage() {
  const qc = useQueryClient();
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
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const del = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setConfirmDel(null);
    setDirty(true);
  };

  const add = () => {
    setRows((prev) => [...prev, {
      model_code: '', name: '', kind: 'image', provider: 'gpt', upstream_model: '',
      unit_points: 0, input_unit_points: 0, output_unit_points: 0, enabled: true,
    }]);
    setDirty(true);
    setTimeout(() => document.getElementById('table-bottom')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const hasError = rows.some((r) => !r.model_code.trim() || !r.name.trim());

  const save = useMutation({
    mutationFn: () => systemApi.update({
      'billing.model_prices': rows.map((r) => ({
        ...r,
        model_code:         r.model_code.trim(),
        name:               r.name.trim(),
        provider:           r.provider.trim(),
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

  /* ── summary stats ── */
  const enabledCount = rows.filter((r) => r.enabled).length;
  const imgCount     = rows.filter((r) => r.kind === 'image').length;
  const videoCount   = rows.filter((r) => r.kind === 'video').length;
  const textCount    = rows.filter((r) => r.kind === 'text').length;

  return (
    <div className="page page-wide space-y-5">

      {/* ── 页头 ── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">模型价格</h1>
          <p className="page-subtitle">配置模型编码、上游映射、供应商和计费单价</p>
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

      {/* ── KPI 数字条 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '全部模型', value: rows.length, cls: '' },
          { label: '图片', value: imgCount, cls: KIND_META.image.cls },
          { label: '视频', value: videoCount, cls: KIND_META.video.cls },
          { label: '文字', value: textCount, cls: KIND_META.text.cls },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card card-section py-4 flex items-center gap-3">
            <div className={`w-2 h-8 rounded-full ${cls || 'bg-surface-3'}`} />
            <div>
              <div className="text-h3 font-semibold">{value}</div>
              <div className="text-tiny text-text-tertiary mt-0.5">{label}</div>
            </div>
            {label === '全部模型' && (
              <div className="ml-auto text-tiny text-text-tertiary">
                {enabledCount} 启用
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── 校验提示 ── */}
      {hasError && dirty && (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-small text-warning">
          <AlertCircle size={15} className="shrink-0" />
          存在未填写的「模型编码」或「显示名称」，请补全后再保存
        </div>
      )}

      {/* ── 表格 ── */}
      {settings.isLoading ? (
        <div className="card card-section">
          <div className="space-y-3">
            {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-lg bg-surface-2 animate-pulse" />)}
          </div>
        </div>
      ) : settings.isError ? (
        <div className="card card-section flex items-center justify-between">
          <div className="flex items-center gap-2 text-small text-danger">
            <AlertCircle size={15} />
            配置加载失败，当前显示默认模板，保存后将覆盖服务端配置
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => settings.refetch()}>
            <RefreshCw size={13} /> 重新加载
          </button>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table min-w-[860px] text-small">
            <thead>
              <tr>
                <th>模型编码</th>
                <th>显示名称</th>
                <th className="w-[90px]">类型</th>
                <th className="w-[100px]">供应商</th>
                <th>上游模型</th>
                <th className="w-[120px]">单价（点）</th>
                <th className="w-[180px]">输入 / 输出（文字）</th>
                <th className="w-[88px] text-center">状态</th>
                <th className="w-[56px]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const kindMeta = KIND_META[row.kind] ?? KIND_META.image;
                const KindIcon = kindMeta.icon;
                const isText   = row.kind === 'text';
                const rowErr   = !row.model_code.trim() || !row.name.trim();

                return (
                  <tr key={idx} className={rowErr ? 'bg-danger-soft/20' : undefined}>

                    {/* 模型编码 */}
                    <td>
                      <input
                        className={`input input-sm font-mono text-small w-full ${rowErr && !row.model_code.trim() ? 'border-danger' : ''}`}
                        value={row.model_code}
                        onChange={(e) => upd(idx, { model_code: e.target.value })}
                        placeholder="model-code"
                      />
                    </td>

                    {/* 显示名称 */}
                    <td>
                      <input
                        className={`input input-sm text-small w-full ${rowErr && !row.name.trim() ? 'border-danger' : ''}`}
                        value={row.name}
                        onChange={(e) => upd(idx, { name: e.target.value })}
                        placeholder="显示名称"
                      />
                    </td>

                    {/* 类型 */}
                    <td>
                      <select
                        className="input input-sm text-small"
                        value={row.kind}
                        onChange={(e) => upd(idx, { kind: e.target.value as PriceRow['kind'] })}
                      >
                        <option value="image">图片</option>
                        <option value="video">视频</option>
                        <option value="text">文字</option>
                      </select>
                    </td>

                    {/* 供应商 */}
                    <td>
                      <select
                        className="input input-sm text-small"
                        value={row.provider}
                        onChange={(e) => upd(idx, { provider: e.target.value })}
                      >
                        {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>

                    {/* 上游模型 */}
                    <td>
                      <input
                        className="input input-sm font-mono text-small w-full"
                        value={row.upstream_model}
                        onChange={(e) => upd(idx, { upstream_model: e.target.value })}
                        placeholder="—"
                      />
                    </td>

                    {/* 单价 */}
                    <td>
                      <input
                        className="input input-sm text-small tabular-nums"
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder="0"
                        disabled={isText}
                        value={isText ? '' : numDisplay(row.unit_points)}
                        onChange={(e) => upd(idx, { unit_points: parseNum(e.target.value) })}
                      />
                    </td>

                    {/* 输入/输出 */}
                    <td>
                      {isText ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="input input-sm text-small tabular-nums w-[70px]"
                            type="number" min={0} step={0.1} placeholder="输入"
                            value={numDisplay(row.input_unit_points)}
                            onChange={(e) => upd(idx, { input_unit_points: parseNum(e.target.value) })}
                          />
                          <span className="text-text-tertiary text-tiny shrink-0">/</span>
                          <input
                            className="input input-sm text-small tabular-nums w-[70px]"
                            type="number" min={0} step={0.1} placeholder="输出"
                            value={numDisplay(row.output_unit_points)}
                            onChange={(e) => upd(idx, { output_unit_points: parseNum(e.target.value) })}
                          />
                        </div>
                      ) : (
                        <span className="text-text-tertiary text-tiny">—</span>
                      )}
                    </td>

                    {/* 状态 toggle */}
                    <td className="text-center">
                      <button
                        onClick={() => upd(idx, { enabled: !row.enabled })}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-tiny border transition ${
                          row.enabled
                            ? 'bg-success-soft text-success border-success/20 hover:border-success/60'
                            : 'bg-surface-2 text-text-tertiary border-border hover:border-border-strong'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${row.enabled ? 'bg-success' : 'bg-surface-3'}`} />
                        {row.enabled ? '启用' : '停用'}
                      </button>
                    </td>

                    {/* 删除 */}
                    <td>
                      {confirmDel === idx ? (
                        <div className="flex items-center gap-1 justify-end">
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
                          className="btn btn-danger-ghost btn-icon btn-sm"
                          onClick={() => setConfirmDel(idx)}
                          title="删除此行"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-text-tertiary text-small">
                    暂无配置，点击下方添加模型
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div id="table-bottom" />
        </div>
      )}

      {/* ── 底部工具栏 ── */}
      <div className="flex items-center justify-between">
        <button className="btn btn-outline btn-md" onClick={add}>
          <Plus size={14} /> 添加模型
        </button>
        <p className="text-tiny text-text-tertiary">
          共 {rows.length} 个模型 · {enabledCount} 个已启用 · 单价单位：点，0 = 免费
        </p>
      </div>

      {/* ── 说明 ── */}
      <div className="card card-section">
        <h4 className="section-title mb-3">字段说明</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-small text-text-secondary">
          <div><strong className="text-text-primary">模型编码</strong> — 前端 / API 调用时传入的 model 值</div>
          <div><strong className="text-text-primary">上游模型</strong> — 实际转发给 OpenAI / Grok 的模型标识</div>
          <div><strong className="text-text-primary">单价（点）</strong> — 每次图片或视频生成的扣费量，0 = 免费</div>
          <div><strong className="text-text-primary">输入 / 输出</strong> — 文字模型按千 Token 计费，分别填写</div>
          <div><strong className="text-text-primary">供应商</strong> — gpt = OpenAI，grok = x.ai</div>
          <div><strong className="text-text-primary">状态</strong> — 停用后用户端不可见该模型</div>
        </div>
      </div>

    </div>
  );
}
