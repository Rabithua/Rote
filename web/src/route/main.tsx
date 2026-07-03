import LoadingPlaceholder from '@/components/others/LoadingPlaceholder';
import ScrollPositionManager from '@/components/ScrollPositionManager';
import LayoutDashboard from '@/layout/dashboard';
import { useAuthState } from '@/state/profile';
import { getSafeLoginRedirect } from '@/utils/loginRedirect';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './protectedRoute';

import NotFoundPage from '@/pages/404';
import AdminDashboard from '@/pages/admin';
import AiMemoryPage from '@/pages/ai';
import PrivacyPolicyPage from '@/pages/app/privacy';
import TermsOfServicePage from '@/pages/app/terms';
import ArchivedPage from '@/pages/archived';
import ArticleDetailPage from '@/pages/article/[articleid]';
import ArticleEditPage from '@/pages/article/edit';
import SelfhostedGuidePage from '@/pages/doc/selfhosted';
import ExperimentPage from '@/pages/experiment';
import RouteErrorPage from '@/pages/error';
import ExplorePage from '@/pages/explore';
import MineFilter from '@/pages/filter';
import HomePage from '@/pages/home';
import Landing from '@/pages/landing';
import Login from '@/pages/login';
import OAuthAuthorizePage from '@/pages/oauth/authorize';
import ProfilePage from '@/pages/profile';
import SettingsPage from '@/pages/profile/setting';
import SingleRotePage from '@/pages/rote/[roteid]';
import SetupPage from '@/pages/setup';
import UserPage from '@/pages/user/[username]';

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

function LoginRouteEntry() {
  const { tokenValid, isAuthPending } = useAuthState();
  const isIosLogin = new URLSearchParams(window.location.search).get('type') === 'ioslogin';

  if (isAuthPending && !isIosLogin) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  return tokenValid && !isIosLogin ? (
    <Navigate replace to={getSafeLoginRedirect(window.location.search)} />
  ) : (
    <Login />
  );
}

function RootRedirectEntry() {
  const { tokenValid, isAuthPending } = useAuthState();

  if (isAuthPending) {
    return <LoadingPlaceholder className="h-dvh w-full" size={6} />;
  }

  return tokenValid ? <Navigate to="/home" /> : <Navigate to="/landing" />;
}

export default function GlobalRouterProvider() {
  const router = createBrowserRouter([
    {
      element: <RootLayout />,
      errorElement: <RouteErrorPage />,
      children: [
        {
          path: 'landing',
          element: <Landing />,
        },
        {
          path: 'login',
          element: <LoginRouteEntry />,
        },
        {
          path: 'oauth',
          children: [
            {
              path: 'authorize',
              element: <OAuthAuthorizePage />,
            },
          ],
        },
        {
          path: '404',
          element: <NotFoundPage />,
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
          element: <RootRedirectEntry />,
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
              errorElement: <RouteErrorPage />,
            },
            {
              path: 'filter',
              element: (
                <ProtectedRoute>
                  <MineFilter />
                </ProtectedRoute>
              ),
              errorElement: <RouteErrorPage />,
            },
            {
              path: 'ai',
              element: (
                <ProtectedRoute>
                  <AiMemoryPage />
                </ProtectedRoute>
              ),
              errorElement: <RouteErrorPage />,
            },
            {
              path: 'profile',
              element: (
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              ),
              errorElement: <RouteErrorPage />,
            },
            {
              path: 'profile/setting',
              element: (
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              ),
              errorElement: <RouteErrorPage />,
            },
            {
              path: 'explore',
              element: <ExplorePage />,
              errorElement: <RouteErrorPage />,
            },
            {
              path: 'admin',
              errorElement: <RouteErrorPage />,
              element: (
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              ),
            },
            {
              path: 'rote',
              errorElement: <RouteErrorPage />,
              children: [
                {
                  path: ':roteid',
                  element: <SingleRotePage />,
                },
              ],
            },
            {
              path: 'article',
              errorElement: <RouteErrorPage />,
              children: [
                {
                  path: 'new',
                  element: (
                    <ProtectedRoute>
                      <ArticleEditPage />
                    </ProtectedRoute>
                  ),
                },
                {
                  path: ':articleid',
                  element: <ArticleDetailPage />,
                },
                {
                  path: ':articleid/edit',
                  element: (
                    <ProtectedRoute>
                      <ArticleEditPage />
                    </ProtectedRoute>
                  ),
                },
              ],
            },
            {
              path: 'archived',
              errorElement: <RouteErrorPage />,
              element: (
                <ProtectedRoute>
                  <ArchivedPage />
                </ProtectedRoute>
              ),
            },
            {
              path: 'experiment',
              errorElement: <RouteErrorPage />,
              element: (
                <ProtectedRoute>
                  <ExperimentPage />
                </ProtectedRoute>
              ),
            },
            {
              path: ':username',
              element: <UserPage />,
              errorElement: <RouteErrorPage />,
            },
          ],
        },
        {
          path: '*',
          element: <NotFoundPage />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}
