import { buildProxyUrl } from '../youtube/constants.js';

export class TikTokExtractor {
  static async extract(url) {
    let rawData = null;
    let via = 'direct';

    try {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.code === 0 && json.data) {
          rawData = json.data;
          via = 'tikwm-direct';
        }
      }
    } catch {}

    if (!rawData) {
      try {
        const proxyApiUrl = buildProxyUrl(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const res = await fetch(proxyApiUrl, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.code === 0 && json.data) {
            rawData = json.data;
            via = 'tikwm-proxy';
          }
        }
      } catch {}
    }

    if (!rawData) {
      try {
        const htmlUrl = buildProxyUrl(url);
        const res = await fetch(htmlUrl, {
          headers: {
            'X-Forward-User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const text = await res.text();
          const m = text.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
          if (m) {
            const parsed = JSON.parse(m[1]);
            const item = parsed['__DEFAULT_SCOPE__']?.['webapp.video-detail']?.itemInfo?.itemStruct;
            if (item) {
              rawData = {
                title: item.desc || 'TikTok Video',
                author: {
                  nickname: item.author?.nickname || 'TikTok User',
                  unique_id: item.author?.uniqueId || '',
                },
                cover: item.video?.cover || '',
                duration: item.video?.duration || 0,
                play: item.video?.playAddr || '',
                music: item.music?.playUrl || '',
                size: 0,
              };
              via = 'tiktok-html';
            }
          }
        }
      } catch {}
    }

    if (!rawData) {
      throw new Error('Impossible d\'extraire les flux de cette vidéo TikTok.');
    }

    return this._formatResponse(rawData, url, via);
  }

  static _formatResponse(data, originalUrl, via) {
    const videoFormats = [];
    const audioFormats = [];

    const duration = data.duration || 0;
    const sizeStr = data.size ? this.formatFileSize(data.size) : 'HD';

    if (data.hdplay) {
      videoFormats.push({
        id: 'hd',
        label: 'Sans filigrane HD',
        resolution: '1080p',
        container: 'MP4',
        badge: 'HD',
        isMuxed: true,
        directStreamUrl: data.hdplay,
        fileSize: sizeStr,
        contentLength: data.size || 0,
      });
    }

    if (data.play) {
      videoFormats.push({
        id: 'nowm',
        label: 'Sans filigrane MP4',
        resolution: '720p',
        container: 'MP4',
        badge: 'Sans filigrane',
        isMuxed: true,
        directStreamUrl: data.play,
        fileSize: sizeStr,
        contentLength: data.size || 0,
      });
    }

    if (data.wmplay) {
      videoFormats.push({
        id: 'wm',
        label: 'Avec filigrane original',
        resolution: '720p',
        container: 'MP4',
        badge: 'Original',
        isMuxed: true,
        directStreamUrl: data.wmplay,
        fileSize: sizeStr,
        contentLength: data.size || 0,
      });
    }

    if (Array.isArray(data.images) && data.images.length > 0) {
      data.images.forEach((imgUrl, idx) => {
        const ext = imgUrl.includes('.png') ? 'png' : 'jpg';
        videoFormats.push({
          id: `image-${idx + 1}`,
          label: `Image ${idx + 1} (${ext.toUpperCase()})`,
          resolution: 'Image HD',
          container: ext.toUpperCase(),
          ext,
          badge: `Photo ${idx + 1}`,
          isMuxed: false,
          directStreamUrl: imgUrl,
          fileSize: `${ext.toUpperCase()} HD`,
          contentLength: 0,
        });
      });
    }

    if (data.music) {
      audioFormats.push({
        id: 'audio-mp3',
        label: data.music_info?.title ? `Audio: ${data.music_info.title}` : 'Audio original (MP3)',
        ext: 'mp3',
        container: 'MP3',
        badge: 'MP3',
        quality: '320k',
        directStreamUrl: data.music,
        fileSize: '~' + ((duration * 192000) / (8 * 1024 * 1024)).toFixed(1) + ' MB',
      });
    }

    const authorDisplay = data.author?.nickname 
      ? (data.author.unique_id ? `${data.author.nickname} (@${data.author.unique_id})` : data.author.nickname)
      : 'TikTok';

    const isOnlyPhoto = Array.isArray(data.images) && data.images.length > 0 && !data.play && !data.hdplay;

    return {
      meta: {
        title: data.title || 'Vidéo TikTok',
        author: authorDisplay,
        authorUrl: data.author?.unique_id ? `https://www.tiktok.com/@${data.author.unique_id}` : null,
        thumbnail: data.cover || (Array.isArray(data.images) ? data.images[0] : ''),
        fallbackThumbnail: data.origin_cover || data.cover || '',
        provider: 'TikTok',
        type: isOnlyPhoto ? 'photo' : 'video',
        id: data.id || 'tiktok',
        canonicalUrl: originalUrl,
      },
      formats: {
        video: videoFormats,
        audio: audioFormats,
      },
      audioTracks: [],
      hasDirectStreams: videoFormats.length > 0 || audioFormats.length > 0,
      duration,
      durationFormatted: this.formatDuration(duration),
      extractedVia: via,
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

    const mime = filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4';
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

  static formatDuration(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
    const s = Math.floor(totalSeconds);
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  static formatFileSize(bytes) {
    const b = parseInt(bytes, 10);
    if (!b || isNaN(b) || b <= 0) return 'HD';
    const mb = b / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  }
}
