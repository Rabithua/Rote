import RoteInputSimple from "@/components/roteInputSimple";
import { BarChartOutlined, UpOutlined } from "@ant-design/icons";
import { apiGetMyRote } from "@/api/rote/main";
import { useRotes, useRotesDispatch } from "@/state/rotes";
import slogenImg from "@/assets/img/slogen.svg";
import RoteList from "@/components/roteList";
// import Heatmap from "@/components/d3/heatmap";
import TagMap from "@/components/tagMap";
import { useProfile } from "@/state/profile";
import RandomRote from "@/components/randomRote";
import GoTop from "@/components/goTop";
import Heatmap from "@/components/d3/heatmap";
import { useTranslation } from "react-i18next";

function RotePage() {
  const { t } = useTranslation("translation", { keyPrefix: "pages.home" });
  const profile = useProfile();
  return (
    <div className=" flex w-full h-dvh">
      <div
        className={` border-r border-opacityLight dark:border-opacityDark scrollContainer scroll-smooth overscroll-contain flex-1 noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative`}
      >
        <div className=" sticky top-0 z-10 cursor-pointer group rotypesNav border-y border-opacityLight dark:border-opacityDark flex items-end gap-2 text-gray-600 bg-bgLight dark:bg-bgDark font-light p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="101"
            height="24"
            viewBox="0 0 202 48"
            fill="none"
          >
            <path
              d="M57.4492 10.6667V17.3333C57.4492 19.6096 56.9663 21.8635 56.0279 23.9665C55.0896 26.0695 53.7143 27.9803 51.9806 29.5898C50.2468 31.1994 48.1886 32.4762 45.9233 33.3472C43.658 34.2183 41.2301 34.6667 38.7782 34.6667H31.5971V48H25.8521V29.3333L25.9067 26.6667C26.2685 22.3132 28.3868 18.2469 31.8382 15.2806C35.2896 12.3143 39.8198 10.6665 44.5231 10.6667H57.4492ZM11.4898 0C15.7105 0.000296547 19.8242 1.23289 23.2487 3.52332C26.6732 5.81376 29.235 9.04603 30.5716 12.7627C28.3735 14.4919 26.5727 16.614 25.2764 19.0026C23.98 21.3913 23.2146 23.9977 23.0256 26.6667H20.1072C14.7745 26.6667 9.6601 24.7 5.88927 21.1993C2.11843 17.6986 0 12.9507 0 8V0H11.4898Z"
              fill="url(#paint0_linear_190_2)"
            />
            <path
              d="M196.3 34.536C197.233 35.1707 197.7 36.1973 197.7 37.616C197.7 38.9973 197.345 40.136 196.636 41.032C195.927 41.928 194.993 42.6747 193.836 43.272C191.447 44.504 188.964 45.12 186.388 45.12C183.812 45.12 181.759 44.84 180.228 44.28C178.735 43.72 177.484 42.9173 176.476 41.872C174.497 39.8933 173.508 37.0933 173.508 33.472C173.508 27.8347 175.039 23.2987 178.1 19.864C181.385 16.168 185.884 14.32 191.596 14.32C195.143 14.32 197.793 15.0667 199.548 16.56C200.855 17.68 201.508 19.1547 201.508 20.984C201.508 27.5547 195.833 30.84 184.484 30.84C184.335 31.8107 184.26 32.7067 184.26 33.528C184.26 35.2453 184.633 36.44 185.38 37.112C186.164 37.7467 187.265 38.064 188.684 38.064C190.103 38.064 191.559 37.7467 193.052 37.112C194.583 36.44 195.665 35.5813 196.3 34.536ZM184.876 28.432C187.527 28.432 189.617 27.6107 191.148 25.968C192.679 24.4 193.444 22.3653 193.444 19.864C193.444 19.0053 193.276 18.352 192.94 17.904C192.641 17.4187 192.175 17.176 191.54 17.176C190.905 17.176 190.308 17.3067 189.748 17.568C189.225 17.792 188.684 18.3147 188.124 19.136C186.743 21.0027 185.66 24.1013 184.876 28.432Z"
              fill="url(#paint1_linear_190_2)"
            />
            <path
              d="M154.5 38.4C154.5 37.392 154.762 35.6187 155.284 33.08L158.252 17.96H154.948L155.172 16.28C159.652 14.936 164.058 12.6213 168.388 9.336H171.076L169.732 15.44H174.1L173.596 17.96H169.284L166.428 33.08C165.943 35.3947 165.7 36.944 165.7 37.728C165.7 39.52 166.484 40.6027 168.052 40.976C167.679 42.2453 166.82 43.2533 165.476 44C164.132 44.7467 162.508 45.12 160.604 45.12C158.7 45.12 157.207 44.5227 156.124 43.328C155.042 42.1333 154.5 40.4907 154.5 38.4Z"
              fill="url(#paint2_linear_190_2)"
            />
            <path
              d="M132.726 45.12C124.513 45.12 120.406 41.256 120.406 33.528C120.406 28.04 121.918 23.5227 124.942 19.976C128.153 16.2053 132.54 14.32 138.102 14.32C142.134 14.32 145.177 15.2533 147.23 17.12C149.284 18.9867 150.31 21.88 150.31 25.8C150.31 31.7733 148.705 36.496 145.494 39.968C142.358 43.4027 138.102 45.12 132.726 45.12ZM134.182 20.76C133.734 21.768 133.324 23.0373 132.95 24.568C132.614 26.0613 132.222 28.0027 131.774 30.392C131.326 32.7813 131.102 35.4507 131.102 38.4C131.102 39.3707 131.252 40.1733 131.55 40.808C131.886 41.4427 132.484 41.76 133.342 41.76C134.201 41.76 134.892 41.5547 135.414 41.144C135.974 40.7333 136.46 40.0427 136.87 39.072C137.617 37.3547 138.289 34.9093 138.886 31.736C139.484 28.5253 139.801 26.2293 139.838 24.848C139.913 23.4667 139.95 22.272 139.95 21.264C139.95 20.2187 139.801 19.36 139.502 18.688C139.204 18.016 138.625 17.68 137.766 17.68C136.945 17.68 136.254 17.9413 135.694 18.464C135.134 18.9867 134.63 19.752 134.182 20.76Z"
              fill="url(#paint3_linear_190_2)"
            />
            <path
              d="M81.8972 44L88.7292 7.208C92.4252 6.79733 96.9612 6.592 102.337 6.592C107.751 6.592 111.708 7.376 114.209 8.944C116.711 10.512 117.961 12.8827 117.961 16.056C117.961 19.192 117.14 21.7493 115.497 23.728C113.892 25.7067 111.689 27.0133 108.889 27.648C109.524 30.7467 110.569 33.5467 112.025 36.048C113.369 38.4 114.825 39.9493 116.393 40.696C115.833 42.264 114.975 43.384 113.817 44.056C112.697 44.7653 111.316 45.12 109.673 45.12C108.068 45.12 106.631 44.6533 105.361 43.72C104.092 42.7493 102.953 41.3867 101.945 39.632C99.8172 35.824 98.6412 30.9147 98.4172 24.904H98.8092C101.572 24.8293 103.644 24.0827 105.025 22.664C106.407 21.208 107.097 18.968 107.097 15.944C107.097 12.1733 105.511 10.2133 102.337 10.064H101.105C100.769 10.064 100.508 10.0827 100.321 10.12L93.8812 44H81.8972Z"
              fill="url(#paint4_linear_190_2)"
            />
            <defs>
              <linearGradient
                id="paint0_linear_190_2"
                x1="109.073"
                y1="47.9188"
                x2="92.4055"
                y2="-60.6534"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#07C160" />
                <stop
                  offset="0.328125"
                  stopColor="#3ECF4A"
                  stopOpacity="0.96"
                />
                <stop
                  offset="0.666667"
                  stopColor="#99E626"
                  stopOpacity="0.400734"
                />
                <stop offset="1" stopColor="#FAFF00" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_190_2"
                x1="109.073"
                y1="47.9188"
                x2="92.4055"
                y2="-60.6534"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#07C160" />
                <stop
                  offset="0.328125"
                  stopColor="#3ECF4A"
                  stopOpacity="0.96"
                />
                <stop
                  offset="0.666667"
                  stopColor="#99E626"
                  stopOpacity="0.400734"
                />
                <stop offset="1" stopColor="#FAFF00" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint2_linear_190_2"
                x1="109.073"
                y1="47.9188"
                x2="92.4055"
                y2="-60.6534"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#07C160" />
                <stop
                  offset="0.328125"
                  stopColor="#3ECF4A"
                  stopOpacity="0.96"
                />
                <stop
                  offset="0.666667"
                  stopColor="#99E626"
                  stopOpacity="0.400734"
                />
                <stop offset="1" stopColor="#FAFF00" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint3_linear_190_2"
                x1="109.073"
                y1="47.9188"
                x2="92.4055"
                y2="-60.6534"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#07C160" />
                <stop
                  offset="0.328125"
                  stopColor="#3ECF4A"
                  stopOpacity="0.96"
                />
                <stop
                  offset="0.666667"
                  stopColor="#99E626"
                  stopOpacity="0.400734"
                />
                <stop offset="1" stopColor="#FAFF00" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint4_linear_190_2"
                x1="109.073"
                y1="47.9188"
                x2="92.4055"
                y2="-60.6534"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#07C160" />
                <stop
                  offset="0.328125"
                  stopColor="#3ECF4A"
                  stopOpacity="0.96"
                />
                <stop
                  offset="0.666667"
                  stopColor="#99E626"
                  stopOpacity="0.400734"
                />
                <stop offset="1" stopColor="#FAFF00" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <img
            className=" group-hover:opacity-100 opacity-0 duration-300 mb-[2px] ml-2 text-green-600 h-4"
            src={slogenImg}
            alt="slogen"
          />
        </div>
        <RoteInputSimple></RoteInputSimple>
        <RoteList
          rotesHook={useRotes}
          rotesDispatchHook={useRotesDispatch}
          api={apiGetMyRote}
          apiProps={{
            limit: 20,
            archived: false,
          }}
        />

        <GoTop scrollContainerName="scrollContainer" />
      </div>
      <div className=" gap-4 hidden md:flex flex-col w-72 shrink-0 scrollContainer scroll-smooth overscroll-contain noScrollBar h-dvh overflow-y-visible overflow-x-hidden relative p-4">
        <div className=" flex gap-2 text-lg font-semibold">
          <BarChartOutlined />
          {t("statistics")}
        </div>
        {profile && (
          <>
            <Heatmap />
            <TagMap />
          </>
        )}
        <RandomRote />
      </div>
    </div>
  );
}

export default RotePage;
