import { buildProxyUrl } from '../youtube/constants.js';

export class PinterestExtractor {
  static async extract(url) {
    let resolvedUrl = url.trim();

    if (/pin\.it/i.test(resolvedUrl)) {
      try {
        const headRes = await fetch(resolvedUrl, { method: 'HEAD', redirect: 'follow' });
        if (headRes?.url && headRes.url.includes('/pin/')) {
          resolvedUrl = headRes.url;
        }
      } catch {
        try {
          const proxiedShort = buildProxyUrl(resolvedUrl);
          const pRes = await fetch(proxiedShort);
          if (pRes.ok) {
            const html = await pRes.text();
            const m = html.match(/href="([^"]*?pinterest\.[a-z.]+\/pin\/\d+[^"]*?)"/) || html.match(/https:\/\/(?:www\.)?pinterest\.[a-z.]+\/pin\/\d+/);
            if (m) resolvedUrl = m[1] || m[0];
          }
        } catch {}
      }
    }

    const pinIdMatch = resolvedUrl.match(/pin\/(\d+)/i);
    const pinId = pinIdMatch ? pinIdMatch[1] : 'pinterest';

    let oEmbedData = null;
    try {
      const oEmbedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(resolvedUrl)}`;
      const res = await fetch(oEmbedUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) oEmbedData = await res.json();
    } catch {}

    if (!oEmbedData) {
      try {
        const proxiedOembed = buildProxyUrl(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(resolvedUrl)}`);
        const res = await fetch(proxiedOembed, { signal: AbortSignal.timeout(6000) });
        if (res.ok) oEmbedData = await res.json();
      } catch {}
    }

    let pageHtml = '';
    try {
      const proxyPage = buildProxyUrl(resolvedUrl);
      const res = await fetch(proxyPage, {
        headers: {
          'X-Forward-User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) pageHtml = await res.text();
    } catch {}

    let directVideoUrl = null;
    const mp4Matches = pageHtml.match(/https:\/\/(?:v1|v)\.pinimg\.com\/videos\/[^\s"'<>]+\.mp4/g);
    if (mp4Matches && mp4Matches.length > 0) {
      directVideoUrl = mp4Matches[0];
    } else {
      const m3u8Matches = pageHtml.match(/https:\/\/(?:v1|v)\.pinimg\.com\/videos\/[^\s"'<>]+\.m3u8/g);
      if (m3u8Matches && m3u8Matches.length > 0) {
        directVideoUrl = m3u8Matches[0].replace(/\/hls\//g, '/720p/').replace(/\.m3u8/g, '.mp4');
      }
    }

    const title = oEmbedData?.title?.trim() || 'Épingle Pinterest';
    const author = oEmbedData?.author_name || 'Pinterest';
    const authorUrl = oEmbedData?.author_url || null;
    const baseThumb = oEmbedData?.thumbnail_url || '';
    const originalImage = baseThumb ? baseThumb.replace(/\/\d+x\//, '/originals/') : '';

    const videoFormats = [];
    const audioFormats = [];

    if (directVideoUrl) {
      videoFormats.push({
        id: 'mp4-720p',
        label: 'Vidéo MP4 HD (720p)',
        resolution: '720p',
        container: 'MP4',
        badge: 'HD',
        isMuxed: true,
        directStreamUrl: directVideoUrl,
        fileSize: 'MP4 HD',
        contentLength: 0,
      });

      audioFormats.push({
        id: 'audio-mp3',
        label: 'Piste audio originale (MP3)',
        ext: 'mp3',
        container: 'MP3',
        badge: 'MP3',
        quality: '320k',
        directStreamUrl: directVideoUrl,
        fileSize: '~2.5 MB',
      });
    }

    if (originalImage) {
      const imgExt = originalImage.includes('.png') ? 'png' : 'jpg';
      videoFormats.push({
        id: 'image-orig',
        label: `Image originale HD (${imgExt.toUpperCase()})`,
        resolution: 'Image HD',
        container: imgExt.toUpperCase(),
        ext: imgExt,
        badge: 'Originale',
        isMuxed: false,
        directStreamUrl: originalImage,
        fileSize: 'Image HD',
        contentLength: 0,
      });
    }

    if (videoFormats.length === 0 && audioFormats.length === 0) {
      throw new Error('Impossible d\'extraire les médias de cette épingle Pinterest.');
    }

    return {
      meta: {
        title,
        author,
        authorUrl,
        thumbnail: baseThumb || originalImage,
        fallbackThumbnail: baseThumb || originalImage,
        provider: 'Pinterest',
        type: directVideoUrl ? 'video' : 'photo',
        id: pinId,
        canonicalUrl: resolvedUrl,
      },
      formats: {
        video: videoFormats,
        audio: audioFormats,
      },
      audioTracks: [],
      hasDirectStreams: true,
      duration: directVideoUrl ? 15 : 0,
      durationFormatted: directVideoUrl ? '0:15' : '--:--',
      extractedVia: directVideoUrl ? 'pinterest-video' : 'pinterest-image',
    };
  }

  static async download(streamUrl, filename, onProgress, onStatus) {
    if (onStatus) onStatus('Démarrage du téléchargement...');
    
    let response = null;
    try {
      response = await fetch(streamUrl, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch {
      const proxied = buildProxyUrl(streamUrl, filename);
      response = await fetch(proxied);
      if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
    }

    const total = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    const startTime = Date.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;

      if (onProgress) {
        const ratio = total > 0 ? received / total : 0.5;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const spd = elapsedSec > 0.3 ? `${((received / elapsedSec) / (1024 * 1024)).toFixed(1)} Mo/s` : '';
        const dMb = (received / (1024 * 1024)).toFixed(1);
        const tMb = total > 0 ? (total / (1024 * 1024)).toFixed(1) : dMb;
        onProgress(ratio, spd, dMb, tMb);
      }
    }

    if (onStatus) onStatus('Finalisation du fichier...');
    const totalBuffer = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      totalBuffer.set(c, offset);
      offset += c.length;
    }

    let mime = 'video/mp4';
    if (filename.endsWith('.mp3')) mime = 'audio/mpeg';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (filename.endsWith('.png')) mime = 'image/png';

    const blob = new Blob([totalBuffer], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(blobUrl);
    }, 60000);

    if (onStatus) onStatus('Téléchargement terminé !');
  }
}
