import { useEffect, useState } from "react";

const TOTALCAT = 168;

export default function RandomCat() {
  const [randomCat, setRandomCat] = useState(1);

  useEffect(() => {
    const random = Math.floor(Math.random() * TOTALCAT);
    setRandomCat(random);
  }, []);

  const playSound = () => {
    const audio = new Audio(require("@/assets/voice/cat4.mp3"));
    audio.play();
  };

  return (
    <img
      className="size-100 max-w-full border-[3px] border-black hover:scale-95 cursor-pointer duration-300"
      src={`http://motions.cat/gif/nhn/${
        randomCat.toString().padStart(4, "0")
      }.gif`}
      alt="cat"
      onClick={() => {
        const random = Math.floor(Math.random() * TOTALCAT);
        setRandomCat(random);
        playSound();
      }}
    />
  );
}
