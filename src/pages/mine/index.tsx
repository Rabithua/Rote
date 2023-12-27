import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../components/languageSwitcher";

function Mine() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.mine" });

  const icons = [
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 36V30"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M20.14 5.64019L6.28004 16.7402C4.72004 17.9802 3.72004 20.6002 4.06004 22.5602L6.72004 38.4802C7.20004 41.3202 9.92004 43.6202 12.8 43.6202H35.2C38.06 43.6202 40.8 41.3002 41.28 38.4802L43.94 22.5602C44.26 20.6002 43.26 17.9802 41.72 16.7402L27.86 5.66019C25.72 3.94019 22.26 3.94019 20.14 5.64019Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      ),
      name: "首页",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M24.0401 5.81982C17.4201 5.81982 12.0401 11.1998 12.0401 17.8198V23.5998C12.0401 24.8198 11.5201 26.6798 10.9001 27.7198L8.60005 31.5398C7.18005 33.8998 8.16005 36.5198 10.7601 37.3998C19.3801 40.2798 28.6801 40.2798 37.3001 37.3998C39.7201 36.5998 40.7801 33.7398 39.4601 31.5398L37.1601 27.7198C36.5601 26.6798 36.0401 24.8198 36.0401 23.5998V17.8198C36.0401 11.2198 30.6401 5.81982 24.0401 5.81982Z"
            stroke="#171717"
            stroke-width="3"
            stroke-miterlimit="10"
            stroke-linecap="round"
          />
          <path
            d="M27.74 6.39988C27.12 6.21988 26.48 6.07988 25.82 5.99988C23.9 5.75988 22.06 5.89988 20.34 6.39988C20.92 4.91988 22.36 3.87988 24.04 3.87988C25.72 3.87988 27.16 4.91988 27.74 6.39988Z"
            stroke="#171717"
            stroke-width="3"
            stroke-miterlimit="10"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M30.04 38.1201C30.04 41.4201 27.34 44.1201 24.04 44.1201C22.4 44.1201 20.88 43.4401 19.8 42.3601C18.72 41.2801 18.04 39.7601 18.04 38.1201"
            stroke="#171717"
            stroke-width="3"
            stroke-miterlimit="10"
          />
        </svg>
      ),
      name: "消息",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M6.33997 14.8799L24 25.0999L41.54 14.9399"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M24 43.2201V25.0801"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M19.86 4.96007L9.18003 10.8801C6.76003 12.2201 4.78003 15.5801 4.78003 18.3401V29.6401C4.78003 32.4001 6.76003 35.7601 9.18003 37.1001L19.86 43.0401C22.14 44.3001 25.88 44.3001 28.16 43.0401L38.84 37.1001C41.26 35.7601 43.24 32.4001 43.24 29.6401V18.3401C43.24 15.5801 41.26 12.2201 38.84 10.8801L28.16 4.94007C25.86 3.68007 22.14 3.68007 19.86 4.96007Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      ),
      name: "归档",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M38 18C38 20.9 37.14 23.56 35.66 25.78C33.5 28.98 30.08 31.24 26.1 31.82C25.42 31.94 24.72 32 24 32C23.28 32 22.58 31.94 21.9 31.82C17.92 31.24 14.5 28.98 12.34 25.78C10.86 23.56 10 20.9 10 18C10 10.26 16.26 4 24 4C31.74 4 38 10.26 38 18Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M42.5 36.9398L39.2 37.7198C38.46 37.8998 37.88 38.4598 37.72 39.1998L37.02 42.1398C36.64 43.7398 34.6 44.2198 33.54 42.9598L24 31.9998L14.46 42.9798C13.4 44.2398 11.36 43.7598 10.98 42.1598L10.28 39.2198C10.1 38.4798 9.52004 37.8998 8.80004 37.7398L5.50004 36.9598C3.98004 36.5998 3.44004 34.6998 4.54004 33.5998L12.34 25.7998C14.5 28.9998 17.92 31.2598 21.9 31.8398C22.58 31.9598 23.28 32.0198 24 32.0198C24.72 32.0198 25.42 31.9598 26.1 31.8398C30.08 31.2598 33.5 28.9998 35.66 25.7998L43.46 33.5998C44.56 34.6798 44.02 36.5798 42.5 36.9398Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M25.1599 11.96L26.3399 14.32C26.4999 14.64 26.9199 14.96 27.2999 15.02L29.4399 15.38C30.7999 15.6 31.1199 16.6 30.1399 17.58L28.4799 19.24C28.1999 19.52 28.0399 20.06 28.1399 20.46L28.6199 22.52C28.9999 24.14 28.1399 24.78 26.6999 23.92L24.6999 22.74C24.3399 22.52 23.7399 22.52 23.3799 22.74L21.3799 23.92C19.9399 24.76 19.0799 24.14 19.4599 22.52L19.9399 20.46C20.0199 20.08 19.8799 19.52 19.5999 19.24L17.9399 17.58C16.9599 16.6 17.2799 15.62 18.6399 15.38L20.7799 15.02C21.1399 14.96 21.5599 14.64 21.7199 14.32L22.8999 11.96C23.4799 10.68 24.5199 10.68 25.1599 11.96Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      ),
      name: "勋章",
    },
    {
      svg: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
          <path
            d="M24.2399 25.56C24.0999 25.54 23.9199 25.54 23.7599 25.56C20.2399 25.44 17.4399 22.56 17.4399 19.02C17.4399 15.4 20.3599 12.46 23.9999 12.46C27.6199 12.46 30.5599 15.4 30.5599 19.02C30.5399 22.56 27.7599 25.44 24.2399 25.56Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M37.48 38.7601C33.92 42.0201 29.2 44.0001 24 44.0001C18.8 44.0001 14.08 42.0201 10.52 38.7601C10.72 36.8801 11.92 35.0401 14.06 33.6001C19.54 29.9601 28.5 29.9601 33.94 33.6001C36.08 35.0401 37.28 36.8801 37.48 38.7601Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z"
            stroke="#171717"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      ),
      name: "个人",
    },
  ];

  return (
    <div className=" bg-bgWhite dark:text-white dark:bg-bgDark w-screen h-screen">
      <div className=" max-w-[1080px] sm:w-[80%] h-full font-sans flex mx-auto">
        <LanguageSwitcher />
        <div className=" duration-300 md:w-[150px] px-2 md:px-5 shrink-0 h-full border-r border-[#00000005] flex flex-col gap-4 items-center justify-center">
          {icons.map((icon, index) => {
            return (
              <div className=" duration-300 cursor-default flex gap-2 items-center justify-center py-1 px-3 rounded-full hover:bg-[#00000010]">
                <div className=" w-8 h-8 p-1 shrink-0">{icon.svg}</div>
                <div className=" shrink-0 hidden md:block">{icon.name}</div>
              </div>
            );
          })}
        </div>
        <div className=" flex-1 h-full ">123</div>
      </div>
    </div>
  );
}

export default Mine;
