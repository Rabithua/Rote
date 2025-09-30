import LayoutDashboard from '@/layout/dashboard';
import { isTokenValid } from '@/utils/main';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ProtectedRoute } from './protectedRoute';

import ErrorPage from '@/pages/404';
import ArchivedPage from '@/pages/archived';
import ExperimentPage from '@/pages/experiment';
import ExplorePage from '@/pages/explore';
import MineFilter from '@/pages/filter';
import HomePage from '@/pages/home';
import Landing from '@/pages/landing';
import Login from '@/pages/login';
import ProfilePage from '@/pages/profile';
import SingleRotePage from '@/pages/rote/:roteid';
import UserPage from '@/pages/user/:username';

export default function GlobalRouterProvider() {
  const router = createBrowserRouter([
    {
      path: 'landing',
      element: <Landing />,
      errorElement: <ErrorPage />,
    },
    {
      path: 'login',
      element: isTokenValid() ? <Navigate to="/home" /> : <Login />,
      errorElement: <ErrorPage />,
    },
    {
      path: '404',
      element: <ErrorPage />,
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
          path: ':username',
          element: <UserPage />,
          errorElement: <ErrorPage />,
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
      ],
    },
    {
      path: '*',
      element: <ErrorPage />,
    },
  ]);

  return <RouterProvider router={router} />;
}
