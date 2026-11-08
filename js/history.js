import { CONFIG } from './config.js';
import { i18n } from './i18n.js';

export class HistoryManager {
  static getHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Erreur lecture historique:', e);
      return [];
    }
  }

  static addItem(item) {
    if (!item || !item.id) return;
    try {
      const history = this.getHistory();
      const filtered = history.filter(h => h.id !== item.id);

      const record = {
        id: item.id,
        title: item.title || 'Média sans titre',
        author: item.author || 'Inconnu',
        thumbnail: item.thumbnail || '',
        canonicalUrl: item.canonicalUrl || '',
        provider: item.provider || 'YouTube',
        formatChosen: item.formatChosen || '1080p MP4',
        timestamp: Date.now(),
      };

      const updated = [record, ...filtered].slice(0, 40);
      localStorage.setItem(CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('mmd:history-updated', { detail: updated }));
    } catch (e) {
      console.error('Erreur ajout historique:', e);
    }
  }

  static removeItem(id) {
    try {
      const history = this.getHistory();
      const updated = history.filter(h => h.id !== id);
      localStorage.setItem(CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('mmd:history-updated', { detail: updated }));
    } catch (e) {
      console.error('Erreur suppression item historique:', e);
    }
  }

  static clear() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.HISTORY);
      window.dispatchEvent(new CustomEvent('mmd:history-updated', { detail: [] }));
    } catch (e) {
      console.error('Erreur vidage historique:', e);
    }
  }

  static formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return i18n.t('history.just_now');
    if (diffMin < 60) return i18n.t('history.min_ago', { n: diffMin });
    if (diffHours < 24) return i18n.t('history.hour_ago', { n: diffHours });
    if (diffDays === 1) return i18n.t('history.yesterday');
    return i18n.t('history.days_ago', { n: diffDays });
  }
}
