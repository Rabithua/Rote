function Login() {
  return (
    <div className="h-full w-full  bg-white  bg-grid-black/[0.2] relative flex items-center justify-center">
      {/* Radial gradient for the container to give a faded look */}
      <div className="absolute pointer-events-none inset-0 flex items-center justify-center  bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      <div className=" px-5 py-6 bg-white w-80 h-1/2 border rounded-lg">
        <div className=" font-semibold text-xl">登录</div>
        <input type="text" />
      </div>
    </div>
  );
}

export default Login;
