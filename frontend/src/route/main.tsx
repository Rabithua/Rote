import { lazy, Suspense } from "react";

import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { ProtectedRoute } from "./protectedRoute";
import { LoadingOutlined } from "@ant-design/icons";
import { useProfile } from "@/state/profile";
import LayoutDashboard from "@/layout/dashboard";
import LayoutHome from "@/layout/mine/home";

const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const RotePage = lazy(() => import("@/pages/mine/home/rote"));
const TodoPage = lazy(() => import("@/pages/mine/home/todo"));
const JournalPage = lazy(() => import("@/pages/mine/home/journal"));
const LuckyPage = lazy(() => import("@/pages/mine/home/lucky"));
const ArticlePage = lazy(() => import("@/pages/mine/home/article"));
const MineFilter = lazy(() => import("@/pages/filter"));
const ProfilePage = lazy(() => import("@/pages/mine/profile/index"));
const ErrorPage = lazy(() => import("@/pages/404"));
const ExplorePage = lazy(() => import("@/pages/explore"));
const ArchivedPage = lazy(() => import("@/pages/archived"));

export default function GlobalRouterProvider() {
  const profile = useProfile();

  const router = createBrowserRouter([
    {
      path: "",
      element: profile ? <Navigate to="/mine" /> : <Navigate to="/landing" />,
      errorElement: <ErrorPage />,
      children: [],
    },
    {
      path: "landing",
      element: <Landing />,
      errorElement: <ErrorPage />,
    },
    {
      path: "login",
      element: <Login />,
      errorElement: <ErrorPage />,
    },
    {
      path: "mine",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <Navigate to="home" />,
        },
        {
          path: "home",
          element: <LayoutHome />,
          errorElement: <ErrorPage />,
          children: [
            {
              index: true,
              element: <Navigate to="rote" />,
            },
            {
              path: "rote",
              errorElement: <ErrorPage />,
              children: [
                {
                  index: true,
                  element: (
                    <ProtectedRoute>
                      <RotePage />
                    </ProtectedRoute>
                  ),
                  errorElement: <ErrorPage />,
                },
                {
                  path: "filter",
                  element: (
                    <ProtectedRoute>
                      <MineFilter />
                    </ProtectedRoute>
                  ),
                  errorElement: <ErrorPage />,
                },
              ],
            },
            {
              path: "todo",
              element: (
                <ProtectedRoute>
                  <TodoPage />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
            {
              path: "journal",
              element: (
                <ProtectedRoute>
                  <JournalPage />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
            {
              path: "lucky",
              element: (
                <ProtectedRoute>
                  <LuckyPage />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
            {
              path: "article",
              element: (
                <ProtectedRoute>
                  <ArticlePage />
                </ProtectedRoute>
              ),
              errorElement: <ErrorPage />,
            },
          ],
        },
        {
          path: "profile",
          element: <ProfilePage />,
          errorElement: <ErrorPage />,
        },
      ],
    },
    {
      path: "explore",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <ExplorePage />,
        },
      ],
    },
    {
      path: "archived",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <ArchivedPage />,
        },
      ],
    },
    {
      path: "*",
      element: <ErrorPage />,
    },
  ]);

  return (
    <Suspense
      fallback={
        <div className=" h-dvh w-screen flex justify-center items-center">
          <LoadingOutlined className=" text-4xl" />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
