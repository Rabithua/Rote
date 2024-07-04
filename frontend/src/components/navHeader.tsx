export default function NavHeader({ title, icon }: any) {
  return (
    <div className=" sticky top-0 z-10">
      <div className=" flex gap-2 bg-white border-b text-2xl font-semibold p-4">
        {icon}
        {title}
      </div>
    </div>
  );
}
