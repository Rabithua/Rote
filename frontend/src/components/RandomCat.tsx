import { useEffect, useState } from 'react';

const URLPREFIX = 'https://r2.rote.ink/evecat/';
const TOTALCAT = 164;
const excludedNumbers = [127, 0];

export default function RandomCat() {
  const [randomCat, setRandomCat] = useState('0001');
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
  }

  //MARK:NOISY
  // const playSound = () => {
  //   const audio = new Audio(require('@/assets/voice/cat4.mp3'));
  //   audio.play();
  // };

  return (
    <div
      className="relative m-4 w-fit cursor-pointer overflow-hidden rounded-2xl duration-300 hover:scale-95"
      onClick={() => {
        getRandomInt();
        // playSound();
      }}
    >
      {isLoading && (
        <div className="bg-bgLight/90 dark:bg-bgDark/90 absolute inset-0 flex items-center justify-center py-16 backdrop:blur-xl">
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
