import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '../stores/auth';

export default function RequireAuth() {
  const loc       = useLocation();
  const token     = useAuthStore((s) => s.token);
  const refreshMe = useAuthStore((s) => s.refreshMe);

  /* 后台静默刷新最新管理员信息，不阻塞页面渲染 */
  useEffect(() => {
    if (token) void refreshMe();
  }, [token, refreshMe]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return <Outlet />;
}
