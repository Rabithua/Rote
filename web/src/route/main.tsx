import LayoutDashboard from '@/layout/dashboard';
import { isTokenValid } from '@/utils/main';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './protectedRoute';

import ErrorPage from '@/pages/404';
import AdminDashboard from '@/pages/admin';
import ArchivedPage from '@/pages/archived';
import ExperimentPage from '@/pages/experiment';
import ExplorePage from '@/pages/explore';
import MineFilter from '@/pages/filter';
import HomePage from '@/pages/home';
import Landing from '@/pages/landing';
import Login from '@/pages/login';
import PrivacyPolicyPage from '@/pages/privacy';
import ProfilePage from '@/pages/profile';
import SingleRotePage from '@/pages/rote/:roteid';
import SetupPage from '@/pages/setup';
import UserPage from '@/pages/user/:username';

export default function GlobalRouterProvider() {
  const isIosLogin = new URLSearchParams(window.location.search).get('type') === 'ioslogin';

  const router = createBrowserRouter([
    {
      path: 'landing',
      element: <Landing />,
      errorElement: <ErrorPage />,
    },
    {
      path: 'login',
      element: isTokenValid() && !isIosLogin ? <Navigate to="/home" /> : <Login />,
      errorElement: <ErrorPage />,
    },
    {
      path: '404',
      element: <ErrorPage />,
    },
    {
      path: 'setup',
      element: <SetupPage />,
      errorElement: <ErrorPage />,
    },
    {
      path: '',
      element: isTokenValid() ? <Navigate to="/home" /> : <Navigate to="/landing" />,
      errorElement: <ErrorPage />,
      children: [],
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
          path: 'privacy',
          errorElement: <ErrorPage />,
          element: <PrivacyPolicyPage />,
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
  ]);

  return <RouterProvider router={router} />;
}
