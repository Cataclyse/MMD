import { buildProxyUrl } from './constants.js';
import { downloadBufferParallel, triggerAnchorDownload } from './downloader.js';

export const downloadAndMux = async (videoFmt, audioFmt, filename, onProgress, onStatus) => {
  const probeSize = async (streamUrl, knownSize) => {
    if (knownSize && parseInt(knownSize, 10) > 0) return parseInt(knownSize, 10);
    try {
      const res = await fetch(buildProxyUrl(streamUrl), {
        headers: { 'Range': 'bytes=0-0' },
        signal: AbortSignal.timeout(5000),
      });
      const cr = res.headers.get('content-range');
      if (cr) {
        const p = cr.split('/');
        if (p[1]) return parseInt(p[1], 10);
      }
    } catch {}
    return 0;
  };

  if (onStatus) onStatus('Préparation des flux vidéo et audio...');
  const [vSize, aSize] = await Promise.all([
    probeSize(videoFmt.directStreamUrl || videoFmt.url, videoFmt.contentLength),
    audioFmt ? probeSize(audioFmt.directStreamUrl || audioFmt.url, audioFmt.contentLength) : 0,
  ]);

  const totalAllBytes = (vSize || 0) + (aSize || 0);
  let vDone = 0;
  let aDone = 0;
  let speed = '0 Mo/s';

  const updateCombinedProgress = () => {
    const doneTotal = vDone + aDone;
    const ratio = totalAllBytes > 0 ? Math.min(1, doneTotal / totalAllBytes) : 0;
    const doneMb = (doneTotal / (1024 * 1024)).toFixed(1);
    const totalMb = (totalAllBytes / (1024 * 1024)).toFixed(1);
    const pct = Math.round(ratio * 100);
    if (onProgress) onProgress(ratio, speed, doneMb, totalMb);
    if (onStatus) onStatus(`Téléchargement ${pct}% (${speed}) — ${doneMb}/${totalMb} Mo`);
  };

  if (onStatus) onStatus('Téléchargement vidéo HD + audio en parallèle...');

  const [vBuf, aBuf] = await Promise.all([
    downloadBufferParallel(
      videoFmt.directStreamUrl || videoFmt.url,
      vSize || 100 * 1024 * 1024,
      (r, spd, dMb, tMb, lbl, cBytes) => {
        vDone = cBytes || (parseFloat(dMb) * 1024 * 1024);
        speed = spd;
        updateCombinedProgress();
      },
      'Vidéo'
    ),
    audioFmt
      ? downloadBufferParallel(
          audioFmt.directStreamUrl || audioFmt.url,
          aSize || 10 * 1024 * 1024,
          (r, spd, dMb, tMb, lbl, cBytes) => {
            aDone = cBytes || (parseFloat(dMb) * 1024 * 1024);
            updateCombinedProgress();
          },
          'Audio'
        )
      : null,
  ]);

  if (!aBuf) {
    const blob = new Blob([vBuf], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    triggerAnchorDownload(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return;
  }

  if (onStatus) onStatus('Fusion vidéo + audio HD en cours (sans perte)...');
  try {
    const { Input, Output, Mp4OutputFormat, BufferTarget, Conversion, BufferSource, ALL_FORMATS } = await import('../vendor/mediabunny.min.mjs');

    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    });

    const videoConversion = await Conversion.init({
      input: new Input({ source: new BufferSource(vBuf), formats: ALL_FORMATS }),
      output,
      composable: true,
      audio: { discard: true },
    });

    const audioConversion = await Conversion.init({
      input: new Input({ source: new BufferSource(aBuf), formats: ALL_FORMATS }),
      output,
      composable: true,
      video: { discard: true },
    });

    await output.start();
    await Promise.all([
      videoConversion.execute(),
      audioConversion.execute(),
    ]);
    await output.finalize();

    const finalBuf = output.target.buffer;
    const finalBlob = new Blob([finalBuf], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(finalBlob);
    triggerAnchorDownload(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);

    if (onStatus) onStatus('Vidéo HD avec son prête et enregistrée !');
  } catch (muxErr) {
    console.warn('[Muxer] Échec de la fusion mediabunny, téléchargement vidéo seule:', muxErr);
    const fallbackBlob = new Blob([vBuf], { type: 'video/mp4' });
    const fallbackUrl = URL.createObjectURL(fallbackBlob);
    triggerAnchorDownload(fallbackUrl, filename);
    setTimeout(() => URL.revokeObjectURL(fallbackUrl), 120000);
    if (onStatus) onStatus('Vidéo téléchargée (fusion non supportée sur ce flux).');
  }
};
