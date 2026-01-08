import ScrollPositionManager from '@/components/ScrollPositionManager';
import LayoutDashboard from '@/layout/dashboard';
import { isTokenValid } from '@/utils/main';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
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
 * 根路由组件，用于在 RouterProvider 内部渲染 ScrollPositionManager
 */
function RootLayout() {
  return (
    <>
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
