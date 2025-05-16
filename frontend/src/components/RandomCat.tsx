import { useEffect, useState } from 'react';

const URLPREFIX = 'https://r2.rote.ink/evecat/';
const TOTALCAT = 164;
const excludedNumbers = [127, 0];

export default function RandomCat() {
  const [randomCat, setRandomCat] = useState('0001'); // 默认值而不是null
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

    const formattedCat = random.toString().padStart(4, '0');
    setRandomCat(formattedCat);
    // 不再使用setTimeout，直接设置新的randomCat
  }

  //MARK:NOISY
  // const playSound = () => {
  //   const audio = new Audio(require('@/assets/voice/cat4.mp3'));
  //   audio.play();
  // };

  return (
    <div
      className="size-100 relative m-4 max-w-full cursor-pointer border-[3px] border-black duration-300 hover:scale-95"
      onClick={() => {
        getRandomInt();
        // playSound();
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-bgLight/90 py-16 backdrop:blur-xl dark:bg-bgDark/90">
          <img
            className="size-6 animate-spin"
            src={'https://r2.rote.ink/evecat/loading_roll.gif'}
            alt="loading"
          />
        </div>
      )}

      <img
        className="h-full w-full"
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
