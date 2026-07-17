declare module 'heic-decode' {
  type DecodeInput = {
    buffer: ArrayBuffer | Uint8Array;
  };

  type DecodedImage = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  function decode(input: DecodeInput): Promise<DecodedImage>;

  export = decode;
}
