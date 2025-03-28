import { loginByPassword, registerBypassword } from "@/api/login/main";
import { apiGetStatus } from "@/api/rote/main";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { getMyProfile } from "@/api/user/main";
import Logo from "@/components/logo";
import mainJson from "@/json/main.json";
import { Profile } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { Input } from "antd";
import { Loader } from "lucide-react";
import { useTranslation } from "react-i18next";

function Login() {
  const { t } = useTranslation("translation", {
    keyPrefix: "pages.login",
  });

  const { safeRoutes } = mainJson;

  const { data: backendStatusOk, isLoading: isCheckingStatus } = useAPIGet(
    "checkStatus",
    apiGetStatus,
  );

  const { data: profile, mutate } = useAPIGet<Profile>(
    "profile",
    getMyProfile,
  );

  const [type, setType] = useState("login");
  const navigate = useNavigate();

  const [disbled, setDisbled] = useState(false);

  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    email: "",
    nickname: "",
  });

  const LoginDataZod = z.object({
    username: z
      .string()
      .min(1, t("validation.usernameRequired"))
      .max(20, t("validation.usernameMaxLength")),
    password: z
      .string()
      .min(1, t("validation.passwordRequired"))
      .max(30, t("validation.passwordMaxLength")),
  });

  const RegisterDataZod = z.object({
    username: z
      .string()
      .min(1, t("validation.usernameRequired"))
      .max(20, t("validation.usernameMaxLength"))
      .regex(/^[A-Za-z0-9_-]+$/, t("validation.usernameFormat"))
      .refine((value) => !safeRoutes.includes(value), {
        message: t("validation.usernameConflict"),
      }),
    password: z
      .string()
      .min(1, t("validation.passwordRequired"))
      .max(30, t("validation.passwordMaxLength")),
    email: z
      .string()
      .min(1, t("validation.emailRequired"))
      .max(30, t("validation.emailMaxLength"))
      .email(t("validation.emailFormat")),
    nickname: z
      .string()
      .min(1, t("validation.nicknameRequired"))
      .max(20, t("validation.nicknameMaxLength")),
  });

  function login() {
    try {
      LoginDataZod.parse(loginData);
    } catch (err: any) {
      toast.error(JSON.parse(err.message)[0].message);
      return;
    }

    const toastId = toast.loading(t("messages.loggingIn"));
    setDisbled(true);
    loginByPassword(loginData)
      .then(async (res) => {
        toast.success(t("messages.loginSuccess"), {
          id: toastId,
        });
        setDisbled(false);
        mutate();
        navigate("/home");
      })
      .catch((err) => {
        console.log(err);
        setDisbled(false);
        if ("code" in err.response?.data) {
          toast.error(err.response.data.msg, {
            id: toastId,
          });
        } else {
          toast.error(t("messages.backendDown"), {
            id: toastId,
          });
        }
      });
  }

  function register() {
    try {
      RegisterDataZod.parse(registerData);
    } catch (err: any) {
      toast.error(JSON.parse(err.message)[0].message);
      return;
    }

    const toastId = toast.loading(t("messages.registering"));
    setDisbled(false);
    registerBypassword(registerData)
      .then(() => {
        toast.success(t("messages.registerSuccess"), {
          id: toastId,
        });
        setDisbled(false);
        setRegisterData({
          username: "",
          password: "",
          email: "",
          nickname: "",
        });
        setType("login");
      })
      .catch((err) => {
        setDisbled(false);
        toast.error(err.response.data.msg, {
          id: toastId,
        });
      });
  }

  function handleInputChange(e: any, key: string) {
    if (type === "login") {
      const { value } = e.target;
      setLoginData((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    } else {
      const { value } = e.target;
      setRegisterData((prevState) => ({
        ...prevState,
        [key]: value,
      }));
    }
  }

  function changeType() {
    setType(type === "login" ? "register" : "login");
  }

  function handleLoginKeyDown(e: any) {
    if (e.key === "Enter") {
      login();
    }
  }

  function handleRegisterKeyDown(e: any) {
    if (e.key === "Enter") {
      register();
    }
  }

  useEffect(() => {
    if (profile) {
      navigate("/home");
    } else {
    }
  }, [profile, navigate]);

  return (
    <div className="h-dvh w-full dark:bg-bgDark bg-bgLight relative flex items-center justify-center">
      <div className=" opacity-0 translate-y-5 animate-show px-8 py-6 w-80 border-[1px] border-opacityLight dark:bg-opacityDark shadow-card dark:text-white rounded-lg flex flex-col gap-2 pb-10 z-10">
        {isCheckingStatus
          ? (
            <div className=" flex justify-center text-lg items-center py-8 gap-3 ">
              <Loader className="animate-spin size-6" />
            </div>
          )
          : backendStatusOk
          ? (
            <>
              <div className=" dark:invert mb-4">
                <Logo className=" w-32" color="#07C160" />
              </div>
              <div className=" flex flex-col gap-2">
                {type === "login"
                  ? (
                    <>
                      <div className=" text-md ">
                        {t("fields.username")}
                      </div>
                      <Input
                        placeholder="username"
                        className=" text-md rounded-md font-mono "
                        maxLength={20}
                        value={loginData.username}
                        onInput={(e) => handleInputChange(e, "username")}
                      />
                      <div className=" text-md ">
                        {t("fields.password")}
                      </div>
                      <Input
                        placeholder="possword"
                        type="password"
                        className=" text-md rounded-md font-mono "
                        maxLength={30}
                        value={loginData.password}
                        onInput={(e) => handleInputChange(e, "password")}
                        onKeyDown={handleLoginKeyDown}
                      />
                    </>
                  )
                  : (
                    <>
                      <div className=" text-md ">
                        {t("fields.username")}
                      </div>
                      <Input
                        placeholder="username"
                        className=" text-md rounded-md font-mono "
                        maxLength={20}
                        value={registerData.username}
                        onInput={(e) => handleInputChange(e, "username")}
                      />
                      <div className=" text-md ">
                        {t("fields.email")}
                      </div>
                      <Input
                        placeholder="someone@mail.com"
                        className=" text-md rounded-md font-mono "
                        maxLength={20}
                        value={registerData.email}
                        onInput={(e) => handleInputChange(e, "email")}
                      />
                      <div className=" text-md ">
                        {t("fields.nickname")}
                      </div>
                      <Input
                        placeholder="nickname"
                        className=" text-md rounded-md font-mono "
                        maxLength={20}
                        value={registerData.nickname}
                        onInput={(e) => handleInputChange(e, "nickname")}
                      />

                      <div className=" text-md ">
                        {t("fields.password")}
                      </div>
                      <Input
                        placeholder="possword"
                        type="password"
                        className=" text-md rounded-md font-mono "
                        maxLength={30}
                        value={registerData.password}
                        onInput={(e) => handleInputChange(e, "password")}
                        onKeyDown={handleRegisterKeyDown}
                      />
                    </>
                  )}
                <div className=" mt-4 flex flex-col gap-2">
                  {type === "login"
                    ? (
                      <>
                        <button
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-black text-white "
                          disabled={disbled}
                          onClick={login}
                        >
                          {t("buttons.login")}
                        </button>
                        <button
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black "
                          disabled={disbled}
                          onClick={changeType}
                        >
                          {t("buttons.register")}
                        </button>
                      </>
                    )
                    : (
                      <>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-black text-white "
                          onClick={register}
                        >
                          {t("buttons.register")}
                        </div>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black "
                          onClick={changeType}
                        >
                          {t("buttons.back")}
                        </div>
                      </>
                    )}
                </div>
              </div>

              <div className=" flex gap-1 items-center justify-center  cursor-pointer duration-300 active:scale-95">
                <Link to="/explore">
                  <div className=" hover:opacity-60 duration-300">
                    {t("nav.explore")}
                  </div>
                </Link>
                <span className=" px-2">/</span>
                <Link to="/landing">
                  <div className=" hover:opacity-60 duration-300">
                    {t("nav.home")}
                  </div>
                </Link>
              </div>
            </>
          )
          : (
            <>
              <div className=" ">{t("error.backendIssue")}</div>
              <div>{JSON.stringify(backendStatusOk)}</div>
              <div className=" text-gray-500">
                {t("error.dockerDeployment")}
              </div>
            </>
          )}
      </div>
    </div>
  );
}

export default Login;
