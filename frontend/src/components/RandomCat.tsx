import { useEffect, useState } from "react";

const URLPREFIX = "https://r2.rote.ink/evecat/";
const TOTALCAT = 164;
const excludedNumbers = [127, 0];

export default function RandomCat() {
  const [randomCat, setRandomCat] = useState("0001"); // 默认值而不是null
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getRandomInt();
  }, []);

  function getRandomInt() {
    setIsLoading(true); // 先设置加载状态

    let random;
    do {
      random = Math.floor(Math.random() * TOTALCAT);
    } while (excludedNumbers.includes(random));

    const formattedCat = random.toString().padStart(4, "0");
    setRandomCat(formattedCat);
    // 不再使用setTimeout，直接设置新的randomCat
  }

  const playSound = () => {
    const audio = new Audio(require("@/assets/voice/cat4.mp3"));
    audio.play();
  };

  return (
    <div
      className="relative size-100 max-w-full border-[3px] border-black hover:scale-95 cursor-pointer duration-300"
      onClick={() => {
        getRandomInt();
        playSound();
      }}
    >
      {isLoading && (
        <div className="py-8 absolute inset-0 flex justify-center items-center bg-bgLight/90 dark:bg-bgDark/90 backdrop:blur-xl">
          <img
            className="size-6 animate-spin"
            src={"https://r2.rote.ink/evecat/loading_roll.gif"}
            alt="loading"
          />
        </div>
      )}

      <img
        className="w-full h-full"
        src={`${URLPREFIX}${randomCat}.gif`}
        alt="cat"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
        }}
      />
    </div>
  );
}
