import { CONFIG } from './config.js';

export class MediaParser {
  static parse(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    const cleanUrl = rawInput.trim();

    for (const [key, provider] of Object.entries(CONFIG.PROVIDERS)) {
      for (const pattern of provider.patterns) {
        if (pattern.test(cleanUrl)) {
          const mediaId = provider.extractId ? provider.extractId(cleanUrl) : null;
          return {
            valid: true,
            providerKey: key,
            providerName: provider.name,
            providerShort: provider.shortName,
            providerColor: provider.color,
            providerIcon: provider.icon,
            badgeClass: provider.badgeClass,
            mediaId,
            cleanUrl,
            canonicalUrl: key === 'youtube' && mediaId 
              ? `https://www.youtube.com/watch?v=${mediaId}` 
              : cleanUrl,
            type: cleanUrl.includes('/shorts/') ? 'short' : 'video',
          };
        }
      }
    }

    return {
      valid: false,
      error: "Ce format d'URL n'est pas encore pris en charge. Pour l'instant, collez un lien YouTube valide (ex: youtube.com/watch?v=... ou youtu.be/...)."
    };
  }

  static isYouTubeUrl(text) {
    if (!text) return false;
    return /(?:youtube\.com|youtu\.be)/i.test(text);
  }

  static formatDuration(totalSeconds) {
    if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
    const s = Math.floor(totalSeconds);
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const pad = (n) => (n < 10 ? `0${n}` : n);

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  }

  static formatBytes(bytes) {
    const b = parseInt(bytes, 10);
    if (!b || isNaN(b) || b <= 0) return 'Taille inconnue';
    const units = ['o', 'Ko', 'Mo', 'Go'];
    let idx = 0;
    let size = b;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx++;
    }
    return `${size.toFixed(1)} ${units[idx]}`;
  }
}
