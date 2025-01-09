import { lazy, Suspense } from "react";

import LayoutDashboard from "@/layout/dashboard";
import { useProfile } from "@/state/profile";
import { LoadingOutlined } from "@ant-design/icons";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { ProtectedRoute } from "./protectedRoute";

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
  const [profile] = useProfile();

  const router = createBrowserRouter(
    [
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
        path: "404",
        element: <ErrorPage />,
      },
      {
        path: "",
        element: profile ? <Navigate to="/home" /> : <Navigate to="/landing" />,
        errorElement: <ErrorPage />,
        children: [],
      },
      {
        path: "/",
        element: <LayoutDashboard />,
        children: [
          {
            path: "home",
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

          {
            path: "profile",
            element: (
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            ),
            errorElement: <ErrorPage />,
          },
          {
            path: "explore",
            element: <ExplorePage />,
            errorElement: <ErrorPage />,
          },
          {
            path: ":username",
            element: <UserPage />,
            errorElement: <ErrorPage />,
          },
          {
            path: "rote",
            errorElement: <ErrorPage />,
            children: [
              {
                path: ":roteid",
                element: <SingleRotePage />,
              },
            ],
          },
          {
            path: "archived",
            errorElement: <ErrorPage />,
            element: (
              <ProtectedRoute>
                <ArchivedPage />
              </ProtectedRoute>
            ),
          },
          {
            path: "experiment",
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
        path: "*",
        element: <ErrorPage />,
      },
    ],
    {
      future: {
        v7_startTransition: true,
      },
    }
  );

  return (
    <Suspense
      fallback={
        <div className=" h-dvh w-screen dark:text-white flex justify-center items-center">
          <LoadingOutlined className=" text-4xl" />
        </div>
      }
    >
      <RouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
    </Suspense>
  );
}
