import { SaveOutlined } from "@ant-design/icons";
import mainJson from "@/json/main.json";
import { Checkbox, CheckboxProps, Divider } from "antd";
import { useState } from "react";
const CheckboxGroup = Checkbox.Group;

const plainOptions: any = mainJson.permissionOptions;

function OpenKeyEditModel({ openKey, submitEdit }: any) {
  const defaultCheckedList: any = openKey.permissions.split(",");

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
        <div className=" cursor-pointer w-fit select-none duration-300 flex items-center gap-2 bg-black text-white px-4 py-1 rounded-md active:scale-95">
          <SaveOutlined />
          保存
        </div>
      </div>
    </div>
  );
}

export default OpenKeyEditModel;
