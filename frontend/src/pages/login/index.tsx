import { logOut, loginByPassword, registerBypassword } from "@/api/login/main";
import { useProfile, useProfileDispatch } from "@/state/profile";
import { UserOutlined } from "@ant-design/icons";
import { Avatar, Input, Typography } from "antd";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function Login() {
  const profile = useProfile()
  const profileDispatch = useProfileDispatch();
  const [type, setType] = useState('login')
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });
  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    email: "",
    nickname: ""
  });

  function login() {
    if (!loginData.username) {
      toast.error("username 不能为空");
      return;
    }
    if (!loginData.password) {
      toast.error("password 不能为空");
      return;
    }

    const toastId = toast.loading("登录中...");
    loginByPassword(loginData)
      .then((res) => {
        // console.log(res);
        toast.success("登录成功", {
          id: toastId,
        });
        profileDispatch({
          type: "updateProfile",
          profile: res.data.data
        })
        navigate("/mine")
      })
      .catch((err) => {
        console.log(err);
        toast.error(err.response.data.data.message, {
          id: toastId,
        });
      });
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
          profile: undefined
        })
      })
      .catch((err) => {
        console.log(err);
        toast.error('err.response.data.data.msg', {
          id: toastId,
        });
      });
  }

  function register() {
    if (!registerData.username) {
      toast.error("username 不能为空");
      return;
    }
    if (!registerData.password) {
      toast.error("password 不能为空");
      return;
    }
    if (!registerData.email) {
      toast.error("email 不能为空");
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
          nickname: ""
        })
        setType('login')
      })
      .catch((err) => {
        toast.error(err.response.data.msg, {
          id: toastId,
        });
      });
  }

  function handleInputChange(e: any, key: string) {
    if (type === 'login') {
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
    setType(type === 'login' ? 'register' : 'login')
  }

  function handleLoginKeyDown(e: any) {
    if (e.key === 'Enter') {
      login()
    }
  }

  function handleRegisterKeyDown(e: any) {
    if (e.key === 'Enter') {
      register()
    }
  }

  return (
    <div className="h-screen w-full  bg-white  bg-grid-black/[0.2] relative flex items-center justify-center">
      {/* Radial gradient for the container to give a faded look */}
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center  bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <div className=" opacity-0 translate-y-5 animate-show px-5 py-6 bg-white w-80 border rounded-lg flex flex-col gap-2 pb-10 z-10">
        {
          profile ? <>
            <div className=" flex flex-col justify-center items-center pt-8 gap-2">
              <Avatar
                className=" bg-[#00000010] text-black shrink-0 block"
                size={{ xs: 60, sm: 60, md: 80, lg: 80, xl: 80, xxl: 80 }}
                icon={<UserOutlined className=" text-[#00000030]" />}
                src={profile.avatar}
              />
              <Typography.Title level={3}>{profile.username}</Typography.Title>
              <div
                className=" cursor-pointer duration-300 active:scale-95  border w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                onClick={() => {
                  navigate('/mine')
                }}
              >
                前往主页
              </div>
              <div className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgWhite text-black border font-semibold"
                onClick={logOutFn}
              >
                退出登录
              </div>
            </div>
          </> : <>
            <Typography.Title level={3}>{type === 'login' ? '登录' : '注册'}</Typography.Title>
            <div className=" flex flex-col gap-2">
              {
                type === 'login' ? <>
                  <Typography.Title level={5}>用户名</Typography.Title>
                  <Input
                    placeholder="username"
                    className=" text-lg rounded-md font-mono border-[2px]"
                    maxLength={20}
                    value={loginData.username}
                    onInput={(e) => handleInputChange(e, 'username')}
                  />
                  <Typography.Title level={5}>密码</Typography.Title>
                  <Input
                    placeholder="possword"
                    type="password"
                    className=" text-lg rounded-md font-mono border-[2px]"
                    maxLength={30}
                    value={loginData.password}
                    onInput={(e) => handleInputChange(e, 'password')}
                    onKeyDown={handleLoginKeyDown}
                  />
                </> : <>
                  <Typography.Title level={5}>用户名</Typography.Title>
                  <Input
                    placeholder="username"
                    className=" text-lg rounded-md font-mono border-[2px]"
                    maxLength={20}
                    value={registerData.username}
                    onInput={(e) => handleInputChange(e, 'username')}
                  />
                  <Typography.Title level={5}>邮箱</Typography.Title>
                  <Input
                    placeholder="someone@mail.com"
                    className=" text-lg rounded-md font-mono border-[2px]"
                    maxLength={20}
                    value={registerData.email}
                    onInput={(e) => handleInputChange(e, 'email')}
                  />
                  <Typography.Title level={5}>昵称</Typography.Title>
                  <Input
                    placeholder="nickname"
                    className=" text-lg rounded-md font-mono border-[2px]"
                    maxLength={20}
                    value={registerData.nickname}
                    onInput={(e) => handleInputChange(e, 'nickname')}
                  />

                  <Typography.Title level={5}>密码</Typography.Title>
                  <Input
                    placeholder="possword"
                    type="password"
                    className=" text-lg rounded-md font-mono border-[2px]"
                    maxLength={30}
                    value={registerData.password}
                    onInput={(e) => handleInputChange(e, 'password')}
                    onKeyDown={handleRegisterKeyDown}
                  />
                </>
              }
              <div className=" mt-4 flex flex-col gap-2">
                {
                  type === 'login' ? <>
                    <div
                      className=" cursor-pointer duration-300 active:scale-95  border w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                      onClick={login}
                    >
                      登录
                    </div>
                    <div className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgWhite text-black border font-semibold"
                      onClick={changeType}
                    >
                      注册
                    </div>
                  </> : <>
                    <div className=" cursor-pointer duration-300 active:scale-95  border w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
                      onClick={register}
                    >
                      注册
                    </div>
                    <div className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgWhite text-black border font-semibold"
                      onClick={changeType}
                    >
                      返回
                    </div>
                  </>
                }
              </div>
            </div></>
        }
      </div>
    </div>
  );
}

export default Login;
