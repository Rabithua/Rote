import { Editor } from "novel";
import { useState } from "react";
import { apiAddRote } from "../../api/rote/main";
import toast from "react-hot-toast";

function Home() {
  const [htmlContent, setHtmlContent] = useState<string | undefined>("");
  const [jsonContent, setJsonContent] = useState<object | undefined>(undefined);

  function addRote() {
    if (jsonContent) {
      let data = {
        title: "测试文章",
        content: JSON.stringify(jsonContent),
        authorid: "658281aca6d42fed8076313a",
      };
      apiAddRote(data)
        .then((r) => {
          toast.success("已保存");
        })
        .catch((e) => {
          console.log(e);
          toast.error("未保存", {
            iconTheme: {
              primary: "#000",
              secondary: "#fff",
            },
          });
        });
    } else {
      toast.error("文章内容不能为空", {
        iconTheme: {
          primary: "#000",
          secondary: "#fff",
        },
      });
    }
  }
  return (
    <div className=" w-full flex flex-col items-center">
      <div onClick={addRote} className=" bg-black text-white px-4 py-6">
        Save
      </div>
      <Editor
        className=" mt-6 relative min-h-[500px] w-full max-w-screen-lg border-stone-200 bg-white sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg"
        onUpdate={(e) => {
          console.log(e?.getJSON());
          setHtmlContent(e?.getHTML());
          setJsonContent(e?.getJSON());
        }}
      />
      <article
        className=" prose lg:prose-xl m-6"
        dangerouslySetInnerHTML={{ __html: htmlContent ? htmlContent : "" }}
      ></article>
    </div>
  );
}

export default Home;
