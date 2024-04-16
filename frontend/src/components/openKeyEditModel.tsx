import { SaveOutlined } from "@ant-design/icons";
import mainJson from "@/json/main.json";
import { Checkbox, CheckboxProps } from "antd";
import { useState } from "react";
import { apiEditOneMyOpenKey } from "@/api/rote/main";
import toast from "react-hot-toast";
import { useOpenKeysDispatch } from "@/state/openKeys";
const CheckboxGroup = Checkbox.Group;

const plainOptions: any = mainJson.permissionOptions;

function OpenKeyEditModel({ openKey, submitEdit, close }: any) {
  const openKeysDispatch = useOpenKeysDispatch();
  const defaultCheckedList: any = openKey.permissions;

  const [checkedList, setCheckedList] = useState<any[]>(defaultCheckedList);

  const checkAll = plainOptions.length === checkedList.length;

  const indeterminate =
    checkedList.length > 0 && checkedList.length < plainOptions.length;

  const onChange = (list: any[]) => {
    setCheckedList(list);
  };

  const onCheckAllChange: CheckboxProps["onChange"] = (e) => {
    setCheckedList(
      e.target.checked
        ? plainOptions.map((option: any) => {
            return option.value;
          })
        : []
    );
  };

  function save() {
    console.log("save");
    if (checkedList.length === 0) {
      toast.error("至少需要一个权限");
      return;
    }
    close();
    const toastId = toast.loading("保存中...");
    apiEditOneMyOpenKey(openKey.id, checkedList)
      .then((res) => {
        toast.success("保存成功", {
          id: toastId,
        });
        openKeysDispatch({
          type: "updateOne",
          openKey: res.data.data,
        });
      })
      .catch((err) => {
        toast.error("保存失败", {
          id: toastId,
        });
      });
  }

  return (
    <div className=" py-4">
      <CheckboxGroup
        options={plainOptions}
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
          全选
        </Checkbox>
        <div
          className=" cursor-pointer w-fit select-none duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95"
          onClick={save}
        >
          <SaveOutlined />
          保存
        </div>
      </div>
    </div>
  );
}

export default OpenKeyEditModel;
