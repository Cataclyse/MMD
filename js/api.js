import { CONFIG } from './config.js';
import { YouTubeExtractor } from './youtube/index.js';
import { TikTokExtractor } from './tiktok/extractor.js';

export class MediaAPI {
  static async fetchQuickMetadata(parsed) {
    if (parsed.providerKey === 'tiktok') {
      try {
        const oEmbedUrl = CONFIG.PROVIDERS.tiktok.oEmbedUrl(parsed.cleanUrl);
        const res = await fetch(oEmbedUrl);
        if (res.ok) {
          const data = await res.json();
          return {
            title: data.title || 'Vidéo TikTok',
            author: data.author_name || 'TikTok',
            authorUrl: data.author_url || null,
            thumbnail: data.thumbnail_url || '',
            fallbackThumbnail: data.thumbnail_url || '',
            provider: 'TikTok',
            type: 'video',
            id: parsed.mediaId || 'tiktok',
            canonicalUrl: parsed.cleanUrl,
          };
        }
      } catch {}
      return {
        title: 'Vidéo TikTok',
        author: 'TikTok',
        authorUrl: null,
        thumbnail: '',
        fallbackThumbnail: '',
        provider: 'TikTok',
        type: 'video',
        id: parsed.mediaId || 'tiktok',
        canonicalUrl: parsed.cleanUrl,
      };
    }

    if (parsed.providerKey !== 'youtube') {
      throw new Error('Fournisseur non supporté actuellement.');
    }

    const videoId = parsed.mediaId;
    const canonicalUrl = parsed.canonicalUrl || `https://www.youtube.com/watch?v=${videoId}`;

    try {
      const oEmbedUrl = CONFIG.PROVIDERS.youtube.oEmbedUrl(canonicalUrl);
      const res = await fetch(oEmbedUrl);
      if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
      const data = await res.json();

      return {
        title: data.title || `Vidéo YouTube (${videoId})`,
        author: data.author_name || 'YouTube',
        authorUrl: data.author_url || null,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        fallbackThumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        provider: 'YouTube',
        type: parsed.type || 'video',
        id: videoId,
        canonicalUrl,
      };
    } catch (err) {
      console.warn('[MediaAPI] oEmbed échoué — métadonnées minimales:', err.message);
      return {
        title: `Vidéo YouTube (${videoId})`,
        author: 'YouTube',
        authorUrl: null,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        fallbackThumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        provider: 'YouTube',
        type: parsed.type || 'video',
        id: videoId,
        canonicalUrl,
      };
    }
  }

  static async inspectMedia(parsed) {
    if (parsed.providerKey === 'tiktok') {
      return await TikTokExtractor.extract(parsed.cleanUrl);
    }

    const [meta, extraction] = await Promise.all([
      this.fetchQuickMetadata(parsed),
      YouTubeExtractor.extract(parsed.mediaId),
    ]);

    if (extraction.hasDirectStreams) {
      return this._buildSuccessResponse(meta, extraction);
    }

    console.warn('[MediaAPI] Extraction directe indisponible — formats en mode dégradé.');
    return this._buildDegradedResponse(meta, parsed.mediaId, extraction.extractionErrors, extraction.needsWorker);
  }

  static _buildSuccessResponse(meta, extraction) {
    const { formats, duration } = extraction;

    const videoFormats = formats.video.map((fmt) => ({
      id: fmt.id || fmt.resolution?.replace('p', '') || 'unknown',
      label: fmt.label,
      resolution: fmt.resolution,
      container: fmt.container?.toUpperCase() || 'MP4',
      badge: fmt.badge,
      isMuxed: fmt.isMuxed || false,
      directStreamUrl: fmt.url,
      fileSize: YouTubeExtractor.formatFileSize(fmt.contentLength),
      contentLength: fmt.contentLength,
      itag: fmt.itag,
    }));

    const audioFormats = [
      {
        id: 'audio-mp3-320',
        label: 'MP3 320 kbps',
        ext: 'mp3',
        container: 'MP3',
        badge: 'MP3 HQ',
        quality: '320k',
        fileSize: '~' + ((duration * 320000) / (8 * 1024 * 1024)).toFixed(1) + ' MB',
      },
      {
        id: 'audio-mp3-192',
        label: 'MP3 192 kbps',
        ext: 'mp3',
        container: 'MP3',
        badge: 'MP3',
        quality: '192k',
        fileSize: '~' + ((duration * 192000) / (8 * 1024 * 1024)).toFixed(1) + ' MB',
      },
      {
        id: 'audio-m4a',
        label: 'M4A 128 kbps',
        ext: 'm4a',
        container: 'M4A',
        badge: 'AAC (Natif)',
        quality: '128k',
        fileSize: YouTubeExtractor.formatFileSize(extraction.formats?.audio?.find((a) => a.ext === 'm4a')?.contentLength),
      },
      {
        id: 'audio-opus',
        label: 'OPUS 160 kbps',
        ext: 'opus',
        container: 'WEBM',
        badge: 'OPUS',
        quality: '160k',
        fileSize: YouTubeExtractor.formatFileSize(extraction.formats?.audio?.find((a) => a.ext === 'opus' || a.ext === 'webm')?.contentLength),
      },
    ];

    return {
      meta,
      formats: { video: videoFormats, audio: audioFormats },
      audioTracks: extraction.audioTracks || [],
      hasDirectStreams: true,
      duration,
      durationFormatted: YouTubeExtractor.formatDuration(duration),
      extractedVia: extraction.extractedVia,
    };
  }

  static _buildDegradedResponse(meta, videoId, errors = [], needsWorker = false) {
    const videoFormats = [
      { id: '2160', label: '4K UHD',        resolution: '2160p', container: 'MP4', badge: '4K',     directStreamUrl: null },
      { id: '1440', label: '1440p QHD',     resolution: '1440p', container: 'MP4', badge: '2K',     directStreamUrl: null },
      { id: '1080', label: '1080p Full HD', resolution: '1080p', container: 'MP4', badge: 'FHD',    directStreamUrl: null },
      { id: '720',  label: '720p HD',       resolution: '720p',  container: 'MP4', badge: 'HD',     directStreamUrl: null },
      { id: '480',  label: '480p Standard', resolution: '480p',  container: 'MP4', badge: 'SD',     directStreamUrl: null },
      { id: '360',  label: '360p Mobile',   resolution: '360p',  container: 'MP4', badge: 'Mobile', directStreamUrl: null },
    ];

    const audioFormats = [
      { id: 'audio-m4a',  label: 'Audio M4A (AAC)',  ext: 'm4a',  container: 'M4A',  badge: 'AAC',  directStreamUrl: null },
      { id: 'audio-opus', label: 'Audio OPUS',        ext: 'opus', container: 'WEBM', badge: 'OPUS', directStreamUrl: null },
    ];

    return {
      meta,
      formats: { video: videoFormats, audio: audioFormats },
      audioTracks: [],
      hasDirectStreams: false,
      duration: 0,
      durationFormatted: '--:--',
      extractedVia: 'fallback',
      extractionErrors: errors,
      needsWorker: !YouTubeExtractor.getWorkerUrl(),
    };
  }

  static async resolveAndDownload(videoId, mode, quality, mediaObj, filename, onProgress, onStatus, selectedTrackId = null) {
    let currentMedia = mediaObj;

    if (currentMedia?.meta?.provider === 'TikTok') {
      const list = mode === 'audio'
        ? (currentMedia.formats?.audio || [])
        : (currentMedia.formats?.video || []);
      const chosen = list.find((f) => f.id === quality) || list[0];
      const streamUrl = chosen?.directStreamUrl || chosen?.url;
      if (!streamUrl) throw new Error('Flux TikTok direct introuvable.');
      await TikTokExtractor.download(streamUrl, filename, onProgress, onStatus);
      return;
    }

    const hasAnyDirect = (
      currentMedia?.formats?.video?.some((v) => v.directStreamUrl || v.url) ||
      currentMedia?.formats?.audio?.some((a) => a.directStreamUrl || a.url)
    );

    if (!hasAnyDirect) {
      if (onStatus) onStatus('Récupération du flux en direct...');
      const fresh = await YouTubeExtractor.extract(videoId);
      if (fresh.hasDirectStreams) {
        currentMedia = this._buildSuccessResponse(currentMedia.meta, fresh);
      }
    }

    const audioTracks = currentMedia?.audioTracks || [];
    const chosenTrack = audioTracks.find((t) => t.id === selectedTrackId) || audioTracks[0];

    if (mode === 'audio') {
      const isMp3 = quality.includes('mp3');
      const kbps = quality.includes('320') ? 320 : 192;

      if (isMp3) {
        const sourceFmt = chosenTrack?.formats?.m4a || chosenTrack?.formats?.webm || currentMedia?.formats?.audio?.find((a) => a.ext === 'm4a');
        if (!sourceFmt?.url && !sourceFmt?.directStreamUrl) {
          throw new Error('Flux audio source introuvable pour la conversion MP3.');
        }

        const streamUrl = sourceFmt.directStreamUrl || sourceFmt.url;
        const totalBytes = sourceFmt.contentLength || (10 * 1024 * 1024);

        if (onStatus) onStatus('Téléchargement du flux audio...');
        const aacBuf = await YouTubeExtractor._downloadBufferParallel(
          streamUrl,
          totalBytes,
          (r, spd, dMb, tMb) => {
            if (onProgress) onProgress(r * 0.4, spd, dMb, tMb);
            if (onStatus) onStatus(`Téléchargement audio ${Math.round(r * 40)}% (${spd})...`);
          },
          'Audio'
        );

        if (onStatus) onStatus(`Conversion vers MP3 ${kbps}k en cours...`);
        const mp3Blob = await YouTubeExtractor.convertToMp3(
          aacBuf,
          kbps,
          (pct) => {
            if (onProgress) onProgress(0.4 + (pct * 0.6));
          },
          onStatus
        );

        const blobUrl = URL.createObjectURL(mp3Blob);
        YouTubeExtractor._triggerAnchorDownload(blobUrl, filename);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
        if (onStatus) onStatus('Fichier MP3 téléchargé avec succès !');
        return;
      }

      const isOpus = quality.includes('opus');
      const targetFmt = isOpus
        ? (chosenTrack?.formats?.webm)
        : (chosenTrack?.formats?.m4a);

      const streamUrl = targetFmt?.directStreamUrl || targetFmt?.url;
      if (!streamUrl) throw new Error('Flux audio direct indisponible.');

      await YouTubeExtractor.downloadWithFallback(
        streamUrl,
        filename,
        onProgress,
        onStatus,
        targetFmt.contentLength
      );
      return;
    }

    const videoList = currentMedia?.formats?.video || [];
    const chosenVideo = videoList.find((f) => f.id === quality) || videoList[0];

    if (!chosenVideo?.directStreamUrl && !chosenVideo?.url) {
      throw new Error('Flux vidéo direct introuvable.');
    }

    if (chosenVideo.isMuxed) {
      await YouTubeExtractor.downloadWithFallback(
        chosenVideo.directStreamUrl || chosenVideo.url,
        filename,
        onProgress,
        onStatus,
        chosenVideo.contentLength
      );
      return;
    }

    const audioFmt = chosenTrack?.formats?.m4a || chosenTrack?.formats?.webm;
    if (!audioFmt) {
      throw new Error('Piste audio introuvable pour la fusion.');
    }

    await YouTubeExtractor.downloadAndMux(
      chosenVideo,
      audioFmt,
      filename,
      onProgress,
      onStatus
    );
  }

  static getDownloadUrl(videoId, mode, quality) {
    return {
      videoId,
      mode,
      quality,
      primaryUrl: null,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  static triggerBrowserDownload(url, filename = 'video.mp4') {
    if (!url) {
      console.warn('[MediaAPI] triggerBrowserDownload appelé sans URL');
      return;
    }
    YouTubeExtractor._triggerAnchorDownload(url, filename);
  }
}
