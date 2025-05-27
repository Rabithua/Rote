import Logo from '@/components/logo';
import type { Profile } from '@/types/main';
import { get } from '@/utils/api';
import { useAPIGet } from '@/utils/fetcher';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

function Landing() {
  const { t } = useTranslation('translation', { keyPrefix: 'pages.landing' });
  const links = [
    {
      name: 'login',
      href: '/login',
    },
    {
      name: 'userGuide',
      href: '#',
    },
    {
      name: 'github',
      href: 'https://github.com/Rabithua/Rote',
    },
    {
      name: 'blog',
      href: 'https://rabithua.club',
    },
    // {
    //   name: "download",
    //   href: "/#",
    // },
    // {
    //   name: "donate",
    //   href: "/#",
    // },
  ];

  const { data: profile } = useAPIGet<Profile>('profile', () =>
    get('/users/me/profile').then((res) => res.data)
  );
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center dark:text-white">
      <div className="mt-10 mb-4 flex h-full w-[96%] max-w-[1080px] flex-col gap-5 sm:w-[80%]">
        {/* <LanguageSwitcher /> */}
        <div className="z-10 flex flex-wrap items-center gap-6 px-5">
          <Logo color="#07C160" />
          <div className="h-2 w-2 rounded-full bg-[#ffca27]"></div>
          <div className="text-xl md:text-2xl">{t('poem')}</div>
        </div>
        <div className="z-10 flex flex-col gap-2 px-5 leading-relaxed md:gap-5">
          <div className="flex flex-wrap items-center text-xl font-semibold whitespace-pre-wrap">
            {t('types.0')} <span className="px-2">/</span>
            {t('types.1')} <span className="px-2">/</span>
            {t('types.2')} <span className="px-2">/</span>
            {t('types.3')} <span className="px-2">/</span>
            {t('types.4')}
          </div>
          <div className="flex text-xl font-semibold md:text-5xl">{t('slogen')}</div>
          <div className="flex text-xl font-semibold md:text-4xl">{t('openApi')}</div>
          <div className="flex text-xl font-semibold md:text-3xl">{t('data')}</div>
          {/* <div className=" flex text-[#07c16020] text-3xl">RSS</div> */}
          <div className="flex flex-wrap items-center text-xl font-semibold whitespace-pre-wrap md:text-3xl">
            <span className="pr-2">{t('links')}</span>
            {links.map((item, index) => {
              return (
                <div key={item.name}>
                  <Link to={profile && item.name === 'login' ? '/home' : item.href}>
                    <span className="no-underline duration-300 hover:text-[#07c160] active:scale-95">
                      {profile && item.href === '/login'
                        ? t(`dashboard`)
                        : t(`linksItems.${index}`)}
                    </span>
                  </Link>
                  {index + 1 < links.length ? <span className="px-2">/</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;
