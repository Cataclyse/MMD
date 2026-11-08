import { MediaParser } from './parser.js';
import { HistoryManager } from './history.js';

export class UI {
  constructor() {
    this.elements = {};
    this.selectedMode = 'video';
    this.selectedQuality = '1080';
    this.currentMedia = null;
    this.availableFormats = null;
  }

  init() {
    this.elements = {
      urlForm: document.getElementById('url-form'),
      urlInput: document.getElementById('url-input'),
      btnPaste: document.getElementById('btn-paste'),
      btnClear: document.getElementById('btn-clear'),
      btnSubmit: document.getElementById('btn-submit'),
      providerBadge: document.getElementById('provider-badge'),

      inspectSection: document.getElementById('inspect-section'),
      thumbImg: document.getElementById('media-thumb'),
      mediaTitle: document.getElementById('media-title'),
      mediaAuthor: document.getElementById('media-author'),
      mediaDuration: document.getElementById('media-duration'),
      mediaIdBadge: document.getElementById('media-id-badge'),
      mediaProviderBadge: document.getElementById('media-provider-badge'),

      tabVideo: document.getElementById('tab-video'),
      tabAudio: document.getElementById('tab-audio'),
      audioTrackGroup: document.getElementById('audio-track-group'),
      audioTrackOptions: document.getElementById('audio-track-options'),
      qualityOptionsContainer: document.getElementById('quality-options'),
      btnDownload: document.getElementById('btn-download'),
      telemetryNotice: document.getElementById('telemetry-notice'),
      btnGatewaySavefrom: document.getElementById('btn-gateway-savefrom'),
      btnGatewayCobalt: document.getElementById('btn-gateway-cobalt'),
      btnCopyUrl: document.getElementById('btn-copy-url'),

      stateContainer: document.getElementById('status-container'),
      spinner: document.getElementById('loading-spinner'),
      statusText: document.getElementById('status-text'),

      historyList: document.getElementById('history-list'),
      historyCount: document.getElementById('history-count'),
      btnClearHistory: document.getElementById('btn-clear-history'),
      emptyHistoryState: document.getElementById('empty-history'),

      modalSettings: document.getElementById('modal-settings'),
      btnOpenSettings: document.getElementById('btn-open-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      settingsForm: document.getElementById('settings-form'),
      selectDefaultQuality: document.getElementById('select-default-quality'),
      selectDefaultFormat: document.getElementById('select-default-format'),

      toastContainer: document.getElementById('toast-container'),
    };

    this.renderHistory();
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
      <span class="toast-indicator"></span>
      <span class="toast-message">${message}</span>
    `;

    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-enter');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  updateProviderBadge(parsed) {
    const badge = this.elements.providerBadge;
    if (!parsed || !parsed.valid) {
      badge.className = 'provider-badge provider-badge-idle';
      badge.textContent = 'Lien';
      return;
    }

    badge.className = `provider-badge ${parsed.badgeClass || ''} provider-badge-active`;
    badge.textContent = parsed.providerShort || parsed.providerName;
  }

  setLoading(isLoading, message = 'Analyse du flux vidéo...') {
    const { btnSubmit, stateContainer, statusText, urlInput } = this.elements;

    if (isLoading) {
      btnSubmit.disabled = true;
      urlInput.disabled = true;
      btnSubmit.classList.add('btn-loading');
      stateContainer.classList.remove('hidden');
      statusText.textContent = message;
    } else {
      btnSubmit.disabled = false;
      urlInput.disabled = false;
      btnSubmit.classList.remove('btn-loading');
      stateContainer.classList.add('hidden');
    }
  }

  renderMediaInspection(mediaData) {
    this.currentMedia = mediaData;
    this.availableFormats = mediaData.formats;

    const {
      inspectSection,
      thumbImg,
      mediaTitle,
      mediaAuthor,
      mediaDuration,
      mediaIdBadge,
      mediaProviderBadge,
    } = this.elements;

    mediaTitle.textContent = mediaData.meta.title;
    mediaAuthor.textContent = mediaData.meta.author;
    mediaIdBadge.textContent = `ID: ${mediaData.meta.id}`;
    if (mediaProviderBadge) {
      mediaProviderBadge.textContent = mediaData.meta.provider || 'Média';
    }

    thumbImg.src = mediaData.meta.thumbnail;
    thumbImg.onerror = () => {
      thumbImg.src = mediaData.meta.fallbackThumbnail;
    };

    if (mediaData.duration) {
      mediaDuration.textContent = MediaParser.formatDuration(mediaData.duration);
      mediaDuration.classList.remove('hidden');
    } else {
      mediaDuration.classList.add('hidden');
    }

    inspectSection.classList.remove('hidden');
    inspectSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    this.availableAudioTracks = mediaData.audioTracks || [];
    this.selectedAudioTrackId = this.availableAudioTracks[0]?.id || 'original';
    this.renderAudioTrackChips();
    this.renderQualityChips();
  }

  renderAudioTrackChips() {
    const { audioTrackGroup, audioTrackOptions } = this.elements;
    if (!audioTrackGroup || !audioTrackOptions) return;

    const tracks = this.availableAudioTracks || [];
    if (tracks.length <= 1) {
      audioTrackGroup.classList.add('hidden');
      return;
    }

    audioTrackGroup.classList.remove('hidden');
    audioTrackOptions.innerHTML = '';

    tracks.forEach((track) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `quality-chip ${this.selectedAudioTrackId === track.id ? 'chip-active' : ''}`;

      const badgeText = track.isOriginal ? 'Original' : (track.isAutoDubbed ? 'Doublage IA' : 'Audio');
      chip.innerHTML = `
        <span class="chip-label">${track.displayName}</span>
        <span class="chip-badge">${badgeText}</span>
      `;

      chip.addEventListener('click', () => {
        this.selectedAudioTrackId = track.id;
        this.renderAudioTrackChips();
        this.renderQualityChips();
      });

      audioTrackOptions.appendChild(chip);
    });
  }

  setFormatMode(mode) {
    this.selectedMode = mode;
    const { tabVideo, tabAudio } = this.elements;

    if (mode === 'video') {
      tabVideo.classList.add('active');
      tabAudio.classList.remove('active');
      this.selectedQuality = '1080';
    } else {
      tabAudio.classList.add('active');
      tabVideo.classList.remove('active');
      this.selectedQuality = 'audio-mp3-320';
    }

    this.renderAudioTrackChips();
    this.renderQualityChips();
  }

  renderQualityChips() {
    const container = this.elements.qualityOptionsContainer;
    container.innerHTML = '';

    if (!this.availableFormats) return;

    const list = this.selectedMode === 'video' 
      ? this.availableFormats.video 
      : this.availableFormats.audio;

    list.forEach((item) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `quality-chip ${this.selectedQuality === item.id ? 'chip-active' : ''}`;
      
      const badgeHtml = item.badge 
        ? `<span class="chip-badge">${item.badge}</span>` 
        : (item.quality ? `<span class="chip-badge">${item.quality}</span>` : '');

      chip.innerHTML = `
        <span class="chip-label">${item.label}</span>
        ${badgeHtml}
      `;

      chip.addEventListener('click', () => {
        this.selectedQuality = item.id;
        this.renderQualityChips();
        this.updateTelemetry(item);
      });

      container.appendChild(chip);
    });

    const activeItem = list.find(i => i.id === this.selectedQuality) || list[0];
    this.updateTelemetry(activeItem);
  }

  updateTelemetry(item) {
    const notice = this.elements.telemetryNotice;
    if (!item) {
      notice.textContent = '';
      return;
    }

    const currentTrack = (this.availableAudioTracks || []).find(t => t.id === this.selectedAudioTrackId) || this.availableAudioTracks?.[0];
    const trackLabel = currentTrack ? ` • Piste : ${currentTrack.displayName}` : '';

    if (this.selectedMode === 'video') {
      notice.textContent = `Format sélectionné : Conteneur MP4, résolution ${item.resolution || item.label}, codec H.264 / AAC${trackLabel}`;
    } else {
      notice.textContent = `Format sélectionné : Fichier audio ${item.ext.toUpperCase()} (${item.quality || item.label})${trackLabel}`;
    }
  }

  renderHistory() {
    const history = HistoryManager.getHistory();
    const { historyList, historyCount, emptyHistoryState } = this.elements;

    historyCount.textContent = history.length;

    if (history.length === 0) {
      historyList.innerHTML = '';
      emptyHistoryState.classList.remove('hidden');
      return;
    }

    emptyHistoryState.classList.add('hidden');
    historyList.innerHTML = '';

    history.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'history-card';
      card.innerHTML = `
        <div class="history-thumb-wrap">
          <img src="${item.thumbnail}" alt="" class="history-thumb" loading="lazy">
          <span class="history-provider-tag">${item.provider}</span>
        </div>
        <div class="history-info">
          <h4 class="history-title" title="${item.title}">${item.title}</h4>
          <p class="history-meta">${item.author} • <span class="history-time">${HistoryManager.formatRelativeTime(item.timestamp)}</span></p>
        </div>
        <div class="history-actions">
          <button type="button" class="btn-icon btn-history-reload" title="Recharger ce lien" data-url="${item.canonicalUrl}">
            ↺
          </button>
          <button type="button" class="btn-icon btn-history-del" title="Supprimer de l'historique" data-id="${item.id}">
            ×
          </button>
        </div>
      `;

      card.querySelector('.btn-history-reload').addEventListener('click', () => {
        this.elements.urlInput.value = item.canonicalUrl;
        this.elements.urlInput.dispatchEvent(new Event('input'));
        this.elements.btnSubmit.click();
      });

      card.querySelector('.btn-history-del').addEventListener('click', (e) => {
        e.stopPropagation();
        HistoryManager.removeItem(item.id);
      });

      historyList.appendChild(card);
    });
  }

  populateSettings(settings) {
    if (this.elements.selectDefaultQuality) {
      this.elements.selectDefaultQuality.value = settings.defaultQuality || '1080';
    }
    if (this.elements.selectDefaultFormat) {
      this.elements.selectDefaultFormat.value = settings.defaultFormat || 'video';
    }
  }

  toggleSettingsModal(open) {
    if (open) {
      this.elements.modalSettings.classList.remove('hidden');
      this.elements.modalSettings.setAttribute('aria-hidden', 'false');
    } else {
      this.elements.modalSettings.classList.add('hidden');
      this.elements.modalSettings.setAttribute('aria-hidden', 'true');
    }
  }
}
