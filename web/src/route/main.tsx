import ScrollPositionManager from '@/components/ScrollPositionManager';
import { useSiteStatus } from '@/hooks/useSiteStatus';
import LayoutDashboard from '@/layout/dashboard';
import { isTokenValid } from '@/utils/main';
import { buildAbsoluteUrl, getBaseUrl, getOgLocale } from '@/utils/meta';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useTranslation } from 'react-i18next';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import { ProtectedRoute } from './protectedRoute';

import ErrorPage from '@/pages/404';
import AdminDashboard from '@/pages/admin';
import PrivacyPolicyPage from '@/pages/app/privacy';
import TermsOfServicePage from '@/pages/app/terms';
import ArchivedPage from '@/pages/archived';
import SelfhostedGuidePage from '@/pages/doc/selfhosted';
import ExperimentPage from '@/pages/experiment';
import ExplorePage from '@/pages/explore';
import MineFilter from '@/pages/filter';
import HomePage from '@/pages/home';
import Landing from '@/pages/landing';
import Login from '@/pages/login';
import ProfilePage from '@/pages/profile';
import SingleRotePage from '@/pages/rote/:roteid';
import SetupPage from '@/pages/setup';
import UserPage from '@/pages/user/:username';

/**
 * 全局 AppHelmet 组件，在 Router 内部使用 useLocation
 */
const AppHelmet = () => {
  const { data: siteStatus } = useSiteStatus();
  const { i18n } = useTranslation();
  const location = useLocation();
  const siteName = siteStatus?.site?.name || 'Rote';
  const siteDescription = siteStatus?.site?.description || '';
  const baseUrl = getBaseUrl(siteStatus);
  const ogLocale = getOgLocale(i18n?.language || 'en');
  const defaultImage = `${baseUrl}/logo.png`;

  // 动态获取当前路径并构建完整 URL
  const currentUrl = buildAbsoluteUrl(location?.pathname || '/', baseUrl);

  return (
    <Helmet>
      <title>{siteName || 'Rote'}</title>
      {siteDescription ? <meta name="description" content={siteDescription} /> : null}
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <link rel="apple-touch-startup-image" href="/logo.png" />

      {/* 动态设置 canonical URL 和 og:url */}
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph 基础标签 */}
      <meta property="og:site_name" content={siteName || 'Rote'} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content={ogLocale} />
      {siteDescription ? <meta property="og:description" content={siteDescription} /> : null}
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={defaultImage} />

      {/* Twitter Card 基础标签 */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:image" content={defaultImage} />
    </Helmet>
  );
};

/**
 * 根路由组件，用于在 RouterProvider 内部渲染 ScrollPositionManager 和 AppHelmet
 */
function RootLayout() {
  return (
    <>
      <AppHelmet />
      <ScrollPositionManager />
      <Outlet />
    </>
  );
}

export default function GlobalRouterProvider() {
  const isIosLogin = new URLSearchParams(window.location.search).get('type') === 'ioslogin';

  const router = createBrowserRouter([
    {
      element: <RootLayout />,
      errorElement: <ErrorPage />,
      children: [
        {
          path: 'landing',
          element: <Landing />,
        },
        {
          path: 'login',
          element: isTokenValid() && !isIosLogin ? <Navigate to="/home" /> : <Login />,
        },
        {
          path: '404',
          element: <ErrorPage />,
        },
        {
          path: 'setup',
          element: <SetupPage />,
        },
        {
          path: 'app',
          children: [
            {
              path: 'privacy',
              element: <PrivacyPolicyPage />,
            },
            {
              path: 'terms',
              element: <TermsOfServicePage />,
            },
          ],
        },
        {
          path: 'doc',
          children: [
            {
              path: 'selfhosted',
              element: <SelfhostedGuidePage />,
            },
          ],
        },
        {
          path: '',
          element: isTokenValid() ? <Navigate to="/home" /> : <Navigate to="/landing" />,
        },
        {
          path: '/',
          element: <LayoutDashboard />,
          children: [
            {
              path: 'home',
              element: (
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
            {
              path: 'filter',
              element: (
                <ProtectedRoute>
                  <MineFilter />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
            {
              path: 'profile',
              element: (
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
            {
              path: 'explore',
              element: <ExplorePage />,
              errorElement: <ErrorPage />,
            },
            {
              path: 'admin',
              errorElement: <ErrorPage />,
              element: (
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              ),
            },
            {
              path: 'rote',
              errorElement: <ErrorPage />,
              children: [
                {
                  path: ':roteid',
                  element: <SingleRotePage />,
                },
              ],
            },
            {
              path: 'archived',
              errorElement: <ErrorPage />,
              element: (
                <ProtectedRoute>
                  <ArchivedPage />
                </ProtectedRoute>
              ),
            },
            {
              path: 'experiment',
              errorElement: <ErrorPage />,
              element: (
                <ProtectedRoute>
                  <ExperimentPage />
                </ProtectedRoute>
              ),
            },
            {
              path: ':username',
              element: <UserPage />,
              errorElement: <ErrorPage />,
            },
          ],
        },
        {
          path: '*',
          element: <ErrorPage />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}
