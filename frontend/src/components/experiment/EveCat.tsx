import { Divider } from '@/components/ui/divider';
import { Link } from 'react-router-dom';
import RandomCat from '../RandomCat';

export default function EveCat() {
  return (
    <div className="noScrollBar relative aspect-square w-full overflow-x-hidden overflow-y-scroll p-4">
      <div className="text-2xl font-semibold">
        EveDayOneCat <br />
        <div className="mt-2 text-sm font-normal text-gray-500">
          <Link to={'http://motions.cat/index.html'} target="_blank">
            From: http://motions.cat/index.html
          </Link>
        </div>
      </div>
      <Divider></Divider>
      <RandomCat />
      <div>Click img to random one cat.</div>
    </div>
  );
}
