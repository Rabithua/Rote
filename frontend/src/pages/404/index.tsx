export default function ErrorPage() {
  return (
    <>
      <main className=" h-dvh place-items-center bg-bgLight dark:bg-bgDark px-6 flex justify-center items-center">
        <div className=" flex flex-col gap-5">
          <p className=" text-[100px] lg:text-[200px] font-semibold font-mono  bg-black text-transparent bg-clip-text">404</p>
          <h1 className=" text-base lg:text-2xl font-bold tracking-tight text-gray-900 ">
            Page not found or an error occurred.
          </h1>
          <p className=" text-base leading-7 text-gray-600">
            Sorry, we couldn't find the page you were looking for.
          </p>
        </div>
      </main>
    </>
  );
}

