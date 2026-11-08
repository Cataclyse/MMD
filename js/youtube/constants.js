export const CLOUDFLARE_WORKER_URL = 'https://proxie.cataclyse.xyz';

export const getProxyEndpoint = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.origin}/proxy`;
    }
  }
  return CLOUDFLARE_WORKER_URL;
};

export const buildProxyUrl = (targetUrl, filename = null, proxyHeaders = null, session = null) => {
  const base = getProxyEndpoint().replace(/\/+$/, '');
  let resolvedSession = session;
  if (!resolvedSession && typeof targetUrl === 'string') {
    try {
      const u = new URL(targetUrl);
      resolvedSession = u.searchParams.get('session');
    } catch {}
  }
  let url = `${base}?url=${encodeURIComponent(targetUrl)}`;
  if (filename) url += `&filename=${encodeURIComponent(filename)}`;
  if (resolvedSession) url += `&session=${encodeURIComponent(resolvedSession)}`;
  if (proxyHeaders && typeof proxyHeaders === 'object') {
    url += `&proxy_headers=${encodeURIComponent(JSON.stringify(proxyHeaders))}`;
  }
  return url;
};

export const INNERTUBE_PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

export const ANDROID_VR_UA = 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
export const VISIONOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
export const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const buildAndroidVrPayload = (videoId, visitorData = '') => {
  const client = {
    clientName: 'ANDROID_VR',
    clientVersion: '1.65.10',
    deviceMake: 'Oculus',
    deviceModel: 'Quest 3',
    androidSdkVersion: 32,
    userAgent: ANDROID_VR_UA,
    osName: 'Android',
    osVersion: '12L',
    hl: 'en',
    timeZone: 'UTC',
    utcOffsetMinutes: 0,
  };
  if (visitorData) client.visitorData = visitorData;

  return {
    context: { client },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
};

export const buildVisionOsPayload = (videoId, visitorData = '') => {
  const client = {
    clientName: 'VISIONOS',
    clientVersion: '1.02',
    osName: 'visionOS',
    osVersion: '26.5.23O471',
  };
  if (visitorData) client.visitorData = visitorData;

  return {
    context: { client },
    videoId,
  };
};

export const buildInnertubePayload = (videoId, visitorData = '') => {
  return buildVisionOsPayload(videoId, visitorData);
};

export const ITAG_MAP = {
  18:  { type: 'muxed',  container: 'mp4',  resolution: '360p',  vcodec: 'avc1',  acodec: 'mp4a', label: '360p MP4 (Muxé)', badge: 'Mobile' },
  22:  { type: 'muxed',  container: 'mp4',  resolution: '720p',  vcodec: 'avc1',  acodec: 'mp4a', label: '720p MP4 (Muxé)', badge: 'HD' },

  313: { type: 'video',  container: 'webm', resolution: '2160p', vcodec: 'vp9',   label: '4K UHD',     badge: '4K' },
  401: { type: 'video',  container: 'mp4',  resolution: '2160p', vcodec: 'av01',  label: '4K UHD AV1', badge: '4K' },

  271: { type: 'video',  container: 'webm', resolution: '1440p', vcodec: 'vp9',   label: '1440p QHD',  badge: '2K' },
  308: { type: 'video',  container: 'webm', resolution: '1440p', vcodec: 'vp9',   label: '1440p QHD 60fps', badge: '2K 60' },
  400: { type: 'video',  container: 'mp4',  resolution: '1440p', vcodec: 'av01',  label: '1440p AV1',  badge: '2K' },

  137: { type: 'video',  container: 'mp4',  resolution: '1080p', vcodec: 'avc1',  label: '1080p FHD', badge: 'FHD' },
  248: { type: 'video',  container: 'webm', resolution: '1080p', vcodec: 'vp9',   label: '1080p VP9',  badge: 'FHD' },
  299: { type: 'video',  container: 'mp4',  resolution: '1080p', vcodec: 'avc1',  label: '1080p 60fps', badge: 'FHD 60' },
  303: { type: 'video',  container: 'webm', resolution: '1080p', vcodec: 'vp9',   label: '1080p VP9 60fps', badge: 'FHD 60' },
  399: { type: 'video',  container: 'mp4',  resolution: '1080p', vcodec: 'av01',  label: '1080p AV1',  badge: 'AV1' },

  136: { type: 'video',  container: 'mp4',  resolution: '720p',  vcodec: 'avc1',  label: '720p HD',    badge: 'HD' },
  247: { type: 'video',  container: 'webm', resolution: '720p',  vcodec: 'vp9',   label: '720p VP9',   badge: 'HD' },
  298: { type: 'video',  container: 'mp4',  resolution: '720p',  vcodec: 'avc1',  label: '720p 60fps', badge: 'HD 60' },
  302: { type: 'video',  container: 'webm', resolution: '720p',  vcodec: 'vp9',   label: '720p VP9 60fps', badge: 'HD 60' },
  398: { type: 'video',  container: 'mp4',  resolution: '720p',  vcodec: 'av01',  label: '720p AV1',   badge: 'AV1' },

  135: { type: 'video',  container: 'mp4',  resolution: '480p',  vcodec: 'avc1',  label: '480p SD',    badge: 'SD' },
  244: { type: 'video',  container: 'webm', resolution: '480p',  vcodec: 'vp9',   label: '480p VP9',   badge: 'SD' },
  397: { type: 'video',  container: 'mp4',  resolution: '480p',  vcodec: 'av01',  label: '480p AV1',   badge: 'SD' },

  134: { type: 'video',  container: 'mp4',  resolution: '360p',  vcodec: 'avc1',  label: '360p',       badge: 'Mobile' },
  243: { type: 'video',  container: 'webm', resolution: '360p',  vcodec: 'vp9',   label: '360p VP9',   badge: 'Mobile' },
  396: { type: 'video',  container: 'mp4',  resolution: '360p',  vcodec: 'av01',  label: '360p AV1',   badge: 'Mobile' },

  133: { type: 'video',  container: 'mp4',  resolution: '240p',  vcodec: 'avc1',  label: '240p',       badge: 'Low' },
  242: { type: 'video',  container: 'webm', resolution: '240p',  vcodec: 'vp9',   label: '240p VP9',   badge: 'Low' },
  395: { type: 'video',  container: 'mp4',  resolution: '240p',  vcodec: 'av01',  label: '240p AV1',   badge: 'Low' },

  160: { type: 'video',  container: 'mp4',  resolution: '144p',  vcodec: 'avc1',  label: '144p',       badge: 'Low' },
  278: { type: 'video',  container: 'webm', resolution: '144p',  vcodec: 'vp9',   label: '144p VP9',   badge: 'Low' },
  394: { type: 'video',  container: 'mp4',  resolution: '144p',  vcodec: 'av01',  label: '144p AV1',   badge: 'Low' },

  141: { type: 'audio',  container: 'm4a',  acodec: 'mp4a',  bitrate: '256k', label: 'M4A 256k (AAC)',  badge: 'AAC HQ' },
  140: { type: 'audio',  container: 'm4a',  acodec: 'mp4a',  bitrate: '128k', label: 'M4A 128k (AAC)',  badge: 'AAC' },
  139: { type: 'audio',  container: 'm4a',  acodec: 'mp4a',  bitrate: '48k',  label: 'M4A 48k (AAC)',   badge: 'AAC Low' },
  251: { type: 'audio',  container: 'webm', acodec: 'opus',  bitrate: '160k', label: 'OPUS 160k',       badge: 'OPUS' },
  250: { type: 'audio',  container: 'webm', acodec: 'opus',  bitrate: '70k',  label: 'OPUS 70k',        badge: 'OPUS' },
  249: { type: 'audio',  container: 'webm', acodec: 'opus',  bitrate: '50k',  label: 'OPUS 50k',        badge: 'OPUS' },
};
