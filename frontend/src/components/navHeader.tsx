export default function NavHeader({ title, icon }: any) {
  return (
    <div className="bg-bgLight dark:bg-bgDark sticky top-0 z-10 flex items-center gap-2 p-4 text-2xl font-semibold">
      {icon}
      {title}
    </div>
  );
}
