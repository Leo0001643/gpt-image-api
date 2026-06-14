import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ChevronLeft, ChevronRight,
  Clock3, Copy, Download, ImageIcon, Images, Loader2,
  MoreHorizontal, Play, Trash2, Video as VideoIcon, X,
} from 'lucide-react';

import { fmtPoints, fmtRelative } from '../../lib/format';
import { loadToken } from '../../lib/api';
import { genApi } from '../../lib/services';
import type { GenerationTask, TaskStatus } from '../../lib/types';

const PAGE_SIZE = 24;

const STATUS_LABEL: Record<TaskStatus, string> = {
  0: '排队中', 1: '生成中', 2: '已完成', 3: '失败', 4: '已退款', 5: '已取消',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  0: 'bg-orange-50 text-orange-600 border-orange-200',
  1: 'bg-blue-50 text-blue-600 border-blue-200',
  2: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  3: 'bg-red-50 text-red-500 border-red-200',
  4: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  5: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

type Filter      = 'all' | 'image' | 'video';
type DeleteScope = 'failed' | 'before_3d' | 'before_7d' | 'all';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all',   label: '全部' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

const DELETE_ACTIONS: Array<{ scope: DeleteScope; label: string; hint: string; danger?: boolean }> = [
  { scope: 'failed',    label: '清理失败记录', hint: '删除所有生成失败的任务' },
  { scope: 'before_3d', label: '删除 3 天前',  hint: '删除 3 天前的历史记录' },
  { scope: 'before_7d', label: '删除 7 天前',  hint: '删除 7 天前的历史记录' },
  { scope: 'all',       label: '清空全部',     hint: '清空所有历史记录', danger: true },
];

export default function HistoryPage() {
  const [filter,       setFilter]       = useState<Filter>('all');
  const [page,         setPage]         = useState(1);
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [busyScope,    setBusyScope]    = useState<DeleteScope | null>(null);
  const [confirmScope, setConfirmScope] = useState<DeleteScope | null>(null);
  const [preview,      setPreview]      = useState<HistoryPreview | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const q = useQuery({
    queryKey: ['gen.history', filter, page],
    queryFn: () => genApi.history({ kind: filter === 'all' ? undefined : filter, page, page_size: PAGE_SIZE }),
  });

  const items      = q.data?.list ?? [];
  const total      = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!menuRef.current?.contains(ev.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleDelete = async (scope: DeleteScope) => {
    setBusyScope(scope);
    try {
      await genApi.deleteHistory(scope);
      setPage(1);
      await q.refetch();
    } finally {
      setBusyScope(null);
      setMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F6FA' }}>
      <div className="max-w-6xl mx-auto px-5 py-6">

        {/* 页头 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'var(--gia-gradient)' }}>
              <Clock3 size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold text-neutral-900 leading-tight">生成历史</h1>
              <p className="text-xs text-neutral-400 mt-0.5">共 {total} 条记录</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 过滤 tabs */}
            <div className="flex p-0.5 bg-white border border-neutral-200 rounded-lg">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => { setFilter(f.value); setPage(1); }}
                  className={clsx(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition',
                    filter === f.value
                      ? 'bg-[#002FA7] text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-800',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 管理菜单 */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 bg-white hover:border-neutral-300 transition"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={15} />管理
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl">
                  {DELETE_ACTIONS.map((item) => (
                    <button
                      key={item.scope}
                      type="button"
                      className={clsx(
                        'flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-neutral-50',
                        item.danger && 'hover:bg-red-50',
                        busyScope === item.scope && 'opacity-60 pointer-events-none',
                      )}
                      onClick={() => setConfirmScope(item.scope)}
                    >
                      <Trash2 size={14} className={clsx('mt-0.5 shrink-0', item.danger ? 'text-red-400' : 'text-neutral-400')} />
                      <span className="flex-1 min-w-0">
                        <span className={clsx('block font-medium', item.danger ? 'text-red-600' : 'text-neutral-700')}>{item.label}</span>
                        <span className="block text-[11px] text-neutral-400">{item.hint}</span>
                      </span>
                      {busyScope === item.scope && <Loader2 size={12} className="animate-spin shrink-0 mt-0.5 text-neutral-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 bg-white hover:border-neutral-300 transition"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              <Loader2 size={14} className={clsx(q.isFetching && 'animate-spin')} />
              刷新
            </button>
          </div>
        </div>

        {/* 加载中 */}
        {q.isLoading && (
          <div className="grid place-items-center py-24 text-neutral-400">
            <Loader2 className="animate-spin mb-3" size={28} />
            <p className="text-sm">加载中…</p>
          </div>
        )}

        {/* 加载失败 */}
        {!q.isLoading && q.error && (
          <div className="flex flex-col items-center py-24 text-neutral-400 gap-3">
            <div className="w-14 h-14 rounded-2xl border border-dashed border-neutral-200 bg-white grid place-items-center">
              <Trash2 size={22} className="text-neutral-300" />
            </div>
            <p className="text-sm font-medium text-neutral-600">加载失败</p>
            <p className="text-xs text-neutral-400">请稍后刷新重试，或检查登录状态</p>
          </div>
        )}

        {/* 空状态 */}
        {!q.isLoading && !q.error && items.length === 0 && (
          <div className="flex flex-col items-center py-24 gap-3">
            <div className="w-14 h-14 rounded-2xl border border-dashed border-neutral-200 bg-white grid place-items-center">
              <Images size={22} className="text-neutral-300" />
            </div>
            <p className="text-sm font-medium text-neutral-600">还没有任何作品</p>
            <p className="text-xs text-neutral-400">去图片或视频创作开始你的第一次生成吧</p>
          </div>
        )}

        {/* 图片网格 */}
        {!q.isLoading && items.length > 0 && (
          <>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr))]">
              {items.map((t) => (
                <TaskCard key={t.task_id} t={t} onPreview={() => setPreview(createPreview(t))} />
              ))}
            </div>

            {/* 分页 */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                className={clsx(
                  'px-4 py-2 rounded-lg border text-sm transition',
                  page <= 1 || q.isFetching
                    ? 'border-neutral-200 text-neutral-300 bg-white cursor-not-allowed'
                    : 'border-neutral-200 text-neutral-600 bg-white hover:border-[#002FA7] hover:text-[#002FA7]',
                )}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || q.isFetching}
              >
                上一页
              </button>
              <span className="px-4 py-2 text-sm text-neutral-400">
                {page} / {totalPages}
              </span>
              <button
                className={clsx(
                  'px-4 py-2 rounded-lg border text-sm transition',
                  page >= totalPages || q.isFetching
                    ? 'border-neutral-200 text-neutral-300 bg-white cursor-not-allowed'
                    : 'border-neutral-200 text-neutral-600 bg-white hover:border-[#002FA7] hover:text-[#002FA7]',
                )}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || q.isFetching}
              >
                下一页
              </button>
            </div>
          </>
        )}
      </div>

      {/* 预览 Modal */}
      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}

      {/* 删除确认 */}
      {confirmScope && (
        <DeleteConfirmDialog
          scope={confirmScope}
          loading={busyScope === confirmScope}
          onClose={() => setConfirmScope(null)}
          onConfirm={async () => {
            const scope = confirmScope;
            if (!scope) return;
            setConfirmScope(null);
            await handleDelete(scope);
          }}
        />
      )}
    </div>
  );
}

/* ── 任务卡片 ── */
function TaskCard({ t, onPreview }: { t: GenerationTask; onPreview: () => void }) {
  const primary       = t.results?.[0];
  const cover         = primary?.thumb_url || primary?.url || '';
  const isVideo       = t.kind === 'video';
  const resolvedCover = useAuthedMediaUrl(cover);
  const error         = t.status === 3 ? t.error?.trim() || '生成失败' : '';
  const imageCount    = (t.results?.length ?? 0);

  return (
    <article
      className="group overflow-hidden rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') onPreview(); }}
    >
      {/* 封面 */}
      <div className="relative aspect-square overflow-hidden bg-neutral-100">
        {resolvedCover ? (
          isVideo ? (
            <div className="relative h-full w-full">
              <img src={resolvedCover} alt="" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 grid place-items-center bg-black/15 group-hover:bg-black/25 transition">
                <span className="w-11 h-11 rounded-full bg-black/60 flex items-center justify-center">
                  <Play size={16} className="ml-0.5 text-white" fill="white" />
                </span>
              </div>
            </div>
          ) : (
            <img src={resolvedCover} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-300">
            {isVideo ? <VideoIcon size={28} strokeWidth={1.5} /> : <ImageIcon size={28} strokeWidth={1.5} />}
          </div>
        )}

        {t.status === 1 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-200">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${t.progress}%` }} />
          </div>
        )}
        {t.status === 3 && (
          <div className="absolute inset-0 flex items-end bg-black/20 p-2.5">
            <span className="line-clamp-2 rounded-lg bg-black/70 px-2 py-1 text-[11px] text-white leading-relaxed">
              {error}
            </span>
          </div>
        )}

        {/* 状态角标 */}
        <div className="absolute top-2 left-2">
          <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border', STATUS_STYLE[t.status])}>
            {(t.status === 0 || t.status === 1) && <Loader2 size={8} className="animate-spin" />}
            {STATUS_LABEL[t.status]}
          </span>
        </div>

        {/* 多图数量角标 */}
        {imageCount > 1 && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
              <Images size={9} />
              {imageCount}
            </span>
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className="px-3 py-2.5">
        <p className="truncate text-[13px] font-medium text-neutral-700 leading-tight">{t.model}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-neutral-400">{fmtRelative(t.created_at)}</span>
          <span className="text-[11px] text-neutral-400">{fmtPoints(t.cost_points)} 点</span>
        </div>
      </div>
    </article>
  );
}

/* ── 预览 Modal ── */
function PreviewModal({ preview, onClose }: { preview: HistoryPreview; onClose: () => void }) {
  const [idx, setIdx]             = useState(0);
  const total                     = preview.srcs.length;
  const currentSrc                = preview.srcs[idx] ?? '';
  const blobUrl                   = useAuthedMediaUrl(currentSrc);
  const [copying,     setCopying]     = useState(false);
  const [downloading, setDownloading] = useState(false);

  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); };
  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setIdx((i) => Math.min(total - 1, i + 1)); };

  useEffect(() => { setIdx(0); }, [preview]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { onClose(); return; }
      if (ev.key === 'ArrowLeft')  setIdx((i) => Math.max(0, i - 1));
      if (ev.key === 'ArrowRight') setIdx((i) => Math.min(total - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, total]);

  const handleCopy = async () => {
    setCopying(true);
    try { await navigator.clipboard.writeText(currentSrc); }
    finally { setCopying(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const file = await fetchAuthedFile(currentSrc);
      const url  = URL.createObjectURL(file.blob);
      const a    = document.createElement('a');
      a.href = url; a.download = file.filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally { setDownloading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Modal 头部 */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-800">{preview.model}</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {fmtRelative(preview.created_at)} · {STATUS_LABEL[preview.status]} · {fmtPoints(preview.cost_points)} 点
              {total > 1 && <span className="ml-1.5 text-[#002FA7] font-medium">{idx + 1} / {total}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {currentSrc && (
              <>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:border-[#002FA7] hover:text-[#002FA7] transition"
                  onClick={handleCopy}
                  disabled={copying}
                >
                  {copying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                  复制链接
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:border-[#002FA7] hover:text-[#002FA7] transition"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  下载
                </button>
              </>
            )}
            <button
              className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-500 hover:border-neutral-300 transition"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* 图片区域 */}
        <div className="bg-neutral-50 p-4">
          <div className="relative flex max-h-[70vh] min-h-[320px] items-center justify-center overflow-auto rounded-xl bg-white border border-neutral-100">
            {preview.kind === 'video' ? (
              blobUrl
                ? <video src={blobUrl} controls className="max-h-[70vh] w-full object-contain" />
                : <div className="flex flex-col items-center gap-2 py-16 text-neutral-400"><Loader2 className="animate-spin" size={24} /><span className="text-sm">正在加载</span></div>
            ) : blobUrl
              ? <img src={blobUrl} alt={preview.prompt || preview.model} className="max-h-[70vh] max-w-full object-contain" />
              : <div className="flex flex-col items-center gap-2 py-16 text-neutral-400"><Loader2 className="animate-spin" size={24} /><span className="text-sm">正在加载</span></div>
            }

            {/* 左右翻页按钮 */}
            {total > 1 && (
              <>
                <button
                  className={clsx(
                    'absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition',
                    idx === 0 && 'opacity-30 pointer-events-none',
                  )}
                  onClick={goPrev}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className={clsx(
                    'absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition',
                    idx === total - 1 && 'opacity-30 pointer-events-none',
                  )}
                  onClick={goNext}
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>

          {/* 多图缩略图导航 */}
          {total > 1 && (
            <div className="mt-3 flex gap-2 justify-center flex-wrap">
              {preview.srcs.map((src, i) => (
                <ThumbNav key={i} src={src} active={i === idx} onClick={() => setIdx(i)} />
              ))}
            </div>
          )}
        </div>

        {/* 底部提示词 */}
        {preview.prompt && (
          <div className="border-t border-neutral-100 px-5 py-3">
            <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{preview.prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 缩略图导航 ── */
function ThumbNav({ src, active, onClick }: { src: string; active: boolean; onClick: () => void }) {
  const blobUrl = useAuthedMediaUrl(src);
  return (
    <button
      className={clsx(
        'w-12 h-12 rounded-lg overflow-hidden border-2 transition shrink-0',
        active ? 'border-[#002FA7]' : 'border-transparent hover:border-neutral-300',
      )}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {blobUrl
        ? <img src={blobUrl} alt="" className="w-full h-full object-cover" />
        : <div className="w-full h-full bg-neutral-100 grid place-items-center"><Loader2 size={10} className="animate-spin text-neutral-300" /></div>
      }
    </button>
  );
}

/* ── 删除确认弹窗 ── */
function DeleteConfirmDialog({ scope, loading, onClose, onConfirm }: {
  scope: DeleteScope; loading: boolean; onClose: () => void; onConfirm: () => void | Promise<void>;
}) {
  const item = DELETE_ACTIONS.find((a) => a.scope === scope)!;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-5 py-5">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-neutral-900">{item.label}</h2>
            <p className="mt-1 text-sm text-neutral-500 leading-relaxed">{item.hint}</p>
            <p className="mt-1 text-xs text-neutral-400">该操作不可恢复，请谨慎操作。</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button className="px-4 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition" onClick={onClose}>
            取消
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition disabled:opacity-60"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── hooks / utils ── */
function useAuthedMediaUrl(src?: string) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    if (!src) { setUrl(''); return; }
    if (src.startsWith('data:')) { setUrl(src); return; }
    let alive = true; let objectUrl = '';
    (async () => {
      try {
        const token = loadToken();
        const headers: Record<string, string> = {};
        if (token?.access) headers.Authorization = `${token.type || 'Bearer'} ${token.access}`;
        const resp = await fetch(src, { headers, credentials: 'include' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch { if (alive) setUrl(''); }
    })();
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return url;
}

async function fetchAuthedFile(src: string) {
  const token = loadToken();
  const headers: Record<string, string> = {};
  if (token?.access) headers.Authorization = `${token.type || 'Bearer'} ${token.access}`;
  const resp = await fetch(src, { headers, credentials: 'include' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return { blob, filename: guessFilename(src, resp.headers.get('content-type') || blob.type) };
}

function guessFilename(src: string, contentType: string) {
  const ext     = guessExt(contentType, src);
  const cleanSrc = src.replace(/\?.*$/, '');
  const base    = cleanSrc.replace(/^.*\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  return `${base || 'generation'}${ext}`;
}

function guessExt(contentType: string, src: string) {
  const lower = `${contentType} ${src}`.toLowerCase();
  if (lower.includes('video/mp4')  || lower.includes('.mp4'))  return '.mp4';
  if (lower.includes('video/webm') || lower.includes('.webm')) return '.webm';
  if (lower.includes('image/png')  || lower.includes('.png'))  return '.png';
  if (lower.includes('image/jpeg') || lower.includes('.jpg') || lower.includes('.jpeg')) return '.jpg';
  if (lower.includes('image/webp') || lower.includes('.webp')) return '.webp';
  return '';
}

function createPreview(t: GenerationTask): HistoryPreview {
  const srcs = (t.results ?? [])
    .map((r) => r.url || r.thumb_url || '')
    .filter(Boolean);
  return {
    kind: t.kind,
    status: t.status,
    model: t.model,
    prompt: t.prompt || '',
    cost_points: t.cost_points,
    created_at: t.created_at,
    error: t.error,
    srcs: srcs.length > 0 ? srcs : [''],
  };
}

interface HistoryPreview {
  kind: 'image' | 'video' | 'chat';
  status: TaskStatus;
  model: string; prompt: string; cost_points: number; created_at: number;
  error?: string;
  srcs: string[];
}
