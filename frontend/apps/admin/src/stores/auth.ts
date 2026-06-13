// 后台认证 store。
import { create } from 'zustand';

import { clearToken, loadToken, saveToken, type StoredToken } from '../lib/api';
import { authApi } from '../lib/services';
import type { AdminLoginResp, AdminMe } from '../lib/types';

interface AuthState {
  token: StoredToken | null;
  me: AdminMe | null;
  loading: boolean;
  setLogin: (resp: AdminLoginResp) => void;
  setMe: (m: AdminMe | null) => void;
  refreshMe: () => Promise<AdminMe | null>;
  logout: () => void;
}

/**
 * 从 JWT access_token 的 payload 中快速解析基础用户信息。
 * 仅用于页面首次渲染时避免空白等待，API 验证仍通过 refreshMe() 进行。
 */
function parseMeFromToken(tok: StoredToken | null): AdminMe | null {
  if (!tok?.access) return null;
  try {
    const parts = tok.access.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload) return null;
    return {
      id:        Number(payload.sub ?? payload.id ?? 0),
      username:  String(payload.username ?? payload.sub ?? ''),
      nickname:  String(payload.nickname ?? payload.username ?? '管理员'),
      role_id:   Number(payload.role_id ?? 0),
      role_code: String(payload.role_code ?? ''),
      role_name: String(payload.role_name ?? ''),
    };
  } catch {
    return null;
  }
}

const _token = loadToken();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: _token,
  /* 从 token 解析基础 me，消除首次渲染的全屏空白 */
  me: parseMeFromToken(_token),
  loading: false,

  setLogin: (resp) => {
    const tok = saveToken(resp.token);
    set({
      token: tok,
      me: {
        id: resp.id,
        username: resp.username,
        nickname: resp.nickname,
        role_id: resp.role_id,
        role_code: '',
        role_name: '',
      },
    });
  },

  setMe: (m) => set({ me: m }),

  refreshMe: async () => {
    if (!get().token) return null;
    set({ loading: true });
    try {
      const me = await authApi.me();
      set({ me, loading: false });
      return me;
    } catch {
      set({ loading: false });
      return null;
    }
  },

  logout: () => {
    clearToken();
    set({ token: null, me: null });
  },
}));

export const isAuthed = () => !!useAuthStore.getState().token;
