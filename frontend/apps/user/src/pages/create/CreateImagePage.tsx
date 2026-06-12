import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Download, Heart, Sparkles,
  RefreshCw, Check, Loader2,
} from 'lucide-react';
import clsx from 'clsx';

import { useEnsureLoggedIn } from '../../hooks/useEnsureLoggedIn';
import { ApiError } from '../../lib/api';
import { fmtPoints } from '../../lib/format';
import { genApi } from '../../lib/services';
import type { GenerationTask, PublicModel } from '../../lib/types';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';

/* ──────────────────────────────────────────────
   常量
────────────────────────────────────────────── */
const RATIOS = [
  { value: '1:1',  w: 1, h: 1 },
  { value: '3:4',  w: 3, h: 4 },
  { value: '4:3',  w: 4, h: 3 },
  { value: '16:9', w: 16, h: 9 },
  { value: '9:16', w: 9, h: 16 },
] as const;

const COUNTS = [1, 2, 4] as const;

const QUALITY = [
  { value: 'standard', label: '标准' },
  { value: 'hd',       label: '高清' },
] as const;

const PROMPT_CHIPS = ['电影级构图', '超写实', '赛博朋克', '微距摄影', '梦幻光影', '极简主义'];

const GEN_PHRASES = [
  '正在构建画面结构…',
  '填充光影层次…',
  '润色细节质感…',
  'AI 正在创作中…',
  '作品即将呈现…',
];

const STATUS_LABEL: Record<number, string> = {
  0: '队列中', 1: '生成中', 2: '已完成', 3: '失败', 4: '已退款', 5: '已取消',
};

type Ratio = (typeof RATIOS)[number]['value'];
type Quality = (typeof QUALITY)[number]['value'];

/* ──────────────────────────────────────────────
   主页面
────────────────────────────────────────────── */
export default function CreateImagePage() {
  const qc = useQueryClient();
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const ensureLoggedIn = useEnsureLoggedIn();

  /* 模型列表（动态从 API 加载） */
  const {
    data: allModels = [],
    isLoading: modelsLoading,
    isError: modelsError,
    refetch: refetchModels,
  } = useQuery({
    queryKey: ['gen.models'],
    queryFn: () => genApi.models(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
  // useMemo 防止每次渲染产生新数组引用，避免自动选模型的 useEffect 无限触发
  const imageModels = useMemo(
    () => allModels.filter((m) => m.kind === 'image' && m.enabled !== false),
    [allModels],
  );

  /* 表单状态 */
  const [modelCode, setModelCode] = useState('');
  const [ratio, setRatio] = useState<Ratio>('1:1');
  const [count, setCount] = useState<(typeof COUNTS)[number]>(1);
  const [quality, setQuality] = useState<Quality>('standard');
  const [prompt, setPrompt] = useState('');

  /* 任务状态 */
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const pollRef = useRef<number | null>(null);
  const phraseRef = useRef<number | null>(null);

  /* 首次加载完成后自动选中第一个模型 */
  useEffect(() => {
    if (imageModels.length > 0 && !modelCode) {
      setModelCode(imageModels[0]!.model_code);
    }
  }, [imageModels, modelCode]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (phraseRef.current) window.clearInterval(phraseRef.current);
    };
  }, []);

  /* 生成 mutation */
  const createMut = useMutation({
    mutationFn: () => genApi.createImage({ model: modelCode, prompt, count, ratio, quality }),
    onSuccess: (t) => {
      setTask(t);
      startPolling(t.task_id);
      startPhrases();
      void refreshMe();
      qc.invalidateQueries({ queryKey: ['gen.history'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '生成失败，请稍后重试'),
  });

  function startPolling(taskId: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const fresh = await genApi.getTask(taskId);
        setTask(fresh);
        // 终态：已完成 / 失败 / 已退款 / 已取消
        if (fresh.status === 2 || fresh.status === 3 || fresh.status === 4 || fresh.status === 5) {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          if (phraseRef.current) {
            window.clearInterval(phraseRef.current);
            phraseRef.current = null;
          }
          if (fresh.status === 2) toast.success('图像生成完成');
          else if (fresh.status === 3) toast.error(fresh.error || '生成失败');
          else if (fresh.status === 5) toast.info('任务已取消');
          else toast.info('任务失败，积分已退还');
          await refreshMe();
          qc.invalidateQueries({ queryKey: ['gen.history'] });
        }
      } catch {/* ignore */}
    }, 1500);
  }

  function startPhrases() {
    if (phraseRef.current) window.clearInterval(phraseRef.current);
    setPhraseIdx(0);
    phraseRef.current = window.setInterval(() => {
      setPhraseIdx((i) => (i + 1) % GEN_PHRASES.length);
    }, 2200);
  }

  const selectedModel = imageModels.find((m) => m.model_code === modelCode);
  const costPerImage  = Math.round((selectedModel?.unit_points ?? 0) / 100);
  const expectedCost  = costPerImage * count;
  const inProgress    = !!(task && (task.status === 0 || task.status === 1));
  const results       = task?.results ?? [];
  const canSubmit     = !!modelCode && !!prompt.trim() && !createMut.isPending && !inProgress;

  const submit = () => ensureLoggedIn(() => createMut.mutate(), '登录后即可开始创作');

  /* ── 渲染 ── */
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[clamp(300px,30vw,400px)_1fr] 2xl:grid-cols-[clamp(300px,26vw,380px)_1fr_clamp(220px,16vw,280px)]">

      {/* ══════════════ 左：参数面板 ══════════════ */}
      <aside className="flex flex-col border-r border-border bg-surface-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-6 lg:px-6 space-y-6">

          {/* 页头 */}
          <div>
            <h2 className="text-[22px] text-text-primary tracking-tight">图像创作</h2>
            <p className="text-small text-text-tertiary mt-1">选择模型，描述你的画面</p>
          </div>

          {/* ─ 模型选择 ─ */}
          <Section label="模型">
            {modelsLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[0,1,2,3].map(i => (
                  <div key={i} className="h-16 rounded-2xl bg-surface-2 animate-pulse" />
                ))}
              </div>
            ) : modelsError ? (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-small text-red-500">
                <span className="flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  模型加载失败
                </span>
                <button
                  type="button"
                  className="text-tiny underline underline-offset-2"
                  onClick={() => void refetchModels()}
                >
                  重试
                </button>
              </div>
            ) : imageModels.length === 0 ? (
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-small text-text-tertiary">
                <AlertCircle size={15} className="shrink-0" />
                暂无可用模型，请联系管理员配置
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {imageModels.map((m) => <ModelCard key={m.model_code} model={m} active={m.model_code === modelCode} onSelect={setModelCode} />)}
              </div>
            )}
          </Section>

          {/* ─ 提示词 ─ */}
          <Section label="提示词" aside={<span className="text-tiny text-text-tertiary tabular-nums">{prompt.length}/4000</span>}>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="描述你想要的画面…越具体，效果越好"
                className="studio-prompt w-full resize-none rounded-2xl border border-border bg-surface-2 px-4 py-3 text-small text-text-primary placeholder:text-text-tertiary focus:bg-white transition-colors leading-relaxed"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PROMPT_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip text-tiny"
                  onClick={() => setPrompt((p) => (p ? `${p.trimEnd()}, ${c}` : c))}
                >
                  {c}
                </button>
              ))}
            </div>
          </Section>

          {/* ─ 比例 ─ */}
          <Section label="画面比例">
            <div className="flex items-center gap-2">
              {RATIOS.map((r) => (
                <RatioButton
                  key={r.value}
                  ratio={r}
                  active={r.value === ratio}
                  onClick={() => setRatio(r.value)}
                />
              ))}
            </div>
          </Section>

          {/* ─ 数量 & 质量 ─ */}
          <div className="grid grid-cols-2 gap-5">
            <Section label="数量">
              <div className="flex gap-1.5">
                {COUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCount(c)}
                    className={clsx(
                      'flex-1 h-10 rounded-xl border text-small transition',
                      c === count
                        ? 'border-transparent bg-[#111] text-white'
                        : 'border-border text-text-secondary hover:border-[#111] hover:text-text-primary bg-surface-2',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="质量">
              <div className="flex gap-1.5">
                {QUALITY.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setQuality(q.value)}
                    className={clsx(
                      'flex-1 h-10 rounded-xl border text-small transition',
                      q.value === quality
                        ? 'border-transparent bg-[#111] text-white'
                        : 'border-border text-text-secondary hover:border-[#111] hover:text-text-primary bg-surface-2',
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>

        {/* ── 底部 CTA ── */}
        <div className="border-t border-border px-5 lg:px-6 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] bg-surface-1">
          <div className="flex items-center justify-between mb-3">
            <span className="text-small text-text-tertiary">预计消耗</span>
            <span className="text-small text-text-primary tabular-nums">
              {expectedCost > 0 ? `${expectedCost} 点` : '免费'}
            </span>
          </div>
          <button
            className={clsx(
              'w-full h-[52px] rounded-full text-[15px] flex items-center justify-center gap-2 transition',
              canSubmit
                ? 'bg-[#111] text-white hover:bg-[#222] active:scale-[.98]'
                : 'bg-surface-2 text-text-tertiary cursor-not-allowed',
            )}
            onClick={submit}
            disabled={!canSubmit}
          >
            {(createMut.isPending || inProgress) ? (
              <><Loader2 size={16} className="animate-spin" />生成中…</>
            ) : (
              <><Sparkles size={16} />立即生成</>
            )}
          </button>
        </div>
      </aside>

      {/* ══════════════ 中：结果区 ══════════════ */}
      <main className="overflow-y-auto bg-[#f9f9f9]">
        <div className="p-6 lg:p-10">

          {/* 结果区标题栏 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-[18px] text-text-primary">生成结果</h3>
              {task && <TaskStatusBadge status={task.status} progress={task.progress} />}
            </div>
            <button
              className="btn btn-outline btn-md rounded-full text-small"
              onClick={submit}
              disabled={!canSubmit}
            >
              <RefreshCw size={14} />
              再次生成
            </button>
          </div>

          {/* 图片网格 */}
          <div className={clsx(
            'grid gap-3',
            count === 1 ? 'grid-cols-1 max-w-sm' :
            count === 2 ? 'grid-cols-2' :
            'grid-cols-2',
          )}>
            {results.length > 0 ? (
              results.map((r, i) => (
                <article
                  key={r.url}
                  className="group relative overflow-hidden rounded-2xl bg-surface-2 shadow-sm"
                  style={{ aspectRatio: ratio.replace(':', '/') }}
                >
                  <img
                    src={r.url}
                    alt={`生成结果 ${i + 1}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="relative flex justify-end gap-2 p-3">
                      <button
                        className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/35 transition"
                        title="收藏"
                      >
                        <Heart size={15} />
                      </button>
                      <a
                        href={r.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/35 transition"
                        title="下载"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              Array.from({ length: count }).map((_, i) => (
                <article
                  key={i}
                  className="relative overflow-hidden rounded-2xl"
                  style={{ aspectRatio: ratio.replace(':', '/') }}
                >
                  {inProgress ? (
                    <>
                      <div className="generating-dots" />
                      <div className="generating-dots__phrases">
                        <p
                          key={phraseIdx}
                          className="generating-dots__phrase generating-dots__phrase--active"
                        >
                          {GEN_PHRASES[phraseIdx % GEN_PHRASES.length]}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 border border-dashed border-[#e0e0e0] rounded-2xl bg-[#fafafa] grid place-items-center">
                      <div className="text-center text-text-tertiary">
                        <div className="w-10 h-10 rounded-full border border-dashed border-[#d5d5d5] grid place-items-center mx-auto mb-2">
                          <Sparkles size={16} strokeWidth={1.5} />
                        </div>
                        <p className="text-tiny">等待生成</p>
                      </div>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>

          {/* 底部提示 */}
          <p className="mt-8 text-small text-text-tertiary leading-relaxed">
            生成结果将自动保存至「生成历史」，可在 14 天内重新下载。
            支持 OpenAI 兼容接口，详见「API 调用」文档。
          </p>
        </div>
      </main>

      {/* ══════════════ 右：任务详情（≥1536px） ══════════════ */}
      <aside className="hidden 2xl:block border-l border-border bg-surface-1 overflow-y-auto">
        <div className="px-5 py-6 space-y-4">
          <h4 className="text-small text-text-secondary">当前任务</h4>
          {task ? (
            <div className="space-y-4">
              <TaskStatusBadge status={task.status} progress={task.progress} />

              {inProgress && (
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${task.progress ?? 0}%` }} />
                </div>
              )}

              {prompt && (
                <p className="text-small text-text-secondary leading-relaxed line-clamp-5 border border-dashed border-border rounded-xl p-3">
                  {prompt}
                </p>
              )}

              <div className="space-y-2 pt-1">
                {[
                  { label: '模型', value: task.model },
                  { label: '消耗', value: `${fmtPoints(task.cost_points)} 点` },
                  { label: 'ID', value: task.task_id.slice(0, 10) + '…' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-tiny">
                    <span className="text-text-tertiary">{label}</span>
                    <span className="text-text-secondary font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-text-tertiary text-small border border-dashed border-border rounded-2xl p-6">
              <Sparkles size={20} className="mx-auto mb-2 opacity-25" strokeWidth={1.5} />
              填写提示词并点击
              <br />「立即生成」开始创作
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ──────────────────────────────────────────────
   子组件
────────────────────────────────────────────── */

function Section({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-tiny text-text-secondary tracking-wide uppercase">{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function ModelCard({
  model,
  active,
  onSelect,
}: {
  model: PublicModel;
  active: boolean;
  onSelect: (code: string) => void;
}) {
  const pts = Math.round(model.unit_points / 100);
  return (
    <button
      type="button"
      onClick={() => onSelect(model.model_code)}
      className={clsx(
        'relative flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all duration-150',
        active
          ? 'border-[#111] bg-white shadow-sm'
          : 'border-border bg-surface-2 hover:border-[#ccc] hover:bg-white',
      )}
    >
      {active && (
        <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#111] grid place-items-center">
          <Check size={9} strokeWidth={3} className="text-white" />
        </span>
      )}
      <span className="text-small text-text-primary pr-5">{model.name}</span>
      <span className="text-tiny text-text-tertiary">
        {pts > 0 ? `${pts} 点 / 张` : '免费'}
      </span>
    </button>
  );
}

function RatioButton({
  ratio,
  active,
  onClick,
}: {
  ratio: { value: string; w: number; h: number };
  active: boolean;
  onClick: () => void;
}) {
  /* 将实际宽高比缩放到一个固定显示尺寸内 */
  const maxW = 22;
  const maxH = 22;
  const scale = Math.min(maxW / ratio.w, maxH / ratio.h);
  const displayW = Math.round(ratio.w * scale);
  const displayH = Math.round(ratio.h * scale);

  return (
    <button
      type="button"
      onClick={onClick}
      title={ratio.value}
      className={clsx(
        'flex-1 h-10 rounded-xl border flex flex-col items-center justify-center gap-1 transition',
        active
          ? 'border-[#111] bg-white shadow-sm'
          : 'border-border bg-surface-2 hover:border-[#ccc] hover:bg-white',
      )}
    >
      {/* 微型比例可视化 */}
      <div
        className={clsx(
          'border rounded-[2px] transition',
          active ? 'border-[#111] bg-[#111]' : 'border-text-tertiary',
        )}
        style={{ width: displayW, height: displayH }}
      />
      <span className="text-[10px] text-text-tertiary leading-none">{ratio.value}</span>
    </button>
  );
}

function TaskStatusBadge({
  status,
  progress,
}: {
  status: number;
  progress?: number;
}) {
  const colorMap: Record<number, string> = {
    0: 'bg-[#fff7ed] text-orange-600',
    1: 'bg-[#eff6ff] text-blue-600',
    2: 'bg-[#f0fdf4] text-green-600',
    3: 'bg-[#fef2f2] text-red-500',
    4: 'bg-surface-2 text-text-tertiary',
    5: 'bg-surface-2 text-text-tertiary',
  };
  return (
    <span className={clsx('chip text-tiny', colorMap[status] ?? 'bg-surface-2')}>
      {(status === 0 || status === 1) && <Loader2 size={10} className="animate-spin" />}
      {STATUS_LABEL[status] ?? '未知'}
      {(status === 0 || status === 1) && progress !== undefined && (
        <span className="tabular-nums ml-0.5">{progress}%</span>
      )}
    </span>
  );
}
