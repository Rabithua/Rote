import React, { Children } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { Toaster } from "react-hot-toast";
import reportWebVitals from "./reportWebVitals";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import ErrorPage from "./pages/404";
import Home from "./pages/home";
import Landing from "./pages/landing";
import "./utils/i18n";
import Mine from "./pages/mine";
import { ConfigProvider } from "antd";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

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
    path: "/mine",
    element: <Mine />,
    errorElement: <ErrorPage />,
  },
  {
    path: "*",
    element: <ErrorPage />,
  },
]);

root.render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        components: {
          Select: {
            /* 这里是你的组件 token */
            optionSelectedBg: "#00000010",
            colorPrimary: "#000000",
            colorBgContainer: "#000000",
            colorPrimaryHover: "#00000080"
          },
        },
      }}
    >
      <RouterProvider router={router} />
      <Toaster position="top-right" reverseOrder={false} />
    </ConfigProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
