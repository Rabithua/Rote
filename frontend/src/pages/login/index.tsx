import { logOut, loginByPassword, registerBypassword } from "@/api/login/main";
import { apiGetMyTags, apiGetStatus } from "@/api/rote/main";
import { useFilterRotesDispatch } from "@/state/filterRotes";
import { useProfile, useProfileDispatch } from "@/state/profile";
import { useRotesDispatch } from "@/state/rotes";
import { useTags, useTagsDispatch } from "@/state/tags";
import { UserOutlined } from "@ant-design/icons";
import { Avatar, Input } from "antd";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import mainJson from "@/json/main.json";
import { useTranslation } from "react-i18next";

function Login() {
  const { t } = useTranslation("translation", {
    keyPrefix: "pages.login",
  });
  const { safeRoutes } = mainJson;
  const [checkStatusMsg, setCheckStatusMsg] = useState("");
  const profile = useProfile();
  const tags = useTags();
  const profileDispatch = useProfileDispatch();
  const filterRotesDispatch = useFilterRotesDispatch();
  const tagsDispatch = useTagsDispatch();
  const rotesDispatch = useRotesDispatch();
  const [type, setType] = useState("login");
  const navigate = useNavigate();
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
    loginByPassword(loginData)
      .then(async (res) => {
        toast.success(t("messages.loginSuccess"), {
          id: toastId,
        });
        profileDispatch({
          type: "updateProfile",
          profile: res.data.data,
        });
        localStorage.setItem("profile", JSON.stringify(res.data.data));
        await refreshTags();
        // navigate("/home");
      })
      .catch((err) => {
        console.log(err);
        if ("code" in err.response?.data) {
          toast.error(err.response.data.data.message, {
            id: toastId,
          });
        } else {
          toast.error(t("messages.backendDown"), {
            id: toastId,
          });
        }
      });
  }

  async function checkStatus() {
    try {
      const res = await apiGetStatus();
      if (res.data.code !== 0) {
        setCheckStatusMsg(t("messages.checkDatabase"));
      }
    } catch (err: any) {
      console.error("Error fetching status:", err);
      setCheckStatusMsg(t("messages.checkBackend"));
    }
  }

  async function refreshTags() {
    try {
      const res = await apiGetMyTags();
      tagsDispatch({
        type: "freshAll",
        tags: res.data.data.map((item: any) => ({
          value: item,
          label: item,
        })),
      });
    } catch (err: any) {
      console.error("Error fetching tags:", err);
      tagsDispatch({
        type: "freshAll",
        tags: [],
      });
      console.log(tags);
    }
  }

  function logOutFn() {
    const toastId = toast.loading(t("messages.loggingOut"));
    logOut()
      .then((res) => {
        // console.log(res);
        toast.success(t("messages.logoutSuccess"), {
          id: toastId,
        });
        profileDispatch({
          type: "updateProfile",
          profile: undefined,
        });
        filterRotesDispatch({
          type: "freshAll",
          rotes: [],
        });
        tagsDispatch({
          type: "freshAll",
          tags: [],
        });
        rotesDispatch({
          type: "freshAll",
          rotes: [],
        });
        localStorage.removeItem("profile");
      })
      .catch((err) => {
        console.log(err);
        toast.error("err.response.data.data.msg", {
          id: toastId,
        });
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
    registerBypassword(registerData)
      .then((res) => {
        toast.success(t("messages.registerSuccess"), {
          id: toastId,
        });
        setRegisterData({
          username: "",
          password: "",
          email: "",
          nickname: "",
        });
        setType("login");
      })
      .catch((err) => {
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
    checkStatus();
  }, []);

  return (
    <div className="h-dvh w-full dark:bg-bgDark bg-bgLight relative flex items-center justify-center">
      {/* Radial gradient for the container to give a faded look */}
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center "></div>
      <div className=" opacity-0 translate-y-5 animate-show px-5 py-6 w-80 dark:text-white rounded-lg flex flex-col gap-2 pb-10 z-10">
        {!checkStatusMsg ? (
          <>
            {profile ? (
              <>
                <div className=" flex flex-col justify-center items-center pt-8 gap-2">
                  <Avatar
                    className=" bg-[#00000010] shrink-0 block"
                    size={{ xs: 60, sm: 60, md: 80, lg: 80, xl: 80, xxl: 80 }}
                    icon={<UserOutlined className=" text-[#00000030]" />}
                    src={profile.avatar}
                  />
                  <div className=" text-2xl font-semibold">
                    {profile.username}
                  </div>
                  <div
                    className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                    onClick={() => {
                      navigate("/home");
                    }}
                  >
                    {t("buttons.toHome")}
                  </div>
                  <div
                    className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black font-semibold"
                    onClick={logOutFn}
                  >
                    {t("buttons.logout")}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className=" text-2xl font-semibold">
                  {type === "login" ? t("title.login") : t("title.register")}
                </div>
                <div className=" flex flex-col gap-2">
                  {type === "login" ? (
                    <>
                      <div className=" text-md font-semibold">
                        {t("fields.username")}
                      </div>
                      <Input
                        placeholder="username"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={loginData.username}
                        onInput={(e) => handleInputChange(e, "username")}
                      />
                      <div className=" text-md font-semibold">
                        {t("fields.password")}
                      </div>
                      <Input
                        placeholder="possword"
                        type="password"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={30}
                        value={loginData.password}
                        onInput={(e) => handleInputChange(e, "password")}
                        onKeyDown={handleLoginKeyDown}
                      />
                    </>
                  ) : (
                    <>
                      <div className=" text-md font-semibold">
                        {t("fields.username")}
                      </div>
                      <Input
                        placeholder="username"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={registerData.username}
                        onInput={(e) => handleInputChange(e, "username")}
                      />
                      <div className=" text-md font-semibold">
                        {t("fields.email")}
                      </div>
                      <Input
                        placeholder="someone@mail.com"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={registerData.email}
                        onInput={(e) => handleInputChange(e, "email")}
                      />
                      <div className=" text-md font-semibold">
                        {t("fields.nickname")}
                      </div>
                      <Input
                        placeholder="nickname"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={registerData.nickname}
                        onInput={(e) => handleInputChange(e, "nickname")}
                      />

                      <div className=" text-md font-semibold">
                        {t("fields.password")}
                      </div>
                      <Input
                        placeholder="possword"
                        type="password"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={30}
                        value={registerData.password}
                        onInput={(e) => handleInputChange(e, "password")}
                        onKeyDown={handleRegisterKeyDown}
                      />
                    </>
                  )}
                  <div className=" mt-4 flex flex-col gap-2">
                    {type === "login" ? (
                      <>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                          onClick={login}
                        >
                          {t("buttons.login")}
                        </div>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black font-semibold"
                          onClick={changeType}
                        >
                          {t("buttons.register")}
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                          onClick={register}
                        >
                          {t("buttons.register")}
                        </div>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black font-semibold"
                          onClick={changeType}
                        >
                          {t("buttons.back")}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className=" flex gap-1 items-center justify-center  cursor-pointer duration-300 active:scale-95">
              <Link to="/explore">
                <div className=" hover:opacity-60 duration-300">
                  {t("nav.explore")}
                </div>
              </Link>
              <span className=" px-2">/</span>
              <Link to="/">
                <div className=" hover:opacity-60 duration-300">
                  {t("nav.home")}
                </div>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className=" font-semibold">{t("error.backendIssue")}</div>
            <div>{checkStatusMsg}</div>
            <div className=" text-gray-500">{t("error.dockerDeployment")}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
