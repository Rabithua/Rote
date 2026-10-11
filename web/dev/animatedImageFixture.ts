// A two-frame looping GIF for the local preview. Each pixel resets the tiny LZW
// dictionary, keeping the fixture encoder independent of production media code.
export function animatedImageFixture() {
  const bytes = [
    ...Buffer.from('GIF89a'),
    4,
    0,
    4,
    0,
    0x80,
    0,
    0,
    66,
    97,
    88,
    140,
    181,
    165,
    0x21,
    0xff,
    11,
    ...Buffer.from('NETSCAPE2.0'),
    3,
    1,
    0,
    0,
    0,
  ];
  for (const color of [0, 1]) {
    bytes.push(0x21, 0xf9, 4, 0, 50, 0, 0, 0, 0x2c, 0, 0, 0, 0, 4, 0, 4, 0, 0, 2);
    let bits = 0;
    let bitCount = 0;
    const data: number[] = [];
    const code = (value: number) => {
      bits |= value << bitCount;
      bitCount += 3;
      while (bitCount >= 8) {
        data.push(bits & 255);
        bits >>= 8;
        bitCount -= 8;
      }
    };
    for (let pixel = 0; pixel < 16; pixel++) {
      code(4);
      code(color);
    }
    code(5);
    if (bitCount) data.push(bits);
    bytes.push(data.length, ...data, 0);
  }
  return Buffer.from([...bytes, 0x3b]);
}
