import {
  CLOUDFLARE_WORKER_URL,
  INNERTUBE_PLAYER_ENDPOINT,
  ANDROID_VR_UA,
  VISIONOS_UA,
  CHROME_UA,
  ITAG_MAP,
  buildProxyUrl,
  buildAndroidVrPayload,
  buildVisionOsPayload,
} from './constants.js';

export class YouTubeExtractorEngine {
  static async extract(videoId) {
    this._session = `s_${videoId}_${Date.now().toString(36)}`;
    const clientsToTry = [
      { name: 'visionos',   builder: buildVisionOsPayload,   clientNameHeader: '85', clientVerHeader: '1.02',    ua: VISIONOS_UA },
      { name: 'android_vr', builder: buildAndroidVrPayload, clientNameHeader: '28', clientVerHeader: '1.65.10', ua: ANDROID_VR_UA },
    ];

    let lastError = null;

    for (const c of clientsToTry) {
      try {
        const raw = await this._fetchClient(videoId, c);
        const result = this._parseResponse(raw, videoId, c.name);
        if (result?.hasDirectStreams) {
          return result;
        }
      } catch (err) {
        lastError = err;
      }
    }

    try {
      const invResult = await this._fetchInvidious(videoId);
      if (invResult?.hasDirectStreams) {
        return invResult;
      }
    } catch {}

    return this._buildFallbackFormats(videoId);
  }

  static async _fetchInvidious(videoId) {
    const urls = [
      `https://yt.chocolatemoo53.com/api/v1/videos/${videoId}`,
      buildProxyUrl(`https://yt.chocolatemoo53.com/api/v1/videos/${videoId}`),
    ];
    for (const u of urls) {
      try {
        const res = await fetch(u, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) continue;
        const data = await res.json();
        const raw = {
          streamingData: {
            formats: data.formatStreams || [],
            adaptiveFormats: (data.adaptiveFormats || []).map((f) => ({
              itag: parseInt(f.itag, 10),
              url: f.url,
              mimeType: f.type,
              bitrate: f.bitrate || 0,
              averageBitrate: f.bitrate || 0,
              contentLength: f.clen,
              height: f.resolution ? parseInt(f.resolution, 10) : undefined,
              fps: f.fps,
            })),
          },
          videoDetails: {
            title: data.title,
            author: data.author,
            lengthSeconds: data.lengthSeconds,
          },
        };
        const result = this._parseResponse(raw, videoId, 'invidious');
        if (result?.hasDirectStreams) return result;
      } catch {}
    }
    return null;
  }

  static async _getVisitorData(videoId) {
    if (this._cachedVisitorData) {
      return this._cachedVisitorData;
    }
    const extractFromHtml = (html) => {
      const allMatches = [];
      const re = /(?:VISITOR_DATA|visitorData|visitor_data)["']\s*:\s*["']([^"']+)["']/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        allMatches.push(m[1]);
      }
      if (allMatches.length > 0) {
        allMatches.sort((a, b) => b.length - a.length);
        const val = decodeURIComponent(allMatches[0]);
        if (val && val.length > 10) return val;
      }
      return '';
    };

    try {
      const embedUrl = buildProxyUrl(`https://www.youtube.com/embed/${videoId}`, null, null, this._session);
      const res = await fetch(embedUrl, {
        headers: {
          'X-Forward-User-Agent': CHROME_UA,
          'X-Forward-Referer': 'https://www.google.com/',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const text = await res.text();
        const found = extractFromHtml(text);
        if (found) {
          this._cachedVisitorData = found;
          return found;
        }
      }
    } catch {}

    try {
      const watchUrl = buildProxyUrl(`https://www.youtube.com/watch?v=${videoId}`, null, null, this._session);
      const res = await fetch(watchUrl, {
        headers: {
          'X-Forward-User-Agent': CHROME_UA,
          'X-Forward-Referer': 'https://www.google.com/',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const text = await res.text();
        const found = extractFromHtml(text);
        if (found) {
          this._cachedVisitorData = found;
          return found;
        }
      }
    } catch {}

    return '';
  }

  static async _fetchClient(videoId, clientConfig) {
    const proxyUrl = buildProxyUrl(INNERTUBE_PLAYER_ENDPOINT, null, null, this._session);
    const visitorData = await this._getVisitorData(videoId);
    const payload = clientConfig.builder(videoId, visitorData);

    const headers = {
      'Content-Type': 'application/json',
      'X-Forward-User-Agent': clientConfig.ua,
      'X-Forward-Origin': 'https://www.youtube.com',
      'X-Forward-Referer': 'https://www.youtube.com/',
      'X-YouTube-Client-Name': clientConfig.clientNameHeader,
      'X-YouTube-Client-Version': clientConfig.clientVerHeader,
    };
    if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Réponse inattendue (HTTP ${response.status})`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data?.error?.message || 'Erreur API'}`);
    }

    if (!data.streamingData) {
      const status = data?.playabilityStatus?.status || 'INCONNU';
      const reason = data?.playabilityStatus?.reason || '';
      throw new Error(`Innertube: ${status}${reason ? ' - ' + reason : ''}`);
    }

    return data;
  }

  static _parseResponse(raw, videoId, clientName = 'unknown') {
    const { streamingData, videoDetails } = raw;
    if (!streamingData) return null;

    const duration = parseInt(videoDetails?.lengthSeconds || 0, 10);
    const title = videoDetails?.title || `YouTube ${videoId}`;
    const author = videoDetails?.author || 'YouTube';

    const allFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptiveFormats || []),
    ];

    const videoFormats = [];
    const audioFormats = [];

    for (const fmt of allFormats) {
      if (!fmt.url) continue;
      let meta = ITAG_MAP[fmt.itag];

      if (!meta && fmt.height) {
        const h = fmt.height;
        const res = `${h}p`;
        let badge = 'SD';
        if (h >= 2160) badge = '4K';
        else if (h >= 1440) badge = '2K';
        else if (h >= 1080) badge = 'FHD';
        else if (h >= 720) badge = 'HD';
        const isMp4 = (fmt.mimeType || '').includes('mp4');

        meta = {
          type: 'video',
          container: isMp4 ? 'mp4' : 'webm',
          resolution: res,
          vcodec: isMp4 ? 'avc1' : 'vp9',
          label: `${res} ${badge}`,
          badge,
        };
      }

      if (!meta) continue;

      let streamUrl = fmt.url;
      if (this._session && !streamUrl.includes('session=')) {
        streamUrl += (streamUrl.includes('?') ? '&' : '?') + 'session=' + encodeURIComponent(this._session);
      }

      const baseItem = {
        itag: fmt.itag,
        url: streamUrl,
        mimeType: fmt.mimeType || '',
        bitrate: fmt.bitrate || 0,
        contentLength: fmt.contentLength ? parseInt(fmt.contentLength, 10) : null,
        isMuxed: meta.type === 'muxed',
        container: meta.container,
        label: meta.label,
        badge: meta.badge,
      };

      if (meta.type === 'video' || meta.type === 'muxed') {
        const height = fmt.height || parseInt(meta.resolution, 10);
        videoFormats.push({
          ...baseItem,
          id: meta.resolution.replace('p', ''),
          resolution: meta.resolution,
          height,
          fps: fmt.fps || 30,
          vcodec: meta.vcodec,
        });
      }

      if (meta.type === 'audio') {
        const audioTrack = fmt.audioTrack || null;
        const isAutoDubbed = audioTrack ? (audioTrack.isAutoDubbed === true) : false;
        const isOriginal = audioTrack
          ? (audioTrack.audioIsDefault === true || /original/i.test(audioTrack.displayName || ''))
          : true;

        audioFormats.push({
          ...baseItem,
          id: `audio-${meta.container}`,
          ext: meta.container,
          acodec: meta.acodec,
          audioBitrate: fmt.averageBitrate || fmt.bitrate || 0,
          audioSampleRate: fmt.audioSampleRate ? parseInt(fmt.audioSampleRate, 10) : 44100,
          audioChannels: fmt.audioChannels || 2,
          audioTrack,
          isOriginal,
          isAutoDubbed,
          trackName: audioTrack?.displayName || '',
        });
      }
    }

    const bestVideo = this._deduplicateByResolution(videoFormats);
    const bestAudio = this._deduplicateByExt(audioFormats);

    bestVideo.sort((a, b) => (b.height || 0) - (a.height || 0));
    bestAudio.sort((a, b) => {
      const order = ['m4a', 'opus', 'webm'];
      return order.indexOf(a.ext) - order.indexOf(b.ext);
    });

    const tracksMap = new Map();
    for (const f of raw.streamingData?.adaptiveFormats || []) {
      if (!(f.mimeType || '').startsWith('audio/')) continue;
      const at = f.audioTrack || null;
      const trackId = at?.id || 'original';
      let track = tracksMap.get(trackId);
      if (!track) {
        const isAutoDubbed = at ? (at.isAutoDubbed === true) : false;
        const isOriginal = at ? (at.audioIsDefault === true || /original/i.test(at.displayName || '')) : true;
        let label = at?.displayName || 'Original';
        track = {
          id: trackId,
          displayName: label,
          isOriginal,
          isAutoDubbed,
          formats: {},
        };
        tracksMap.set(trackId, track);
      }
      const ext = f.mimeType.includes('mp4') ? 'm4a' : 'webm';
      const currentFmt = track.formats[ext];
      if (!currentFmt || (f.averageBitrate || f.bitrate || 0) > (currentFmt.averageBitrate || currentFmt.bitrate || 0)) {
        track.formats[ext] = {
          itag: f.itag,
          url: f.url,
          directStreamUrl: f.url,
          mimeType: f.mimeType,
          bitrate: f.bitrate || 0,
          contentLength: f.contentLength ? parseInt(f.contentLength, 10) : null,
          ext,
          container: ext,
        };
      }
    }

    const audioTracks = Array.from(tracksMap.values()).sort((a, b) => {
      if (a.isOriginal && !b.isOriginal) return -1;
      if (!a.isOriginal && b.isOriginal) return 1;
      if (!a.isAutoDubbed && b.isAutoDubbed) return -1;
      if (a.isAutoDubbed && !b.isAutoDubbed) return 1;
      return 0;
    });

    return {
      formats: { video: bestVideo, audio: bestAudio },
      audioTracks,
      duration,
      title,
      author,
      hasDirectStreams: bestVideo.length > 0 || bestAudio.length > 0,
      extractedVia: `innertube-${clientName}`,
    };
  }

  static _deduplicateByResolution(formats) {
    const byResolution = new Map();
    for (const fmt of formats) {
      const key = fmt.resolution || (fmt.height + 'p');
      const existing = byResolution.get(key);
      if (!existing) {
        byResolution.set(key, fmt);
      } else {
        const preferNew = (
          (fmt.container === 'mp4' && existing.container !== 'mp4') ||
          (!fmt.isMuxed && existing.isMuxed && fmt.bitrate > existing.bitrate * 1.1) ||
          (fmt.container === existing.container && fmt.bitrate > existing.bitrate)
        );
        if (preferNew) byResolution.set(key, fmt);
      }
    }
    return Array.from(byResolution.values());
  }

  static _deduplicateByExt(formats) {
    const byExt = new Map();
    for (const fmt of formats) {
      const existing = byExt.get(fmt.ext);
      if (!existing) {
        byExt.set(fmt.ext, fmt);
        continue;
      }

      if (!fmt.isAutoDubbed && existing.isAutoDubbed) {
        byExt.set(fmt.ext, fmt);
        continue;
      }
      if (fmt.isAutoDubbed && !existing.isAutoDubbed) {
        continue;
      }

      if (fmt.isOriginal && !existing.isOriginal) {
        byExt.set(fmt.ext, fmt);
        continue;
      }
      if (!fmt.isOriginal && existing.isOriginal) {
        continue;
      }

      if (fmt.audioBitrate > existing.audioBitrate) {
        byExt.set(fmt.ext, fmt);
      }
    }
    return Array.from(byExt.values());
  }

  static _buildFallbackFormats(videoId) {
    return {
      formats: { video: [], audio: [] },
      duration: 0,
      title: null,
      author: null,
      hasDirectStreams: false,
      extractedVia: 'failed',
    };
  }
}
