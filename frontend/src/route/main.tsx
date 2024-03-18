import { lazy, Suspense } from "react";

import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { ProtectedRoute } from "./protectedRoute";
import { LoadingOutlined } from "@ant-design/icons";
import { useProfile } from "@/state/profile";
import LayoutDashboadrd from "@/layout/dashboard";

const Landing = lazy(() => import("@/pages/landing"));
const Home = lazy(() => import("@/pages/home"));
const Login = lazy(() => import("@/pages/login"));
const Mine = lazy(() => import("@/pages/mine"));
const MineFilter = lazy(() => import("@/pages/filter"));
const ErrorPage = lazy(() => import("@/pages/404"));

export default function GlobalRouterProvider() {
  const profile = useProfile();

  const router = createBrowserRouter([
    {
      path: "/",
      element: profile ? <Navigate to="/mine" /> : <Navigate to="/landing" />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/landing",
      element: <Landing />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/home",
      element: <Home />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/login",
      element: <Login />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/mine",
      element: <LayoutDashboadrd />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: (
            <ProtectedRoute>
              <Mine />
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
