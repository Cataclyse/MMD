import { CONFIG } from './config.js';
import { MediaParser } from './parser.js';
import { MediaAPI } from './api.js';
import { UI } from './ui.js';
import { HistoryManager } from './history.js';
import { i18n } from './i18n.js';

class MMDApp {
  constructor() {
    this.ui = new UI();
    this.settings = this.loadSettings();
  }

  async start() {
    await i18n.init();
    this.ui.init();
    this.ui.populateSettings(this.settings);
    this.bindEvents();
    this.checkClipboardOnFocus();
    this.startProxyHealthMonitor();
  }

  loadSettings() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
      if (stored) {
        return { ...CONFIG.DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Impossible de lire les réglages:', e);
    }
    return { ...CONFIG.DEFAULT_SETTINGS };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
      this.ui.showToast(i18n.t('toast.settings_saved'), 'success');
    } catch (e) {
      this.ui.showToast('Erreur sauvegarde', 'error');
    }
  }

  bindEvents() {
    const { elements } = this.ui;

    const headerLang = document.getElementById('select-header-lang');
    if (headerLang) {
      headerLang.value = i18n.currentLang;
      headerLang.addEventListener('change', async (e) => {
        await i18n.setLanguage(e.target.value);
        this.ui.renderHistory();
      });
    }

    const modalLang = document.getElementById('select-lang');
    if (modalLang) {
      modalLang.value = i18n.currentLang;
      modalLang.addEventListener('change', async (e) => {
        await i18n.setLanguage(e.target.value);
        this.ui.renderHistory();
      });
    }

    elements.urlInput.addEventListener('input', () => {
      const val = elements.urlInput.value.trim();
      elements.btnClear.classList.toggle('hidden', val.length === 0);

      const parsed = MediaParser.parse(val);
      this.ui.updateProviderBadge(parsed);
    });

    elements.btnClear.addEventListener('click', () => {
      elements.urlInput.value = '';
      elements.urlInput.dispatchEvent(new Event('input'));
      elements.urlInput.focus();
    });

    elements.btnPaste.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          this.ui.showToast('Accès au presse-papier non disponible', 'warning');
          return;
        }
        const text = await navigator.clipboard.readText();
        if (text) {
          elements.urlInput.value = text.trim();
          elements.urlInput.dispatchEvent(new Event('input'));
          this.ui.showToast(i18n.t('toast.clipboard_pasted'), 'info');
          if (MediaParser.isSupportedUrl(text)) {
            elements.urlForm.dispatchEvent(new Event('submit'));
          }
        }
      } catch (err) {
        this.ui.showToast('Veuillez utiliser Ctrl+V', 'warning');
      }
    });

    elements.urlForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAnalyze();
    });

    elements.tabVideo.addEventListener('click', () => this.ui.setFormatMode('video'));
    elements.tabAudio.addEventListener('click', () => this.ui.setFormatMode('audio'));

    elements.btnDownload.addEventListener('click', async () => {
      await this.handleDownload();
    });

    window.addEventListener('mmd:history-updated', () => {
      this.ui.renderHistory();
    });
    window.addEventListener('streamsync:history-updated', () => {
      this.ui.renderHistory();
    });
    window.addEventListener('mmd:lang-changed', () => {
      this.ui.renderHistory();
    });

    elements.btnClearHistory.addEventListener('click', () => {
      if (confirm(i18n.t('history.clear_confirm'))) {
        HistoryManager.clear();
        this.ui.showToast(i18n.t('toast.history_cleared'), 'info');
      }
    });

    elements.btnOpenSettings.addEventListener('click', () => this.ui.toggleSettingsModal(true));
    elements.btnCloseSettings.addEventListener('click', () => this.ui.toggleSettingsModal(false));

    elements.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings({
        defaultQuality: elements.selectDefaultQuality ? elements.selectDefaultQuality.value : '1080',
        defaultFormat: elements.selectDefaultFormat ? elements.selectDefaultFormat.value : 'video',
      });
      this.ui.toggleSettingsModal(false);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !elements.modalSettings.classList.contains('hidden')) {
        this.ui.toggleSettingsModal(false);
      }
    });
  }

  async checkClipboardOnFocus() {
    window.addEventListener('focus', async () => {
      if (!this.settings.autoPaste || this.ui.elements.urlInput.value.trim()) return;
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && MediaParser.isSupportedUrl(text) && !this.ui.elements.urlInput.value) {
            this.ui.elements.urlInput.value = text.trim();
            this.ui.elements.urlInput.dispatchEvent(new Event('input'));
            this.ui.showToast(i18n.t('toast.clipboard_detected'), 'info');
          }
        }
      } catch (e) {}
    });
  }

  async handleAnalyze() {
    const rawUrl = this.ui.elements.urlInput.value.trim();
    if (!rawUrl) {
      this.ui.showToast(i18n.t('toast.url_empty'), 'warning');
      this.ui.elements.urlInput.focus();
      return;
    }

    const parsed = MediaParser.parse(rawUrl);
    if (!parsed || !parsed.valid) {
      this.ui.showToast(parsed?.error || i18n.t('toast.url_invalid'), 'error');
      return;
    }

    this.ui.setLoading(true, i18n.t('status.extracting'));

    try {
      const mediaData = await MediaAPI.inspectMedia(parsed);
      this.ui.setLoading(false);
      this.ui.renderMediaInspection(mediaData);
      this.ui.showToast(i18n.t('toast.resolved'), 'success');
    } catch (err) {
      this.ui.setLoading(false);
      console.error('Erreur analyse:', err);
      this.ui.showToast(`Échec de l’analyse : ${err.message || 'Flux indisponible'}`, 'error');
    }
  }

  async handleDownload() {
    const media = this.ui.currentMedia;
    if (!media) return;

    const mode = this.ui.selectedMode;
    const quality = this.ui.selectedQuality;
    const btn = this.ui.elements.btnDownload;

    const originalText = btn.innerHTML;
    btn.disabled = true;

    const getExt = () => {
      if (mode === 'audio') {
        if (quality.includes('opus')) return 'opus';
        if (quality.includes('m4a')) return 'm4a';
        return 'mp3';
      }
      return 'mp4';
    };

    const filename = `${this.slugify(media.meta.title)}_${quality}.${getExt()}`;

    if (this.settings.saveHistory) {
      HistoryManager.addItem({
        id: media.meta.id,
        title: media.meta.title,
        author: media.meta.author,
        thumbnail: media.meta.fallbackThumbnail || media.meta.thumbnail,
        canonicalUrl: media.meta.canonicalUrl,
        provider: media.meta.provider,
        formatChosen: `${quality} ${mode === 'audio' ? 'Audio' : 'Vidéo'}`,
      });
    }

    try {
      await MediaAPI.resolveAndDownload(
        media.meta.id,
        mode,
        quality,
        media,
        filename,
        (ratio, speedStr, doneMb, totalMb) => {
          const pct = Math.round(ratio * 100);
          if (speedStr && doneMb && totalMb) {
            btn.innerHTML = `<span class="spinner-inline"></span> ${pct}% (${speedStr}) — ${doneMb}/${totalMb} Mo`;
          } else {
            btn.innerHTML = `<span class="spinner-inline"></span> Téléchargement ${pct}%...`;
          }
        },
        (statusMsg) => {
          btn.innerHTML = `<span class="spinner-inline"></span> ${statusMsg}`;
        },
        this.ui.selectedAudioTrackId,
      );

      this.ui.showToast(i18n.t('toast.download_started'), 'success');
    } catch (err) {
      console.error('[App] Erreur téléchargement:', err);
      this.ui.showToast(err.message || 'Impossible de télécharger', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  startProxyHealthMonitor() {
    const dot = document.getElementById('proxy-status-dot');
    const text = document.getElementById('proxy-status-text');
    const pill = document.getElementById('proxy-status-pill');
    if (!dot || !text) return;

    const check = async () => {
      dot.className = 'beacon-dot beacon-checking';
      if (pill) pill.classList.add('is-checking');

      try {
        const res = await fetch('https://proxie.cataclyse.xyz/health', {
          method: 'GET',
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.status === 'ok') {
            dot.className = 'beacon-dot beacon-online';
            text.textContent = i18n.t('proxy.online');
            if (pill) {
              pill.classList.remove('is-checking');
              pill.title = 'Proxy proxie.cataclyse.xyz opérationnel';
            }
            return;
          }
        }
        throw new Error('Réponse inattendue');
      } catch (err) {
        dot.className = 'beacon-dot beacon-offline';
        text.textContent = i18n.t('proxy.offline');
        if (pill) {
          pill.classList.remove('is-checking');
        }
      }
    };

    check();
    setInterval(check, 10000);
  }

  slugify(text) {
    if (!text) return 'video';
    return text
      .toString()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = new MMDApp();
  await app.start();
});
