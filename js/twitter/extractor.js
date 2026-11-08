import { buildProxyUrl } from '../youtube/constants.js';

export class TwitterExtractor {
  static async extract(url, mediaId = null) {
    let statusId = mediaId;
    if (!statusId) {
      const m = url.match(/status(?:es)?\/(\d+)/i);
      statusId = m ? m[1] : null;
    }
    if (!statusId) {
      throw new Error('Identifiant du post X (Twitter) introuvable.');
    }

    const sources = [
      {
        url: `https://api.vxtwitter.com/Twitter/status/${statusId}`,
        parser: (d) => this._parseVx(d, url, statusId),
      },
      {
        url: `https://api.fxtwitter.com/status/${statusId}`,
        headers: { 'User-Agent': 'MMD/3.0' },
        parser: (d) => this._parseFx(d, url, statusId),
      },
      {
        url: buildProxyUrl(`https://api.vxtwitter.com/Twitter/status/${statusId}`),
        parser: (d) => this._parseVx(d, url, statusId),
      },
      {
        url: buildProxyUrl(`https://api.fxtwitter.com/status/${statusId}`),
        parser: (d) => this._parseFx(d, url, statusId),
      },
    ];

    for (const src of sources) {
      try {
        const res = await fetch(src.url, {
          headers: src.headers || {},
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.startsWith('{')) continue;
        const json = JSON.parse(text);
        const parsed = src.parser(json);
        if (parsed && (parsed.formats.video.length > 0 || parsed.formats.audio.length > 0)) {
          return parsed;
        }
      } catch {}
    }

    throw new Error('Aucune vidéo trouvée sur ce post X (Twitter) ou le contenu est privé.');
  }

  static _parseVx(data, originalUrl, statusId) {
    if (!data || (!data.tweetID && !data.conversationID && !data.text)) return null;

    const mediaList = data.media_extended || [];
    const videoItems = mediaList.filter((m) => m.type === 'video' || m.type === 'gif');

    if (videoItems.length === 0 && Array.isArray(data.mediaURLs)) {
      for (const u of data.mediaURLs) {
        if (typeof u === 'string' && u.includes('.mp4')) {
          videoItems.push({ type: 'video', url: u });
        }
      }
    }

    if (videoItems.length === 0) return null;

    const durationSec = Math.round((videoItems[0].duration_millis || videoItems[0].duration || 0) / 1000);
    const videoFormats = [];
    const audioFormats = [];

    videoItems.forEach((v, idx) => {
      const h = v.size?.height || 720;
      const resLabel = h >= 1080 ? '1080p Full HD' : (h >= 720 ? '720p HD' : `${h}p SD`);
      const badge = h >= 1080 ? 'FHD' : (h >= 720 ? 'HD' : 'SD');

      videoFormats.push({
        id: `mp4-${h}-${idx}`,
        label: `Vidéo MP4 (${resLabel})`,
        resolution: `${h}p`,
        container: 'MP4',
        badge,
        isMuxed: true,
        directStreamUrl: v.url,
        fileSize: 'MP4 HD',
        contentLength: 0,
      });

      if (idx === 0) {
        audioFormats.push({
          id: 'audio-mp3',
          label: 'Piste audio originale (MP3)',
          ext: 'mp3',
          container: 'MP3',
          badge: 'MP3',
          quality: '320k',
          directStreamUrl: v.url,
          fileSize: durationSec > 0 ? '~' + ((durationSec * 192000) / (8 * 1024 * 1024)).toFixed(1) + ' MB' : 'Audio',
        });
      }
    });

    const authorName = data.user_name || 'X User';
    const authorHandle = data.user_screen_name ? `@${data.user_screen_name}` : '';
    const authorDisplay = authorHandle ? `${authorName} (${authorHandle})` : authorName;

    return {
      meta: {
        title: data.text || 'Post X (Twitter)',
        author: authorDisplay,
        authorUrl: data.user_screen_name ? `https://x.com/${data.user_screen_name}` : null,
        thumbnail: videoItems[0].thumbnail_url || data.user_profile_image_url || '',
        fallbackThumbnail: data.user_profile_image_url || '',
        provider: 'X (Twitter)',
        type: 'video',
        id: statusId,
        canonicalUrl: originalUrl,
      },
      formats: {
        video: videoFormats,
        audio: audioFormats,
      },
      audioTracks: [],
      hasDirectStreams: true,
      duration: durationSec,
      durationFormatted: this.formatDuration(durationSec),
      extractedVia: 'x-vxtwitter',
    };
  }

  static _parseFx(data, originalUrl, statusId) {
    if (!data || data.code !== 200 || !data.tweet) return null;
    const tweet = data.tweet;
    const videos = tweet.media?.videos || [];
    if (videos.length === 0) return null;

    const v0 = videos[0];
    const durationSec = Math.round(v0.duration || 0);
    const videoFormats = [];
    const audioFormats = [];

    const variants = (v0.variants || []).filter((v) => (v.content_type || '').includes('mp4') || (v.url || '').includes('.mp4'));
    if (variants.length > 0) {
      variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      variants.forEach((v, idx) => {
        const br = v.bitrate || 0;
        let badge = 'HD';
        let resLabel = '720p HD';
        if (br > 1500000) { badge = 'FHD'; resLabel = '1080p Full HD'; }
        else if (br < 500000) { badge = 'SD'; resLabel = '480p SD'; }

        videoFormats.push({
          id: `mp4-${idx}`,
          label: `Vidéo MP4 (${resLabel})`,
          resolution: badge === 'FHD' ? '1080p' : '720p',
          container: 'MP4',
          badge,
          isMuxed: true,
          directStreamUrl: v.url,
          fileSize: 'MP4 HD',
          contentLength: 0,
        });
      });
    } else if (v0.url) {
      videoFormats.push({
        id: 'mp4-direct',
        label: 'Vidéo MP4 (Originale)',
        resolution: '720p',
        container: 'MP4',
        badge: 'MP4',
        isMuxed: true,
        directStreamUrl: v0.url,
        fileSize: 'MP4 HD',
        contentLength: 0,
      });
    }

    const streamUrl = videoFormats[0]?.directStreamUrl;
    if (streamUrl) {
      audioFormats.push({
        id: 'audio-mp3',
        label: 'Piste audio originale (MP3)',
        ext: 'mp3',
        container: 'MP3',
        badge: 'MP3',
        quality: '320k',
        directStreamUrl: streamUrl,
        fileSize: durationSec > 0 ? '~' + ((durationSec * 192000) / (8 * 1024 * 1024)).toFixed(1) + ' MB' : 'Audio',
      });
    }

    const authorName = tweet.author?.name || 'X User';
    const authorHandle = tweet.author?.screen_name ? `@${tweet.author.screen_name}` : '';
    const authorDisplay = authorHandle ? `${authorName} (${authorHandle})` : authorName;

    return {
      meta: {
        title: tweet.text || 'Post X (Twitter)',
        author: authorDisplay,
        authorUrl: tweet.author?.screen_name ? `https://x.com/${tweet.author.screen_name}` : null,
        thumbnail: v0.thumbnail_url || tweet.author?.avatar_url || '',
        fallbackThumbnail: tweet.author?.avatar_url || '',
        provider: 'X (Twitter)',
        type: 'video',
        id: statusId,
        canonicalUrl: originalUrl,
      },
      formats: {
        video: videoFormats,
        audio: audioFormats,
      },
      audioTracks: [],
      hasDirectStreams: true,
      duration: durationSec,
      durationFormatted: this.formatDuration(durationSec),
      extractedVia: 'x-fxtwitter',
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
}
