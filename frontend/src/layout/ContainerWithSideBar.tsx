import FloatBtns from '@/components/FloatBtns';
import { SideContentLayout } from '@/components/layout/SideContentLayout';
import { Drawer } from 'antd';
import { Layers } from 'lucide-react';
import { ReactNode, useState } from 'react';

function ContainerWithSideBar({
  sidebar,
  sidebarHeader,
  children,
}: {
  sidebar?: ReactNode;
  sidebarHeader?: ReactNode;
  children?: ReactNode;
}) {
  const [drawOpen, setDrawOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <div className="relative min-w-0 flex-1 overflow-visible border-opacityLight pb-20 sm:pb-0 md:border-r dark:border-opacityDark">
        {children}
      </div>

      {(sidebar || sidebarHeader) && (
        <SideContentLayout>
          {sidebarHeader}
          {sidebar && <div className="sticky top-0 flex w-full flex-col gap-4">{sidebar}</div>}
        </SideContentLayout>
      )}

      <FloatBtns>
        <div
          className="block w-fit cursor-pointer rounded-md bg-bgDark px-4 py-2 text-textDark duration-300 hover:scale-105 md:hidden dark:bg-bgLight dark:text-textLight"
          onClick={() => setDrawOpen(!drawOpen)}
        >
          <Layers className="size-4" />
        </div>
      </FloatBtns>

      <Drawer open={drawOpen} onClose={() => setDrawOpen(false)} placement="bottom" height={'80%'}>
        {sidebar}
      </Drawer>
    </div>
  );
}

export default ContainerWithSideBar;
