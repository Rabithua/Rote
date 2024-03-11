import { lazy, Suspense } from "react";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "./protectedRoute";
import { LoadingOutlined } from "@ant-design/icons";

const Landing = lazy(() => import("@/pages/landing"));
const Home = lazy(() => import("@/pages/home"));
const Login = lazy(() => import("@/pages/login"));
const Mine = lazy(() => import("@/pages/mine"));
const MineFilter = lazy(() => import("@/pages/filter"));
const ErrorPage = lazy(() => import("@/pages/404"));

export default function GlobalRouterProvider() {
  const router = createBrowserRouter([
    {
      path: "/",
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
      errorElement: <ErrorPage />,
      children: [
        {
          path: "",
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
        <div className=" h-screen w-screen flex justify-center items-center">
          <LoadingOutlined />
        </div>
      }
    >
      <RouterProvider router={router} />
    </Suspense>
  );
}
