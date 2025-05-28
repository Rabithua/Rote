import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

export default function NavBar() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.navBar',
  });
  const location = useLocation();
  const navigate = useNavigate();

  function back() {
    const doesAnyHistoryEntryExist = location.key !== 'default';
    if (doesAnyHistoryEntryExist) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  }
  return (
    <>
      <div
        className={`noScrollBar bg-bgLight/90 dark:bg-bgDark/90 sticky top-0 z-10 w-full items-center gap-2 overflow-x-scroll px-2 py-4 backdrop-blur-xl duration-300 ${
          window.history.state && window.history.state.idx > 0 ? 'flex' : 'hidden'
        }`}
      >
        <ArrowLeft className="size-8 cursor-pointer p-1" onClick={back} />
        <div className="cursor-pointer text-lg font-medium" onClick={back}>
          {t('back')}
        </div>
      </div>
    </>
  );
}
