export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
};

export const buildFilename = (title, ext = 'mp4') => {
  const safe = (title || 'video')
    .replace(/[^\w\s\-àâçéèêëîïôùûü]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)
    .trim();
  return `${safe || 'video'}.${ext}`;
};
