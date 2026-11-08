export const CONFIG = {
  APP_NAME: 'MMD',
  VERSION: '3.0.0',
  STORAGE_KEYS: {
    SETTINGS: 'mmd_settings_v3',
    HISTORY: 'mmd_history_v3',
  },
  DEFAULT_SETTINGS: {
    defaultFormat: 'video',
    defaultQuality: '1080',
    defaultAudioFormat: 'mp3',
    autoPaste: true,
    saveHistory: true,
  },
  PROVIDERS: {
    youtube: {
      id: 'youtube',
      name: 'YouTube',
      shortName: 'YT',
      color: '#CC5A3F',
      badgeClass: 'badge-youtube',
      icon: '▶',
      patterns: [
        /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?=.*v=([a-zA-Z0-9_-]{11}))/i,
        /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
        /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
        /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
        /^(?:https?:\/\/)?m\.youtube\.com\/watch\?(?=.*v=([a-zA-Z0-9_-]{11}))/i,
      ],
      extractId: (url) => {
        const patterns = [
          /(?:v=|\/embed\/|\/shorts\/|^youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
          /youtu\.be\/([a-zA-Z0-9_-]{11})/i,
          /[?&]v=([a-zA-Z0-9_-]{11})/i,
        ];
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match && match[1]) return match[1];
        }
        return null;
      },
      oEmbedUrl: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    },
    tiktok: {
      id: 'tiktok',
      name: 'TikTok',
      shortName: 'TT',
      color: '#00F2FE',
      badgeClass: 'badge-tiktok',
      icon: '♪',
      enabled: false,
      patterns: [/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/i],
    },
    soundcloud: {
      id: 'soundcloud',
      name: 'SoundCloud',
      shortName: 'SC',
      color: '#FF5500',
      badgeClass: 'badge-soundcloud',
      icon: '☁',
      enabled: false,
      patterns: [/^(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w.-]+\/[\w.-]+/i],
    },
    instagram: {
      id: 'instagram',
      name: 'Instagram',
      shortName: 'IG',
      color: '#E1306C',
      badgeClass: 'badge-instagram',
      icon: '📷',
      enabled: false,
      patterns: [/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+/i],
    },
  },
};
