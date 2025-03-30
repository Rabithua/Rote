import { apiGetRandomRote } from "@/api/rote/main";
import { Rote } from "@/types/main";
import { useAPIGet } from "@/utils/fetcher";
import { RefreshCcwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import LoadingPlaceholder from "./LoadingPlaceholder";
import RoteItem from "./roteItem";

export default function RandomRote() {
  const { t } = useTranslation("translation", {
    keyPrefix: "components.randomRote",
  });

  const { data: rote, isLoading, isValidating, mutate } = useAPIGet<Rote>(
    "randomRote",
    apiGetRandomRote,
  );

  return (
    isLoading
      ? <LoadingPlaceholder size={6} className=" py-8" />
      : rote
      ? (
        <div className=" shrink-0">
          <div className=" flex gap-2 bg-bgLight dark:bg-bgDark text-md font-semibold py-2">
            {t("title")}
            <RefreshCcwIcon
              className={` cursor-pointer hover:opacity-50 size-4 duration-300 ml-auto ${
                isValidating && "animate-spin"
              }`}
              onClick={() => mutate()}
            />
          </div>
          <RoteItem rote={rote} randomRoteStyle />
        </div>
      )
      : null
  );
}
