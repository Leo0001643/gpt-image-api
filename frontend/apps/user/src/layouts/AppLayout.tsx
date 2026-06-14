import type { MouseEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Clock3,
  CreditCard,
  FileKey2,
  Gift,
  Image,
  LogIn,
  LogOut,
  MessageCircle,
  Settings,
  Video,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

import { useAuthStore } from '../stores/auth';
import { useLoginGateStore } from '../stores/loginGate';
import { toast } from '../stores/toast';
import { fmtPoints } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  authed?: boolean;
}

const NAV_PRIMARY: NavItem[] = [
  { to: '/create/image', label: '图片创作', icon: Image },
  { to: '/create/text',  label: '文字对话', icon: MessageCircle },
  { to: '/create/video', label: '视频生成', icon: Video },
  { to: '/history',      label: '生成历史', icon: Clock3,    authed: true },
];

const NAV_SECONDARY: NavItem[] = [
  { to: '/billing',  label: '充值点数', icon: CreditCard, authed: true },
  { to: '/keys',     label: 'API 密钥', icon: FileKey2,   authed: true },
  { to: '/docs',     label: '接口文档', icon: BookOpen },
  { to: '/invite',   label: '邀请好友', icon: Gift,       authed: true },
];

export function AppLayout() {
  const token    = useAuthStore((s) => s.token);
  const me       = useAuthStore((s) => s.me);
  const logout   = useAuthStore((s) => s.logout);
  const openGate = useLoginGateStore((s) => s.openGate);
  const navigate = useNavigate();
  const isAuthed = !!token;

  const onLogout = async () => {
    await logout();
    toast.info('已退出登录');
    navigate('/create/image', { replace: true });
  };

  const handleNav = (item: NavItem, e: MouseEvent) => {
    if (item.authed && !isAuthed) {
      e.preventDefault();
      openGate({ hint: `登录后即可使用"${item.label}"`, onLoggedIn: () => navigate(item.to) });
    }
  };

  const avatarLetter = (me?.username || me?.email || 'U').slice(0, 1).toUpperCase();
  const points = me?.points ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6FA] text-neutral-950">

      {/* ═══════════════ 左侧导航栏 ═══════════════ */}
      <aside className="hidden lg:flex flex-col w-[200px] shrink-0 h-full border-r border-neutral-200 bg-white z-40 overflow-hidden">

        {/* Logo 区 */}
        <div className="flex items-center gap-2.5 px-4 h-[60px] border-b border-neutral-100">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'var(--gia-gradient)' }}>
            <Zap size={16} className="text-white" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-neutral-900 leading-tight truncate">AI 创作平台</p>
            <p className="text-[10px] text-neutral-400 leading-tight">Powered by GPT</p>
          </div>
        </div>

        {/* 主导航 */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          <p className="text-[10px] text-neutral-400 uppercase tracking-wider px-2 mb-2 font-medium">创作</p>
          {NAV_PRIMARY.map((item) => (
            <SidebarLink key={item.to} item={item} onClick={handleNav} />
          ))}

          <div className="my-3 h-px bg-neutral-100 mx-2" />

          <p className="text-[10px] text-neutral-400 uppercase tracking-wider px-2 mb-2 font-medium">账户</p>
          {NAV_SECONDARY.map((item) => (
            <SidebarLink key={item.to} item={item} onClick={handleNav} />
          ))}
        </nav>

        {/* 底部用户区 */}
        <div className="border-t border-neutral-100 p-3">
          {isAuthed ? (
            <div className="space-y-1">
              {/* 点数显示 */}
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#F0F4FF]">
                <Zap size={13} className="text-[#002FA7] shrink-0" />
                <span className="text-xs text-[#002FA7] font-medium flex-1 truncate">
                  {fmtPoints(points)} 点可用
                </span>
              </div>
              {/* 用户信息 */}
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-neutral-50 transition text-left"
              >
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[12px] font-semibold text-white"
                     style={{ background: 'var(--gia-gradient)' }}>
                  {avatarLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-800 truncate leading-tight">
                    {me?.username || me?.email || '我的账号'}
                  </p>
                  <p className="text-[10px] text-neutral-400 leading-tight flex items-center gap-1">
                    <Settings size={9} />
                    账号设置
                  </p>
                </div>
              </button>
              {/* 退出 */}
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600 transition text-xs"
              >
                <LogOut size={13} />
                退出登录
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openGate({ hint: '登录后可保存作品和查看额度' })}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-white transition hover:opacity-90 active:scale-[.98]"
              style={{ background: 'var(--gia-gradient)' }}
            >
              <LogIn size={15} />
              登录 / 注册
            </button>
          )}
        </div>
      </aside>

      {/* ═══════════════ 移动端顶部 Header ═══════════════ */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-12 bg-white border-b border-neutral-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
               style={{ background: 'var(--gia-gradient)' }}>
            <Zap size={13} className="text-white" fill="currentColor" />
          </div>
          <span className="text-sm font-semibold text-neutral-900">AI 创作平台</span>
        </div>
        <div className="flex items-center gap-1">
          {[NAV_PRIMARY[0]!, NAV_PRIMARY[1]!, NAV_PRIMARY[2]!].map((item) => (
            <MobileTab key={item.to} item={item} onClick={handleNav} />
          ))}
        </div>
        {isAuthed ? (
          <button onClick={() => navigate('/settings')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white"
            style={{ background: 'var(--gia-gradient)' }}>
            {avatarLetter}
          </button>
        ) : (
          <button onClick={() => openGate({})}
            className="text-xs px-3 py-1.5 rounded-full font-medium text-white"
            style={{ background: 'var(--gia-gradient)' }}>
            登录
          </button>
        )}
      </div>

      {/* ═══════════════ 内容区 ═══════════════ */}
      <main className="flex-1 overflow-hidden lg:overflow-auto pt-0 lg:pt-0">
        <div className="h-full lg:h-auto pt-12 lg:pt-0 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ── 侧边栏导航项 ── */
function SidebarLink({ item, onClick }: { item: NavItem; onClick: (item: NavItem, e: MouseEvent) => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      title={item.label}
      onClick={(e) => onClick(item, e)}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150',
          isActive
            ? 'text-[#002FA7] bg-[#EEF2FF] font-medium'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={isActive ? 'text-[#002FA7]' : 'text-neutral-500'} />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/* ── 移动端 Tab ── */
function MobileTab({ item, onClick }: { item: NavItem; onClick: (item: NavItem, e: MouseEvent) => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={(e) => onClick(item, e)}
      className={({ isActive }) =>
        clsx(
          'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition',
          isActive ? 'bg-[#002FA7] text-white font-medium' : 'text-neutral-600 hover:bg-neutral-100',
        )
      }
    >
      <Icon size={13} />
      {item.label}
    </NavLink>
  );
}
