import { SaveOutlined } from "@ant-design/icons";
import mainJson from "@/json/main.json";
import { Checkbox, CheckboxProps } from "antd";
import { useState, useMemo } from "react";
import { apiEditOneMyOpenKey } from "@/api/rote/main";
import toast from "react-hot-toast";
import { useOpenKeysDispatch } from "@/state/openKeys";
import { useTranslation } from "react-i18next";
const CheckboxGroup = Checkbox.Group;

function OpenKeyEditModel({ openKey, submitEdit, close }: any) {
  const { t, i18n } = useTranslation("translation", {
    keyPrefix: "components.openKeyEditModel",
  });
  const openKeysDispatch = useOpenKeysDispatch();
  const defaultCheckedList: any = openKey.permissions;

  const processedOptions = useMemo(
    () =>
      mainJson.permissionOptions.map((option) => ({
        ...option,
        label: option.label[i18n.language as keyof typeof option.label],
      })),
    [i18n.language]
  );

  const [checkedList, setCheckedList] = useState<any[]>(defaultCheckedList);

  const checkAll = processedOptions.length === checkedList.length;

  const indeterminate =
    checkedList.length > 0 && checkedList.length < processedOptions.length;

  const onChange = (list: any[]) => {
    setCheckedList(list);
  };

  const onCheckAllChange: CheckboxProps["onChange"] = (e) => {
    setCheckedList(
      e.target.checked
        ? processedOptions.map((option: any) => option.value)
        : []
    );
  };

  function save() {
    if (checkedList.length === 0) {
      toast.error(t("minimumPermission"));
      return;
    }
    close();
    const toastId = toast.loading(t("saving"));
    apiEditOneMyOpenKey(openKey.id, checkedList)
      .then((res) => {
        toast.success(t("saveSuccess"), {
          id: toastId,
        });
        openKeysDispatch({
          type: "updateOne",
          openKey: res.data.data,
        });
      })
      .catch((err) => {
        toast.error(t("saveFailed"), {
          id: toastId,
        });
      });
  }

  return (
    <div className=" py-4">
      <CheckboxGroup
        options={processedOptions}
        value={checkedList}
        onChange={onChange}
      />

      <div className=" flex gap-4 pt-8 items-center">
        <Checkbox
          indeterminate={indeterminate}
          onChange={onCheckAllChange}
          checked={checkAll}
          className=" ml-auto"
        >
          {t("selectAll")}
        </Checkbox>
        <div
          className=" cursor-pointer w-fit select-none duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95"
          onClick={save}
        >
          <SaveOutlined />
          {t("save")}
        </div>
      </div>
    </div>
  );
}

export default OpenKeyEditModel;
