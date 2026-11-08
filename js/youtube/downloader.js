import { buildProxyUrl } from './constants.js';

export const getProxiedDownloadUrl = (streamUrl, filename = null) => {
  return buildProxyUrl(streamUrl, filename);
};

export const triggerAnchorDownload = (href, filename) => {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = href;
  a.download = filename || 'video.mp4';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 2000);
};

export const downloadBufferStream = async (streamUrl, totalBytes, onProgress, label = '') => {
  const proxyBase = buildProxyUrl(streamUrl);
  const res = await fetch(proxyBase, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentLengthHeader = res.headers.get('content-length');
  const expectedBytes = totalBytes || (contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0);
  const reader = res.body.getReader();

  const chunks = [];
  let completedBytes = 0;
  const startTime = Date.now();
  let lastTime = startTime;
  let lastBytes = 0;
  let currentSpeedStr = '0 Mo/s';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    completedBytes += value.byteLength;

    const now = Date.now();
    if (now - lastTime >= 300) {
      const timeDiff = (now - lastTime) / 1000;
      const bytesDiff = completedBytes - lastBytes;
      const speedMbs = timeDiff > 0 ? (bytesDiff / (1024 * 1024)) / timeDiff : 0;
      currentSpeedStr = `${speedMbs.toFixed(1)} Mo/s`;
      lastTime = now;
      lastBytes = completedBytes;
    }

    if (onProgress) {
      const total = expectedBytes > 0 ? expectedBytes : completedBytes;
      const ratio = expectedBytes > 0 ? Math.min(1, completedBytes / expectedBytes) : 0.5;
      const doneMb = (completedBytes / (1024 * 1024)).toFixed(1);
      const totalMb = expectedBytes > 0 ? (expectedBytes / (1024 * 1024)).toFixed(1) : doneMb;
      onProgress(ratio, currentSpeedStr, doneMb, totalMb, label, completedBytes);
    }
  }

  const merged = new Uint8Array(completedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
};

const downloadBufferMultiChunk = async (streamUrl, totalBytes, onProgress, label = '') => {
  const proxyBase = buildProxyUrl(streamUrl);
  const CHUNK_SIZE = totalBytes > 150 * 1024 * 1024
    ? (8 * 1024 * 1024)
    : (totalBytes > 40 * 1024 * 1024 ? (6 * 1024 * 1024) : (4 * 1024 * 1024));
  const numChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  const concurrency = Math.min(6, Math.max(2, numChunks));

  const merged = new Uint8Array(totalBytes);
  let completedBytes = 0;
  const startTime = Date.now();
  let lastTime = startTime;
  let lastBytes = 0;
  let currentSpeedStr = '0 Mo/s';

  const queue = Array.from({ length: numChunks }, (_, i) => i);

  const downloadChunk = async (chunkIndex) => {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(((chunkIndex + 1) * CHUNK_SIZE) - 1, totalBytes - 1);

    let attempts = 0;
    while (attempts < 3) {
      try {
        const res = await fetch(proxyBase, {
          headers: { 'Range': `bytes=${start}-${end}` },
          signal: AbortSignal.timeout(45000),
        });
        if (!res.ok && res.status !== 206) {
          throw new Error(`HTTP ${res.status}`);
        }
        const buf = await res.arrayBuffer();
        merged.set(new Uint8Array(buf), start);
        completedBytes += buf.byteLength;

        const now = Date.now();
        if (now - lastTime >= 300) {
          const timeDiff = (now - lastTime) / 1000;
          const bytesDiff = completedBytes - lastBytes;
          const speedMbs = timeDiff > 0 ? (bytesDiff / (1024 * 1024)) / timeDiff : 0;
          currentSpeedStr = `${speedMbs.toFixed(1)} Mo/s`;
          lastTime = now;
          lastBytes = completedBytes;
        }

        if (onProgress) {
          const ratio = Math.min(1, completedBytes / totalBytes);
          const doneMb = (completedBytes / (1024 * 1024)).toFixed(1);
          const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
          onProgress(ratio, currentSpeedStr, doneMb, totalMb, label, completedBytes);
        }
        return;
      } catch (err) {
        attempts++;
        if (attempts >= 3) throw err;
        await new Promise((r) => setTimeout(r, 500 * attempts));
      }
    }
  };

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const idx = queue.shift();
      await downloadChunk(idx);
    }
  });

  await Promise.all(workers);
  return merged.buffer;
};

export const downloadBufferParallel = async (streamUrl, totalBytes, onProgress, label = '') => {
  return await downloadBufferMultiChunk(streamUrl, totalBytes, onProgress, label);
};

export const downloadParallel = async (streamUrl, filename, contentLength, onProgress, onStatus) => {
  const proxyBase = buildProxyUrl(streamUrl);

  let totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
  if (!totalBytes || totalBytes <= 0) {
    if (onStatus) onStatus('Vérification de la taille du flux...');
    try {
      const probe = await fetch(proxyBase, {
        headers: { 'Range': 'bytes=0-0' },
        signal: AbortSignal.timeout(5000),
      });
      const cr = probe.headers.get('content-range');
      if (cr) {
        const parts = cr.split('/');
        if (parts[1]) totalBytes = parseInt(parts[1], 10);
      }
    } catch {}
  }

  if (!totalBytes || totalBytes <= 0) {
    if (onStatus) onStatus('Téléchargement direct lancé...');
    triggerAnchorDownload(buildProxyUrl(streamUrl, filename), filename);
    if (onProgress) onProgress(1, 'Terminé', '0', '0');
    return;
  }

  if (onStatus) onStatus('Téléchargement haute vitesse...');
  const buf = await downloadBufferParallel(streamUrl, totalBytes, onProgress);

  if (onStatus) onStatus('Finalisation du fichier...');
  const ext = filename.split('.').pop() || 'mp4';
  const mime = ext === 'webm' ? 'video/webm' : (ext === 'm4a' ? 'audio/mp4' : (ext === 'mp3' ? 'audio/mp3' : 'video/mp4'));
  const finalBlob = new Blob([buf], { type: mime });
  const blobUrl = URL.createObjectURL(finalBlob);

  triggerAnchorDownload(blobUrl, filename);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);

  if (onStatus) onStatus('Téléchargement terminé avec succès !');
};

export const downloadWithFallback = async (streamUrl, filename, onProgress, onStatus, contentLength = null) => {
  try {
    await downloadParallel(streamUrl, filename, contentLength, onProgress, onStatus);
  } catch {
    if (onStatus) onStatus('Repli sur le téléchargement direct...');
    const proxiedUrl = getProxiedDownloadUrl(streamUrl, filename);
    triggerAnchorDownload(proxiedUrl, filename);
    if (onStatus) onStatus('Téléchargement direct lancé !');
  }
};
