import { Editor } from "novel";
import { useState } from "react";

function Home() {
  const [htmlContent, setHtmlContent] = useState<string | undefined>("");
  return (
    <div className=" w-full flex flex-col items-center">
      <h1>123</h1>
      <Editor
        className=" mt-6 relative min-h-[500px] w-full max-w-screen-lg border-stone-200 bg-white sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg"
        onUpdate={(e) => {
          setHtmlContent(e?.getHTML());
        }}
      />
      <article className=" prose lg:prose-xl" dangerouslySetInnerHTML={{ __html: htmlContent ? htmlContent : "" }}>
      </article>
    </div>
  );
}

export default Home;
