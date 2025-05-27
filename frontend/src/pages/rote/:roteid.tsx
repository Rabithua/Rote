import LoadingPlaceholder from '@/components/LoadingPlaceholder';
import NavBar from '@/components/navBar';
import RoteItem from '@/components/roteItem';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import type { Rote } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { User } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

function SingleRotePage() {
  // const { t } = useTranslation("translation", { keyPrefix: "pages.rote" });
  const navigate = useNavigate();
  const { roteid } = useParams();

  const {
    data: rote,
    isLoading,
    error,
  } = useAPIGet<Rote>(roteid || '', () => get('/notes/' + roteid).then((res) => res.data));

  useEffect(() => {
    if (!roteid) {
      navigate('/404');
    }
  }, [roteid, navigate]);

  if (!roteid) {
    return null;
  }

  return (
    <div className={`noScrollBar relative flex-1 overflow-x-hidden overflow-y-visible pb-20`}>
      <NavBar />
      {isLoading ? (
        <LoadingPlaceholder className="py-8" size={6} />
      ) : rote ? (
        <>
          <div className="flex flex-col items-center pb-16">
            <div></div>
            <RoteItem rote={rote} />
          </div>
          {rote.author && (
            <Link to={`/${rote.author.username}`}>
              <div className="bg-bgLight/90 shadow-card dark:bg-bgDark/90 fixed right-0 bottom-16 left-0 mx-auto flex w-fit cursor-pointer items-center justify-center gap-4 rounded-full px-6 py-2 backdrop-blur-xl duration-300 hover:scale-95">
                <Avatar className="size-10 bg-[#00000010] text-black">
                  {rote?.author.avatar ? (
                    <AvatarImage src={rote.author.avatar} />
                  ) : (
                    <AvatarFallback>
                      <User className="size-4 text-[#00000030]" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex items-center gap-2">
                  <div className="text-textLight dark:text-textDark text-base font-semibold">
                    {rote?.author.nickname}
                  </div>
                  <div className="text-md text-gray-500">@{rote?.author.username}</div>
                </div>
              </div>
            </Link>
          )}
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">{error}</div>
      )}
    </div>
  );
}

export default SingleRotePage;
