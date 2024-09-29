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

const { safeRoutes } = mainJson;
function Login() {
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
    username: z.string().min(1, "用户名不能为空").max(20, "用户名不能超过20位"),
    password: z.string().min(1, "密码不能为空").max(30, "密码不能超过30位"),
  });

  const RegisterDataZod = z.object({
    username: z
      .string()
      .min(1, "用户名不能为空")
      .max(20, "用户名不能超过20位")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "用户名只能包含大小写字母和数字或者下划线和‘-’"
      )
      .refine((value) => !safeRoutes.includes(value), {
        message: "用户名与路由冲突，换一个吧",
      }),
    password: z.string().min(1, "密码不能为空").max(30, "密码不能超过30位"),
    email: z
      .string()
      .min(1, "邮箱不能为空")
      .max(30, "邮箱不能超过30位")
      .email("邮箱格式不正确"),
    nickname: z.string().min(1, "昵称不能为空").max(20, "昵称不能超过20位"),
  });

  function login() {
    try {
      LoginDataZod.parse(loginData);
    } catch (err: any) {
      toast.error(JSON.parse(err.message)[0].message);
      return;
    }

    const toastId = toast.loading("登录中...");
    loginByPassword(loginData)
      .then(async (res) => {
        toast.success("登录成功", {
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
          toast.error("Backend is Down!", {
            id: toastId,
          });
        }
      });
  }

  async function checkStatus() {
    try {
      const res = await apiGetStatus();
      if (res.data.code !== 0) {
        setCheckStatusMsg("请检查后端数据库状态是否正常");
      }
    } catch (err: any) {
      console.error("Error fetching status:", err);
      setCheckStatusMsg("请检查后端服务是否启动");
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
    const toastId = toast.loading("退出登录...");
    logOut()
      .then((res) => {
        // console.log(res);
        toast.success("退出登录成功", {
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

    const toastId = toast.loading("注册中...");
    registerBypassword(registerData)
      .then((res) => {
        toast.success("注册成功，返回登录", {
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
                    前往主页
                  </div>
                  <div
                    className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black font-semibold"
                    onClick={logOutFn}
                  >
                    退出登录
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className=" text-2xl font-semibold">
                  {type === "login" ? "登录" : "注册"}
                </div>
                <div className=" flex flex-col gap-2">
                  {type === "login" ? (
                    <>
                      <div className=" text-md font-semibold">用户名</div>
                      <Input
                        placeholder="username"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={loginData.username}
                        onInput={(e) => handleInputChange(e, "username")}
                      />
                      <div className=" text-md font-semibold">密码</div>
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
                      <div className=" text-md font-semibold">用户名</div>
                      <Input
                        placeholder="username"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={registerData.username}
                        onInput={(e) => handleInputChange(e, "username")}
                      />
                      <div className=" text-md font-semibold">邮箱</div>
                      <Input
                        placeholder="someone@mail.com"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={registerData.email}
                        onInput={(e) => handleInputChange(e, "email")}
                      />
                      <div className=" text-md font-semibold">昵称</div>
                      <Input
                        placeholder="nickname"
                        className=" text-lg rounded-md font-mono border-[2px]"
                        maxLength={20}
                        value={registerData.nickname}
                        onInput={(e) => handleInputChange(e, "nickname")}
                      />

                      <div className=" text-md font-semibold">密码</div>
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
                          登录
                        </div>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black font-semibold"
                          onClick={changeType}
                        >
                          注册
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                          onClick={register}
                        >
                          注册
                        </div>
                        <div
                          className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgLight dark:text-black font-semibold"
                          onClick={changeType}
                        >
                          返回
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className=" flex gap-1 items-center justify-center  cursor-pointer duration-300 active:scale-95">
              <Link to="/explore">
                <div className=" hover:opacity-60 duration-300">探索</div>
              </Link>
              <span className=" px-2">/</span>
              <Link to="/">
                <div className=" hover:opacity-60 duration-300">主页</div>
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className=" font-semibold">后端出问题了</div>
            <div>{checkStatusMsg}</div>
            <div className=" text-gray-500">
              使用docker部署，后端容器可能需要几分钟构建，可以在几分钟后刷新页面
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
