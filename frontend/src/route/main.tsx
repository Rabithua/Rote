import ErrorPage from "@/pages/404";
import MineFilter from "@/pages/filter";
import Home from "@/pages/home";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Mine from "@/pages/mine";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "./protectedRoute";


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
          element: <ProtectedRoute><Mine /></ProtectedRoute>,
          errorElement: <ErrorPage />,
        },
        {
          path: "filter",
          element: <ProtectedRoute><MineFilter /></ProtectedRoute>,
          errorElement: <ErrorPage />,
        },
      ]
    },
    {
      path: "*",
      element: <ErrorPage />,
    },
  ]);

  return <RouterProvider router={router} />
}