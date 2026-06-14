import { type FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeDollarSign, BarChart2, BookOpen, ChevronDown, Circle,
  FileText, Globe2, KeyRound, LayoutDashboard, LockKeyhole,
  LogOut, Menu, ReceiptText, Settings, Tag, Ticket, UserCircle2,
  Users, Wallet, WalletCards, X,
} from 'lucide-react';
import clsx from 'clsx';

import { authApi } from '../lib/services';
import { useAuthStore } from '../stores/auth';
import { toast } from '../stores/toast';

const APP_VERSION = 'v2.0.1';

const NAV_GROUPS = [
  {
    label: '概览',
    items: [
      { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard, color: 'text-violet-500', bg: 'bg-violet-50' },
    ],
  },
  {
    label: '资源管理',
    items: [
      { to: '/accounts', label: 'Token 账号', icon: KeyRound,   color: 'text-blue-500',   bg: 'bg-blue-50' },
      { to: '/proxies',  label: '代理管理',   icon: Globe2,      color: 'text-cyan-500',   bg: 'bg-cyan-50' },
    ],
  },
  {
    label: '用户运营',
    items: [
      { to: '/users',   label: '用户管理', icon: Users,         color: 'text-emerald-500', bg: 'bg-emerald-50' },
      { to: '/billing', label: '充值消费', icon: Wallet,        color: 'text-green-500',   bg: 'bg-green-50' },
      { to: '/promo',   label: '优惠码',   icon: Tag,           color: 'text-orange-500',  bg: 'bg-orange-50' },
      { to: '/cdk',     label: '兑换码 CDK', icon: Ticket,      color: 'text-pink-500',    bg: 'bg-pink-50' },
    ],
  },
  {
    label: '系统设置',
    items: [
      { to: '/model-prices',      label: '模型价格',  icon: BadgeDollarSign, color: 'text-yellow-600', bg: 'bg-yellow-50' },
      { to: '/billing-settings',  label: '扣费设置',  icon: ReceiptText,     color: 'text-amber-500',  bg: 'bg-amber-50' },
      { to: '/recharge-packages', label: '充值套餐',  icon: WalletCards,     color: 'text-indigo-500', bg: 'bg-indigo-50' },
      { to: '/config',            label: '系统配置',  icon: Settings,        color: 'text-slate-500',  bg: 'bg-slate-100' },
    ],
  },
  {
    label: '监控',
    items: [
      { to: '/logs', label: '请求日志', icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50' },
    ],
  },
] as const;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/accounts': 'Token 账号',
  '/proxies': '代理管理',
  '/users': '用户管理',
  '/billing': '充值消费',
  '/promo': '优惠码',
  '/cdk': '兑换码 CDK',
  '/model-prices': '模型价格',
  '/billing-settings': '扣费设置',
  '/recharge-packages': '充值套餐',
  '/config': '系统配置',
  '/logs': '请求日志',
};

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [pwdOpen, setPwdOpen]       = useState(false);
  const me       = useAuthStore((s) => s.me);
  const logout   = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef  = useRef<HTMLElement>(null);

  /* 路由切换时将滚动容器滚回顶部，消除页面抖动 */
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.info('已退出登录');
    navigate('/login', { replace: true });
  };

  const displayName = me?.nickname || me?.username || '管理员';
  const roleName    = me?.role_name || me?.role_code || '超级管理员';
  const initial     = displayName.slice(0, 1).toUpperCase();
  const pageTitle   = PAGE_TITLES[location.pathname] ?? '管理后台';

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">

      {/* ── sidebar ───────────────────────────────────── */}
      <aside className={clsx(
        'flex h-screen w-[260px] shrink-0 flex-col border-r border-border bg-surface-1',
        mobileOpen ? 'fixed inset-y-0 left-0 z-40 shadow-2xl' : 'hidden lg:flex',
      )}>
        {/* logo */}
        <div className="flex h-[64px] shrink-0 items-center gap-3 border-b border-border px-5 bg-gradient-to-r from-white to-indigo-50/30">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gia-gradient shadow-[0_2px_10px_rgba(99,102,241,.35)]">
            <BarChart2 size={16} className="text-white" />
          </div>
          <div>
            <div className="text-[13px] font-bold leading-none text-text-primary tracking-wide">GPT Image</div>
            <div className="mt-0.5 text-[10px] text-text-tertiary tracking-widest uppercase">Admin Console</div>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, color, bg }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => clsx(
                      'group relative flex h-[38px] items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-gia-gradient text-white shadow-[0_2px_12px_rgba(99,102,241,.35)]'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary hover:translate-x-0.5',
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white/80" />
                        )}
                        <span className={clsx(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-md transition-all duration-150',
                          isActive ? 'bg-white/20' : `${bg} ${color} group-hover:scale-105 group-hover:shadow-sm`,
                        )}>
                          <Icon size={15} />
                        </span>
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* footer */}
        <div className="shrink-0 border-t border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-tiny text-text-tertiary">
              <Circle size={6} className="fill-emerald-400 text-emerald-400" />
              <span>系统运行正常</span>
            </div>
            <span className="text-tiny text-text-tertiary">{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* mobile overlay */}
      {mobileOpen && (
        <button type="button" aria-label="关闭" className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── main ──────────────────────────────────────── */}
      {/* main 是唯一的滚动容器。--lph CSS 变量由 ResizeObserver 写入，供 thead th 吸顶使用。
          scrollbar-gutter:stable 保留滚动条空间，overscroll-none 禁止弹跳效果。 */}
      <main ref={mainRef} className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto h-screen [scrollbar-gutter:stable] overscroll-none">
        {/* topbar */}
        <header className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center justify-between border-b border-border bg-white/97 px-6 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-icon btn-sm lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="菜单">
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-2 text-tiny text-text-tertiary">
              <BookOpen size={13} className="text-indigo-400" />
              <span>管理后台</span>
              <span className="text-border-strong">/</span>
              <span className="font-medium text-text-primary">{pageTitle}</span>
            </div>
          </div>

          {/* user menu */}
          <div
            className="relative"
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenuOpen(false); }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className={clsx(
                'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-all duration-150',
                menuOpen ? 'bg-surface-2 shadow-sm' : 'hover:bg-surface-2',
              )}
            >
              <div className="grid h-7 w-7 place-items-center rounded-full bg-gia-gradient text-[12px] font-bold text-white shadow-sm">
                {initial}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-[13px] font-medium leading-none text-text-primary">{displayName}</div>
                <div className="mt-0.5 text-[11px] text-text-tertiary">{roleName}</div>
              </div>
              <ChevronDown size={14} className={clsx('text-text-tertiary transition', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[220px] overflow-hidden rounded-xl border border-border bg-surface-1 shadow-[0_12px_40px_rgba(0,0,0,.12)] animate-[fselFadeIn_.12s_ease]">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gia-gradient text-white font-bold text-sm">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-text-primary">{displayName}</p>
                    <p className="truncate text-tiny text-text-tertiary">{me?.username}</p>
                  </div>
                </div>
                <div className="p-1">
                  <button type="button" onClick={() => { setMenuOpen(false); setPwdOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-text-secondary hover:bg-surface-2 hover:text-text-primary transition">
                    <LockKeyhole size={15} /> 修改密码
                  </button>
                  <button type="button" disabled
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-text-tertiary cursor-not-allowed opacity-50">
                    <UserCircle2 size={15} /> 账号信息
                  </button>
                </div>
                <div className="border-t border-border p-1">
                  <button type="button" onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] text-danger hover:bg-danger-soft transition">
                    <LogOut size={15} /> 退出登录
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* content area — pages use list-page pattern to negate this padding */}
        {/* 注意：此 div 不能加 overflow-x-hidden，否则会创建新的滚动容器，
            破坏 list-page-head / list-page-pager / thead 的 sticky 定位。
            水平滚动由外层 main 的 overflow-x-hidden 负责裁剪。 */}
        <div className="flex-1 bg-[#f8fafc] py-6">
          {/* Suspense 放在这里：路由懒加载时只有内容区显示占位，
              侧栏和顶栏始终可见，不会触发全屏空白 */}
          <Suspense fallback={
            <div className="flex h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-text-tertiary text-[13px]">
                <svg className="animate-spin h-4 w-4 text-gia-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                加载中…
              </div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {pwdOpen && <PasswordDialog onClose={() => setPwdOpen(false)} />}
    </div>
  );
}

/* ── Password Dialog ────────────────────────────── */
function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [oldPwd, setOldPwd]   = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving]   = useState(false);

  const onBackdrop = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (e.target === e.currentTarget) onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 8)    { toast.error('新密码至少 8 位'); return; }
    if (newPwd !== confirm)   { toast.error('两次密码不一致');  return; }
    setSaving(true);
    try {
      await authApi.changePassword({ old_password: oldPwd, new_password: newPwd });
      toast.success('密码已修改');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onBackdrop}>
      <form className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-2xl" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold text-text-primary">修改密码</h2>
            <p className="mt-0.5 text-small text-text-tertiary">建议定期修改，保障账号安全</p>
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        {/* body */}
        <div className="space-y-4 px-6 py-5">
          <label className="field">
            <span className="field-label">当前密码</span>
            <input className="input" type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} autoComplete="current-password" placeholder="请输入当前密码" />
          </label>
          <label className="field">
            <span className="field-label">新密码</span>
            <input className="input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" placeholder="至少 8 位" />
          </label>
          <label className="field">
            <span className="field-label">确认新密码</span>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入新密码" />
          </label>
        </div>
        {/* footer */}
        <div className="flex justify-end gap-2 border-t border-border bg-surface-2/40 px-6 py-4">
          <button type="button" className="btn btn-outline btn-md" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary btn-md" disabled={saving}>
            {saving ? '保存中…' : '保存修改'}
          </button>
        </div>
      </form>
    </div>
  );
}
