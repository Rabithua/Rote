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

const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const RotePage = lazy(() => import("@/pages/home"));
const MineFilter = lazy(() => import("@/pages/filter"));
const ProfilePage = lazy(() => import("@/pages/profile/index"));
const ErrorPage = lazy(() => import("@/pages/404"));
const ExplorePage = lazy(() => import("@/pages/explore"));
const ArchivedPage = lazy(() => import("@/pages/archived"));
const UserPage = lazy(() => import("@/pages/user/:username"));
const SingleRotePage = lazy(() => import("@/pages/rote/:roteid"));
const ExperimentPage = lazy(() => import("@/pages/experiment"));

export default function GlobalRouterProvider() {
  const profile = useProfile();

  const router = createBrowserRouter([
    {
      path: "",
      element: profile ? <Navigate to="/home" /> : <Navigate to="/landing" />,
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
      path: "home",
      element: <LayoutDashboard />,
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
      ],
    },

    {
      path: "filter",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
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
      path: "profile",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: (
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          ),
          errorElement: <ErrorPage />,
        },
      ],
    },
    {
      path: "404",
      element: <ErrorPage />,
    },
    {
      path: ":username",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <UserPage />,
        },
      ],
    },
    {
      path: "rote",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          path: ":roteid",
          element: <SingleRotePage />,
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
          element: (
            <ProtectedRoute>
              <ArchivedPage />
            </ProtectedRoute>
          ),
        },
      ],
    },
    {
      path: "experiment",
      element: <LayoutDashboard />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: (
            <ProtectedRoute>
              <ExperimentPage />
            </ProtectedRoute>
          ),
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
        <div className=" h-dvh w-screen dark:text-white flex justify-center items-center">
          <LoadingOutlined className=" text-4xl" />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
