import { Divider } from '@/components/ui/divider';
import { Link } from 'react-router-dom';
import RandomCat from '../others/RandomCat';
import { SoftBottom } from '../others/SoftBottom';

export default function EveCat() {
  return (
    <div className="noScrollBar relative w-full overflow-x-hidden overflow-y-scroll p-4 sm:aspect-square">
      <div className="text-2xl font-semibold">
        EveDayOneCat <br />
        <div className="text-info mt-2 text-sm font-normal">
          <Link to={'http://motions.cat/index.html'} target="_blank">
            From: http://motions.cat/index.html
          </Link>
        </div>
      </div>
      <Divider></Divider>
      <RandomCat />
      <div>Click img to random one cat.</div>
      <SoftBottom className="translate-y-4.5" spacer />
    </div>
  );
}
