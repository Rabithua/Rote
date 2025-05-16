export default function NavHeader({ title, icon }: any) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-opacityLight bg-bgLight p-4 text-2xl font-semibold dark:border-opacityDark dark:bg-bgDark">
      {icon}
      {title}
    </div>
  );
}
