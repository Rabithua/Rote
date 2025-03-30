import { Divider } from "antd";
import { Link } from "react-router-dom";
import RandomCat from "../RandomCat";

export default function EveCat() {
  return (
    <div className=" w-full sm:w-[calc(50%-4px)] noScrollBar relative overflow-y-scroll overflow-x-hidden aspect-1 border-b p-4">
      <div className=" text-2xl font-semibold">
        EveDayOneCat <br />
        <div className=" font-normal mt-2 text-sm text-gray-500">
          <Link
            to={"http://motions.cat/index.html"}
            target="_blank"
          >
            From: http://motions.cat/index.html
          </Link>
        </div>
      </div>
      <Divider></Divider>
      <RandomCat />
      <div>Click img to random one cat.</div>
    </div>
  );
}
