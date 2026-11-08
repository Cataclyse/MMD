export const convertToMp3 = async (audioArrayBuffer, kbps = 320, onProgress, onStatus) => {
  if (onStatus) onStatus('Décodage audio du flux source...');
  const AudioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
  if (!AudioCtx) throw new Error('AudioContext non supporté par ce navigateur.');
  const ctx = new AudioCtx();
  let audioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(audioArrayBuffer.slice(0));
  } catch (decodeErr) {
    throw new Error('Échec du décodage audio du navigateur: ' + decodeErr.message);
  } finally {
    ctx.close().catch(() => {});
  }

  if (onStatus) onStatus(`Encodage MP3 ${kbps} kbps en cours...`);
  const { Mp3Encoder } = await import('../vendor/lame.es.js');

  const numChannels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const length = audioBuffer.length;
  const leftFloat = audioBuffer.getChannelData(0);
  const rightFloat = numChannels > 1 ? audioBuffer.getChannelData(1) : leftFloat;

  const leftInt = new Int16Array(length);
  const rightInt = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const l = Math.max(-1, Math.min(1, leftFloat[i]));
    leftInt[i] = l < 0 ? l * 0x8000 : l * 0x7FFF;
    const r = Math.max(-1, Math.min(1, rightFloat[i]));
    rightInt[i] = r < 0 ? r * 0x8000 : r * 0x7FFF;
  }

  const blockSize = 1152;
  const mp3Data = [];
  const totalBlocks = Math.ceil(length / blockSize);

  for (let i = 0; i < length; i += blockSize) {
    const lChunk = leftInt.subarray(i, i + blockSize);
    const rChunk = rightInt.subarray(i, i + blockSize);
    const buf = numChannels === 1 ? encoder.encodeBuffer(lChunk) : encoder.encodeBuffer(lChunk, rChunk);
    if (buf.length > 0) mp3Data.push(buf);

    if (i % (blockSize * 50) === 0) {
      const blockIdx = Math.floor(i / blockSize);
      const pct = Math.round((blockIdx / totalBlocks) * 100);
      if (onStatus) onStatus(`Encodage MP3 ${kbps}k : ${pct}%...`);
      if (onProgress) onProgress(pct / 100);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) mp3Data.push(flush);

  if (onStatus) onStatus('Fichier MP3 prêt !');
  return new Blob(mp3Data, { type: 'audio/mp3' });
};
