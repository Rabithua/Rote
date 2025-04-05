export default function NavHeader({ title, icon }: any) {
  return (
    <div className="">
      <div className=" flex items-center gap-2 bg-bgLight dark:bg-bgDark border-b border-opacityLight dark:border-opacityDark text-2xl font-semibold p-4">
        {icon}
        {title}
      </div>
    </div>
  );
}
