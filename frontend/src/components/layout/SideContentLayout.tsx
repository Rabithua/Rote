import { ReactNode } from "react";

export function SideContentLayout({ children }: { children: ReactNode }) {
  return (
    <div className=" w-72 shrink-0 relative hidden md:block">
      <div className="p-4 h-dvh w-72 fixed top-0 overflow-y-scroll noScrollBar hidden md:block">
        {children}
      </div>
    </div>
  );
}
