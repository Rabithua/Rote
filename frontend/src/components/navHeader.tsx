export default function NavHeader({ title, icon }: any) {
  return (
    <div className="bg-bgLight/90 dark:bg-bgDark/90 sticky top-0 z-10 flex items-center gap-2 p-4 text-2xl font-semibold backdrop-blur-xl">
      {icon}
      {title}
    </div>
  );
}
