import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import RequireAuth from './routes/RequireAuth';
import { Toaster } from './components/Toaster';

/* 所有页面均懒加载：
   - 顶层 Suspense：仅处理应用初次启动时的加载（如 LoginPage 首次加载）
   - AdminLayout 内层 Suspense：处理路由切换，侧栏/顶栏始终可见 */
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const TokenAccountsPage = lazy(() => import('./pages/accounts/TokenAccountsPage'));
const ProxiesPage = lazy(() => import('./pages/proxies/ProxiesPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const BillingPage = lazy(() => import('./pages/billing/BillingPage'));
const PromoPage = lazy(() => import('./pages/promo/PromoPage'));
const CDKPage = lazy(() => import('./pages/promo/CDKPage'));
const ConfigPage = lazy(() => import('./pages/system/ConfigPage'));
const BillingSettingsPage = lazy(() => import('./pages/system/BillingSettingsPage'));
const RechargePackagesPage = lazy(() => import('./pages/system/RechargePackagesPage'));
const ModelPricesPage = lazy(() => import('./pages/system/ModelPricesPage'));
const LogsPage = lazy(() => import('./pages/logs/LogsPage'));

function InitialLoader() {
  return (
    <div className="grid h-screen place-items-center bg-[#f8fafc]">
      <div className="flex items-center gap-3 text-text-tertiary text-sm">
        <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        正在初始化…
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Suspense fallback={<InitialLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/accounts"   element={<TokenAccountsPage />} />
            <Route path="/proxies"    element={<ProxiesPage />} />
            <Route path="/users"      element={<UsersPage />} />
            <Route path="/billing"    element={<BillingPage />} />
            <Route path="/promo"      element={<PromoPage />} />
            <Route path="/cdk"        element={<CDKPage />} />
            <Route path="/config"     element={<ConfigPage />} />
            <Route path="/billing-settings" element={<BillingSettingsPage />} />
            <Route path="/recharge-packages" element={<RechargePackagesPage />} />
            <Route path="/model-prices" element={<ModelPricesPage />} />
            <Route path="/logs"       element={<LogsPage />} />
          </Route>
        </Route>
      </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
