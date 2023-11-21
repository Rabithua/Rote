import { Editor } from "novel";


function Home() {
    return (
      <div className=" w-full flex justify-center">
        <Editor className=" mt-6 relative min-h-[500px] w-full max-w-screen-lg border-stone-200 bg-white sm:mb-[calc(20vh)] sm:rounded-lg sm:border sm:shadow-lg" onUpdate={(e) => {
          console.log(e)
        }} />
      </div>
    );
  }
  
  export default Home;
  