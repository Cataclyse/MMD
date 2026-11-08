const FALLBACK_TRANSLATIONS = {
  fr: {
    "app.title": "MMD — Multi Media Downloader (by Cataclyse)",
    "app.tagline": "Multi Media Downloader",
    "app.by": "by Cataclyse",
    "proxy.online": "Proxy actif",
    "proxy.checking": "Relais proxy...",
    "proxy.offline": "Proxy hors ligne",
    "hero.label": "VOS MÉDIAS, À VOTRE FAÇON",
    "hero.title": "Tous vos médias. Un seul endroit.",
    "hero.subtitle": "Analysez et téléchargez vos contenus préférés dans la qualité que vous méritez.",
    "url.badge_default": "Lien",
    "url.placeholder": "Collez un lien multimédia pour commencer…",
    "url.paste": "Coller",
    "url.clear": "Effacer",
    "url.analyze": "Analyser le média",
    "status.extracting": "Extraction des métadonnées du flux...",
    "status.analyzing": "Analyse du flux vidéo...",
    "tabs.video": "Vidéo et audio (MP4)",
    "tabs.audio": "Audio seul (MP3 / M4A)",
    "options.audio_track": "Piste audio",
    "options.quality": "Résolution et qualité de sortie",
    "telemetry.default": "Format sélectionné : Conteneur MP4, résolution 1080p, codec H.264 / AAC",
    "action.download": "Télécharger le fichier",
    "history.title": "Téléchargements récents",
    "history.clear": "Effacer l'historique",
    "history.clear_confirm": "Voulez-vous vraiment effacer tout votre historique de téléchargements ?",
    "history.empty": "Aucun téléchargement récent pour le moment.",
    "history.just_now": "À l'instant",
    "history.min_ago": "Il y a {n} min",
    "history.hour_ago": "Il y a {n} h",
    "history.yesterday": "Hier",
    "history.days_ago": "Il y a {n} j",
    "settings.title": "Préférences de téléchargement",
    "settings.lang_label": "Langue de l'interface",
    "settings.quality_label": "Résolution vidéo par défaut",
    "settings.quality_hint": "Résolution présélectionnée automatiquement lors de l'analyse.",
    "settings.format_label": "Format de sortie par défaut",
    "settings.format_hint": "Bascule automatiquement l'onglet actif au chargement d'un média.",
    "settings.save": "Enregistrer les préférences",
    "toast.url_empty": "Veuillez coller un lien avant de lancer l’analyse",
    "toast.url_invalid": "URL invalide ou non supportée",
    "toast.resolved": "Flux résolu et prêt au téléchargement",
    "toast.download_started": "Téléchargement démarré avec succès",
    "toast.clipboard_detected": "Lien YouTube détecté dans le presse-papier",
    "toast.clipboard_pasted": "Lien collé depuis le presse-papier",
    "toast.history_cleared": "Historique effacé",
    "toast.settings_saved": "Préférences enregistrées avec succès"
  }
};

class I18nManager {
  constructor() {
    this.currentLang = 'fr';
    this.dictionaries = { ...FALLBACK_TRANSLATIONS };
    this.supportedLangs = ['fr', 'en', 'es'];
  }

  detectInitialLanguage() {
    const saved = localStorage.getItem('mmd_lang');
    if (saved && this.supportedLangs.includes(saved)) {
      return saved;
    }
    const navLang = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    if (this.supportedLangs.includes(navLang)) {
      return navLang;
    }
    return 'fr';
  }

  async init() {
    this.currentLang = this.detectInitialLanguage();
    await this.loadLanguage(this.currentLang);
    this.applyToDOM();
  }

  async loadLanguage(lang) {
    if (!this.supportedLangs.includes(lang)) lang = 'fr';
    if (this.dictionaries[lang] && Object.keys(this.dictionaries[lang]).length > 10) {
      return this.dictionaries[lang];
    }

    try {
      const res = await fetch(`./lang/${lang}.lang?v=1.0`);
      if (res.ok) {
        const text = await res.text();
        let dict = {};
        if (text.trim().startsWith('{')) {
          dict = JSON.parse(text);
        } else {
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              dict[k] = v;
            }
          }
        }
        this.dictionaries[lang] = { ...(this.dictionaries.fr || {}), ...dict };
      }
    } catch (e) {
      console.warn(`[i18n] Impossible de charger ./lang/${lang}.lang:`, e.message);
      if (!this.dictionaries[lang]) {
        this.dictionaries[lang] = this.dictionaries.fr || {};
      }
    }

    return this.dictionaries[lang];
  }

  async setLanguage(lang) {
    if (!this.supportedLangs.includes(lang)) return;
    this.currentLang = lang;
    localStorage.setItem('mmd_lang', lang);
    await this.loadLanguage(lang);
    this.applyToDOM();
    window.dispatchEvent(new CustomEvent('mmd:lang-changed', { detail: { lang } }));
  }

  t(key, params = {}) {
    const dict = this.dictionaries[this.currentLang] || this.dictionaries.fr || {};
    let text = dict[key] || (this.dictionaries.fr ? this.dictionaries.fr[key] : null) || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return text;
  }

  applyToDOM() {
    document.documentElement.lang = this.currentLang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = this.t(key);
      const span = el.querySelector('span');
      if (span && el.children.length > 0 && el.querySelector('svg')) {
        span.textContent = val;
      } else {
        el.textContent = val;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });

    const langSelect = document.getElementById('select-lang');
    if (langSelect) langSelect.value = this.currentLang;
    const headerLangSelect = document.getElementById('select-header-lang');
    if (headerLangSelect) headerLangSelect.value = this.currentLang;
  }
}

export const i18n = new I18nManager();
