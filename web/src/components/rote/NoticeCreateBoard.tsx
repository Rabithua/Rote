import { SoftBottom } from '@/components/others/SoftBottom';
import SubList from '../experiment/SubList';

function NoticeCreateBoard() {
  return (
    <div className="divide-y">
      <div className="noScrollBar relative max-h-[50dvh] overflow-scroll pt-6">
        <SubList />
        <SoftBottom spacer />
      </div>
    </div>
  );
}

export default NoticeCreateBoard;
