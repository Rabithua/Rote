import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

export default function NavBar() {
  const { t } = useTranslation('translation', {
    keyPrefix: 'components.navBar',
  });
  let location = useLocation();
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
        className={`noScrollBar sticky top-0 z-10 w-full items-center overflow-x-scroll border-y border-b bg-bgLight/90 py-3 backdrop-blur-xl duration-300 dark:bg-bgDark/90 ${
          window.history.state && window.history.state.idx > 0 ? 'flex' : 'hidden'
        }`}
      >
        <ArrowLeft className="size-8 cursor-pointer p-2" onClick={back} />
        <div className="cursor-pointer text-base" onClick={back}>
          {t('back')}
        </div>
      </div>
    </>
  );
}
