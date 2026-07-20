import { parentPort } from 'node:worker_threads';
import { encodeHeicToJpegInProcess } from './heicBrowserCoverCodec';

const workerPort = parentPort;
if (!workerPort) {
  throw new Error('HEIC browser cover worker requires a parent port');
}

workerPort.once('message', async (input: Uint8Array) => {
  try {
    const bytes = await encodeHeicToJpegInProcess(input);
    workerPort.postMessage({ bytes, ok: true });
  } catch (error) {
    workerPort.postMessage({
      error: error instanceof Error ? error.message : String(error),
      ok: false,
    });
  }
});
