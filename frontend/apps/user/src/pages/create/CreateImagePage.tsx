import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Download, Sparkles,
  RefreshCw, Check, Loader2, Wand2,
  ImageIcon, ZoomIn,
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
  { value: '1:1',  w: 1, h: 1,  label: '方形' },
  { value: '3:4',  w: 3, h: 4,  label: '竖版' },
  { value: '4:3',  w: 4, h: 3,  label: '横版' },
  { value: '16:9', w: 16, h: 9, label: '宽屏' },
  { value: '9:16', w: 9, h: 16, label: '竖屏' },
] as const;

const COUNTS = [1, 2, 4] as const;

const QUALITY = [
  { value: 'standard', label: '标准' },
  { value: 'hd',       label: '高清 HD' },
] as const;

const PROMPT_CHIPS = [
  '电影级构图', '超写实', '赛博朋克', '微距摄影',
  '梦幻光影', '极简主义', '油画风格', '水墨国风',
];

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

type Ratio   = (typeof RATIOS)[number]['value'];
type Quality = (typeof QUALITY)[number]['value'];

/* ──────────────────────────────────────────────
   主页面
────────────────────────────────────────────── */
export default function CreateImagePage() {
  const qc          = useQueryClient();
  const refreshMe   = useAuthStore((s) => s.refreshMe);
  const ensureLoggedIn = useEnsureLoggedIn();

  /* 模型列表 */
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
  const imageModels = useMemo(
    () => allModels.filter((m) => m.kind === 'image' && m.enabled !== false),
    [allModels],
  );

  /* 表单状态 */
  const [modelCode, setModelCode] = useState('');
  const [ratio,     setRatio]     = useState<Ratio>('1:1');
  const [count,     setCount]     = useState<(typeof COUNTS)[number]>(1);
  const [quality,   setQuality]   = useState<Quality>('standard');
  const [prompt,    setPrompt]    = useState('');
  const [preview,   setPreview]   = useState<string | null>(null);

  /* 任务状态 */
  const [task,       setTask]      = useState<GenerationTask | null>(null);
  const [phraseIdx,  setPhraseIdx] = useState(0);
  const pollRef   = useRef<number | null>(null);
  const phraseRef = useRef<number | null>(null);

  /* 自动选中第一个模型 */
  useEffect(() => {
    if (imageModels.length > 0 && !modelCode) setModelCode(imageModels[0]!.model_code);
  }, [imageModels, modelCode]);

  useEffect(() => () => {
    if (pollRef.current)   window.clearInterval(pollRef.current);
    if (phraseRef.current) window.clearInterval(phraseRef.current);
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
        if (fresh.status === 2 || fresh.status >= 3) {
          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          if (phraseRef.current) { window.clearInterval(phraseRef.current); phraseRef.current = null; }
          if (fresh.status === 2)      toast.success('图像生成完成 ✨');
          else if (fresh.status === 3) toast.error(fresh.error || '生成失败');
          else if (fresh.status === 5) toast.info('任务已取消');
          else                         toast.info('任务失败，积分已退还');
          await refreshMe();
          qc.invalidateQueries({ queryKey: ['gen.history'] });
        }
      } catch {/* ignore */}
    }, 1500);
  }

  function startPhrases() {
    if (phraseRef.current) window.clearInterval(phraseRef.current);
    setPhraseIdx(0);
    phraseRef.current = window.setInterval(() => setPhraseIdx((i) => (i + 1) % GEN_PHRASES.length), 2200);
  }

  const selectedModel = imageModels.find((m) => m.model_code === modelCode);
  const costPerImage  = Math.round((selectedModel?.unit_points ?? 0) / 100);
  const expectedCost  = costPerImage * count;
  const inProgress    = !!(task && (task.status === 0 || task.status === 1));
  const results       = task?.results ?? [];
  const canSubmit     = !!modelCode && !!prompt.trim() && !createMut.isPending && !inProgress;

  const submit = () => ensureLoggedIn(() => createMut.mutate(), '登录后即可开始创作');

  return (
    <div className="flex h-full min-h-screen lg:min-h-0">

      {/* ══════════════ 左：参数面板 ══════════════ */}
      <aside className="flex flex-col w-full lg:w-[300px] xl:w-[320px] shrink-0 border-r border-neutral-200 bg-white overflow-hidden">

        {/* 面板头部 */}
        <div className="px-5 pt-5 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'var(--gia-gradient)' }}>
              <Wand2 size={15} className="text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-neutral-900 leading-tight">图像创作</h2>
              <p className="text-[11px] text-neutral-400 leading-tight mt-0.5">选择模型，描述你的画面</p>
            </div>
          </div>
        </div>

        {/* 可滚动内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ─ 模型选择 ─ */}
          <Section label="选择模型">
            {modelsLoading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => <div key={i} className="h-14 rounded-xl bg-neutral-100 animate-pulse" />)}
              </div>
            ) : modelsError ? (
              <div className="flex items-center justify-between rounded-xl border border-dashed border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-500">
                <span className="flex items-center gap-1.5"><AlertCircle size={14} />模型加载失败</span>
                <button className="text-xs underline underline-offset-2" onClick={() => void refetchModels()}>重试</button>
              </div>
            ) : imageModels.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-200 px-3 py-2.5 text-sm text-neutral-400">
                <AlertCircle size={14} />暂无可用模型，请联系管理员
              </div>
            ) : (
              <div className="space-y-1.5">
                {imageModels.map((m) => (
                  <ModelCard key={m.model_code} model={m} active={m.model_code === modelCode} onSelect={setModelCode} />
                ))}
              </div>
            )}
          </Section>

          {/* ─ 提示词 ─ */}
          <Section label="创作描述" aside={
            <span className="text-[11px] text-neutral-400 tabular-nums">{prompt.length} / 4000</span>
          }>
            <div className="relative group">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                maxLength={4000}
                placeholder="描述你想要的画面，越具体越好…&#10;例如：一只橘猫坐在窗边，阳光透过窗帘洒落，温暖的午后"
                className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-[#002FA7] focus:bg-white focus:ring-2 focus:ring-[#002FA7]/10 transition-all leading-relaxed"
              />
            </div>
            {/* 快捷词 chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PROMPT_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPrompt((p) => (p ? `${p.trimEnd()}, ${c}` : c))}
                  className="px-2.5 py-1 rounded-full border border-neutral-200 text-[11px] text-neutral-500 hover:border-[#002FA7] hover:text-[#002FA7] hover:bg-[#EEF2FF] transition"
                >
                  + {c}
                </button>
              ))}
            </div>
          </Section>

          {/* ─ 画面比例 ─ */}
          <Section label="画面比例">
            <div className="flex gap-1.5">
              {RATIOS.map((r) => <RatioButton key={r.value} ratio={r} active={r.value === ratio} onClick={() => setRatio(r.value)} />)}
            </div>
          </Section>

          {/* ─ 数量 & 质量 ─ */}
          <div className="grid grid-cols-2 gap-4">
            <Section label="数量">
              <div className="flex gap-1.5">
                {COUNTS.map((c) => (
                  <button key={c} type="button" onClick={() => setCount(c)}
                    className={clsx(
                      'flex-1 h-9 rounded-lg border text-sm font-medium transition',
                      c === count
                        ? 'border-[#002FA7] bg-[#002FA7] text-white shadow-sm'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 bg-white',
                    )}>
                    {c}张
                  </button>
                ))}
              </div>
            </Section>
            <Section label="质量">
              <div className="flex gap-1.5">
                {QUALITY.map((q) => (
                  <button key={q.value} type="button" onClick={() => setQuality(q.value)}
                    className={clsx(
                      'flex-1 h-9 rounded-lg border text-xs font-medium transition',
                      q.value === quality
                        ? 'border-[#002FA7] bg-[#002FA7] text-white shadow-sm'
                        : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 bg-white',
                    )}>
                    {q.label}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>

        {/* ── 底部 CTA ── */}
        <div className="border-t border-neutral-100 px-5 pt-4 pb-5 bg-white">
          {/* 费用预估 */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs text-neutral-400">预计消耗</span>
            <span className="text-xs font-medium text-neutral-700 tabular-nums">
              {expectedCost > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="text-[#002FA7]">{fmtPoints(expectedCost * 100)}</span>
                  <span className="text-neutral-400">点</span>
                </span>
              ) : '免费'}
            </span>
          </div>
          {/* 生成按钮 */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={clsx(
              'w-full h-12 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all duration-200',
              canSubmit
                ? 'text-white shadow-lg hover:shadow-xl hover:opacity-95 active:scale-[.98]'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed',
            )}
            style={canSubmit ? { background: 'var(--gia-gradient)' } : undefined}
          >
            {(createMut.isPending || inProgress) ? (
              <><Loader2 size={16} className="animate-spin" />生成中…</>
            ) : (
              <><Sparkles size={16} />立即生成</>
            )}
          </button>
        </div>
      </aside>

      {/* ══════════════ 右：结果展示区 ══════════════ */}
      <main className="flex-1 overflow-y-auto" style={{ background: '#F5F6FA' }}>
        <div className="p-6 lg:p-8 max-w-4xl">

          {/* 标题栏 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h3 className="text-[17px] font-semibold text-neutral-800">生成结果</h3>
              {task && <TaskStatusBadge status={task.status} progress={task.progress} />}
            </div>
            {results.length > 0 && (
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 bg-white hover:border-[#002FA7] hover:text-[#002FA7] transition"
                onClick={submit}
                disabled={!canSubmit}
              >
                <RefreshCw size={13} />再次生成
              </button>
            )}
          </div>

          {/* 图片网格 */}
          <div className={clsx(
            'grid gap-3',
            results.length > 1 ? 'grid-cols-2' : (count === 1 ? 'grid-cols-1 max-w-[480px]' : 'grid-cols-2'),
          )}>
            {results.length > 0 ? (
              results.map((r, i) => (
                <article
                  key={r.url}
                  className="group relative overflow-hidden rounded-2xl bg-white shadow-md cursor-pointer"
                  style={{ aspectRatio: ratio.replace(':', '/') }}
                  onClick={() => setPreview(r.url)}
                >
                  <img
                    src={r.url}
                    alt={`生成结果 ${i + 1}`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                      <button
                        className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/35 transition"
                        title="查看大图"
                        onClick={(e) => { e.stopPropagation(); setPreview(r.url); }}
                      >
                        <ZoomIn size={14} />
                      </button>
                      <a
                        href={r.url}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/35 transition"
                        title="下载"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={14} />
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
                        <p key={phraseIdx} className="generating-dots__phrase generating-dots__phrase--active">
                          {GEN_PHRASES[phraseIdx % GEN_PHRASES.length]}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 border-2 border-dashed border-neutral-200 rounded-2xl bg-white/60 grid place-items-center">
                      <div className="text-center text-neutral-400">
                        <div className="w-12 h-12 rounded-2xl border border-dashed border-neutral-200 grid place-items-center mx-auto mb-2.5 bg-white">
                          <ImageIcon size={20} strokeWidth={1.5} className="text-neutral-300" />
                        </div>
                        <p className="text-[12px] text-neutral-400">图像将在此显示</p>
                        <p className="text-[11px] text-neutral-300 mt-0.5">填写描述后点击生成</p>
                      </div>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>

          {/* 底部说明 */}
          <p className="mt-8 text-xs text-neutral-400 leading-relaxed">
            生成结果自动保存至「生成历史」，可在 14 天内重新下载。支持 OpenAI 兼容接口，详见「接口文档」。
          </p>
        </div>
      </main>

      {/* 图片预览 Modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 cursor-zoom-out"
          onClick={() => setPreview(null)}
        >
          <img
            src={preview}
            alt="预览"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 flex items-center justify-center transition text-lg"
            onClick={() => setPreview(null)}
          >×</button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   子组件
────────────────────────────────────────────── */

function Section({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function ModelCard({ model, active, onSelect }: { model: PublicModel; active: boolean; onSelect: (code: string) => void }) {
  const pts = Math.round(model.unit_points / 100);
  return (
    <button
      type="button"
      onClick={() => onSelect(model.model_code)}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150',
        active
          ? 'border-[#002FA7] bg-[#EEF2FF] shadow-sm'
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50',
      )}
    >
      {/* 模型图标 */}
      <div className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
        active ? 'text-white' : 'text-white',
      )}
        style={{ background: active ? 'var(--gia-gradient)' : 'linear-gradient(135deg,#6B7280,#9CA3AF)' }}>
        AI
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-[13px] font-medium truncate', active ? 'text-[#002FA7]' : 'text-neutral-800')}>
          {model.name}
        </p>
        <p className="text-[11px] text-neutral-400 mt-0.5">
          {pts > 0 ? `${pts} 点 / 张` : '免费'}
        </p>
      </div>
      {active && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
             style={{ background: 'var(--gia-gradient)' }}>
          <Check size={10} strokeWidth={3} className="text-white" />
        </div>
      )}
    </button>
  );
}

function RatioButton({ ratio, active, onClick }: { ratio: { value: string; w: number; h: number; label: string }; active: boolean; onClick: () => void }) {
  const maxW = 20; const maxH = 20;
  const scale = Math.min(maxW / ratio.w, maxH / ratio.h);
  const displayW = Math.round(ratio.w * scale);
  const displayH = Math.round(ratio.h * scale);

  return (
    <button
      type="button"
      onClick={onClick}
      title={ratio.value}
      className={clsx(
        'flex-1 py-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all',
        active
          ? 'border-[#002FA7] bg-[#EEF2FF] shadow-sm'
          : 'border-neutral-200 bg-white hover:border-neutral-300',
      )}
    >
      <div
        className={clsx('border rounded-[2px] transition', active ? 'border-[#002FA7] bg-[#002FA7]' : 'border-neutral-400')}
        style={{ width: displayW, height: displayH }}
      />
      <span className={clsx('text-[9px] leading-none font-medium', active ? 'text-[#002FA7]' : 'text-neutral-400')}>
        {ratio.value}
      </span>
    </button>
  );
}

function TaskStatusBadge({ status, progress }: { status: number; progress?: number }) {
  const styles: Record<number, string> = {
    0: 'bg-orange-50 text-orange-600 border-orange-200',
    1: 'bg-blue-50 text-blue-600 border-blue-200',
    2: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    3: 'bg-red-50 text-red-500 border-red-200',
    4: 'bg-neutral-100 text-neutral-500 border-neutral-200',
    5: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium', styles[status] ?? 'bg-neutral-100')}>
      {(status === 0 || status === 1) && <Loader2 size={10} className="animate-spin" />}
      {STATUS_LABEL[status] ?? '未知'}
      {(status === 0 || status === 1) && progress !== undefined && (
        <span className="tabular-nums">{progress}%</span>
      )}
    </span>
  );
}
