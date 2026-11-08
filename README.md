# StreamSync ⚡ — 100% Front-End Media Downloader

Extracteur et téléchargeur de médias haute fidélité pour **YouTube**, conçu pour être **100% statique (front-end pur)**, sans aucun serveur ni backend personnel à installer ou héberger. Prêt pour un déploiement direct sur **GitHub Pages**.

---

## 🔒 100% Front-End • Zéro Backend Requis

- **Aucun serveur Node.js, Python ou Docker à déployer** : Tout le code s'exécute directement dans le navigateur du visiteur.
- **Prêt pour GitHub Pages** : Fichiers statiques HTML, CSS et JavaScript ES6 natifs.
- **Aucune clé API obligatoire** : Récupération instantanée des métadonnées (titre, chaîne, miniature HD) via oEmbed YouTube autorisé par CORS.
- **Résolution décentralisée** :
  1. *Moteur Automatique* : Tente la résolution directe des flux via des instances publiques Invidious & Cobalt.
  2. *Passerelles 1-Clic intégrées* : Si les APIs publiques sont limitées, des passerelles web sécurisées (SaveFrom, Cobalt Web) préremplissent le lien en un clic.

---

## ✨ Fonctionnalités

- **Prise en charge YouTube complète** :
  - Liens standards (`youtube.com/watch?v=...`)
  - Liens courts (`youtu.be/...`)
  - YouTube Shorts (`youtube.com/shorts/...`)
  - Liens mobiles (`m.youtube.com/...`)
- **Inspection en direct** :
  - Aperçu miniature, titre de la vidéo, chaîne et calcul de la durée.
- **Choix des formats** :
  - **Vidéo + Audio (MP4)** : 1080p (Full HD), 720p (HD), 480p, 360p.
  - **Audio seul** : MP3 (320 kbps), M4A (256 kbps), OPUS (160 kbps).
- **Historique local interactif** :
  - Mémorisation locale sécurisée (`localStorage`) des vidéos analysées.
  - Rechargement en un clic ou suppression unitaire / globale.
- **Conçu pour être étendu** :
  - Architecture modulaire prête à accueillir TikTok, SoundCloud, Instagram, etc.

---

## 🏗️ Architecture JavaScript Modulaire

```text
MMD/
├── index.html            # Structure HTML5 sémantique et accessible
├── README.md             # Guide d'utilisation et déploiement
├── css/
│   └── style.css         # Design system (thème Studio Carbon & Signal Orange, skill frontend-design)
└── js/
    ├── config.js         # Constantes, instances d'APIs et configuration des plateformes
    ├── parser.js         # Détection d'URL, extraction d'ID YouTube et formats
    ├── api.js            # Résolution des flux (oEmbed direct CORS, Invidious, Cobalt)
    ├── history.js        # Gestionnaire de l'historique local (localStorage)
    ├── ui.js             # Rendu du DOM, deck d'inspection, chips de qualité et toasts
    └── app.js            # Orchestrateur central et gestionnaire des événements
```

---

## 🚀 Déploiement en 1 minute sur GitHub Pages

1. **Pousser les fichiers sur votre dépôt GitHub** :
   ```bash
   git add .
   git commit -m "feat: site telechargeur youtube 100% front-end"
   git push origin main
   ```

2. **Activer GitHub Pages** :
   - Ouvrez votre dépôt sur GitHub et allez dans **Settings**.
   - Cliquez sur l'onglet **Pages** (dans la colonne de gauche).
   - Sous **Build and deployment** > **Source**, choisissez **Deploy from a branch**.
   - Sélectionnez la branche `main` et le dossier `/ (root)`.
   - Cliquez sur **Save**.

Votre site est immédiatement en ligne à l'adresse :  
`https://<votre-pseudo>.github.io/<nom-du-repo>/`

---

## 🎨 Direction Artistique & Design System

Conçu selon l'identité visuelle éditoriale d'**Anthropic** (`anthropic.com`) via le skill `frontend-design` :
- **Atmosphère Éditoriale Chaleureuse** : Toile de fond écru/crème chaud (`#F5F4EF`), surfaces de cartes blanc pur (`#FFFFFF`), encres charbon profond (`#191919`) et accents signature terre cuite / terracotta (`#CC5A3F`).
- **Typographie Littéraire & Humaniste** : `Newsreader` (serif élégant et aéré pour les grands titres) associé à `Plus Jakarta Sans` pour les commandes et libellés d'interface.
- **Minimalisme & Épure** : Séparateurs en filets fins (`#E5E3DC`), boutons discrets et suppression des bruits visuels génériques d'IA (zéro néon, zéro carte SaaS sombre stéréotypée).
- **Accessibilité & Micro-interactions** : Navigation clavier complète (`:focus-visible`), toasts ARIA polis et respect des préférences de mouvement réduit (`prefers-reduced-motion`).
