// apps/poc/sherpa-stt/wer-test-indian.mjs
import sherpa_onnx from 'sherpa-onnx-node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_DIR = path.join(__dirname, '../../../packages/backend/stt-engine/sherpa-onnx-streaming-zipformer-indian-en');

function createRecognizer() {
  return new sherpa_onnx.OnlineRecognizer({
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      transducer: {
        encoder: path.join(MODEL_DIR, 'encoder-epoch-10-avg-5-chunk-64-left-256.int8.onnx'),
        decoder: path.join(MODEL_DIR, 'decoder-epoch-10-avg-5-chunk-64-left-256.int8.onnx'),
        joiner: path.join(MODEL_DIR, 'joiner-epoch-10-avg-5-chunk-64-left-256.int8.onnx'),
      },
      tokens: path.join(MODEL_DIR, 'tokens.txt'),
      numThreads: 8,
      provider: 'cpu',
    },
    decodingMethod: 'greedy_search',
  });
}

function readWav(filePath) {
  const buf = fs.readFileSync(filePath);
  const sampleRate = buf.readUInt32LE(24);
  const numChannels = buf.readUInt16LE(22);
  const bitsPerSample = buf.readUInt16LE(34);

  let offset = 12;
  let dataOffset = -1, dataLength = 0;
  while (offset < buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'data') { dataOffset = offset + 8; dataLength = chunkSize; break; }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (dataOffset === -1) throw new Error(`No data chunk found in ${filePath}`);

  const numSamples = dataLength / (bitsPerSample / 8) / numChannels;
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const sampleOffset = dataOffset + i * numChannels * (bitsPerSample / 8);
    samples[i] = buf.readInt16LE(sampleOffset) / 32768;
  }
  return { sampleRate, samples };
}

function transcribeFile(recognizer, wavPath) {
  const { sampleRate, samples } = readWav(wavPath);
  const stream = recognizer.createStream();
  stream.acceptWaveform({ samples, sampleRate });
  stream.inputFinished();
  while (recognizer.isReady(stream)) recognizer.decode(stream);
  return recognizer.getResult(stream).text.trim().toLowerCase();
}

function wer(ref, hyp) {
  const r = ref.split(/\s+/), h = hyp.split(/\s+/);
  const d = Array.from({ length: r.length + 1 }, (_, i) =>
    Array.from({ length: h.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = r[i - 1] === h[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
  return d[r.length][h.length] / r.length;
}

const transLines = fs.readFileSync(path.join(MODEL_DIR, 'test_wavs/trans.txt'), 'utf8')
  .split('\n').filter(Boolean);

let totalWords = 0, totalErrors = 0;
const recognizer = createRecognizer();

for (const line of transLines) {
  const [file, ...refWords] = line.trim().split(/\s+/);
  const ref = refWords.join(' ').toLowerCase();
  const hyp = transcribeFile(recognizer, path.join(MODEL_DIR, 'test_wavs', `${file}`));
  const e = wer(ref, hyp) * ref.split(/\s+/).length;
  totalWords += ref.split(/\s+/).length;
  totalErrors += e;
  console.log(`${file}\n  ref: ${ref}\n  hyp: ${hyp}\n  WER: ${(wer(ref, hyp) * 100).toFixed(1)}%\n`);
}
console.log(`\nOverall WER: ${((totalErrors / totalWords) * 100).toFixed(2)}%`);