import { Button, Input, Typography } from "antd";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  function login() {
    const toastId = toast.loading("登录中...");
    setTimeout(() => {
      toast.success("登录成功", {
        id: toastId,
      });
      navigate("/mine");
    }, 3000);
  }
  return (
    <div className="h-full w-full  bg-white  bg-grid-black/[0.2] relative flex items-center justify-center">
      {/* Radial gradient for the container to give a faded look */}
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center  bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <div className=" px-5 py-6 bg-white w-80 border rounded-lg flex flex-col gap-2 pb-10">
        <Typography.Title level={3}>登录</Typography.Title>
        <div className=" flex flex-col gap-2">
          <Typography.Title level={5}>用户名</Typography.Title>
          <Input
            placeholder="username"
            className=" text-lg rounded-md font-mono border-[2px]"
          />
          <Typography.Title level={5}>密码</Typography.Title>
          <Input
            placeholder="possword"
            type="password"
            className=" text-lg rounded-md font-mono border-[2px]"
          />
          <div className=" mt-4 flex flex-col gap-2">
            <div
              className=" cursor-pointer duration-300 active:scale-95  border w-full text-center rounded-md px-3 py-2 bg-black text-white font-semibold"
              onClick={login}
            >
              登录
            </div>
            <div className=" cursor-pointer duration-300 active:scale-95 w-full text-center rounded-md px-3 py-2 bg-bgWhite text-black border font-semibold">
              注册
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
