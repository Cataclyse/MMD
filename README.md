# MMD — Multi Media Downloader

> Téléchargeur multimédia universel, 100% client-side, hébergeable sur GitHub Pages.  
> Développé par **Cataclyse**.

---

## Présentation

MMD est une application web statique permettant d'analyser, extraire et télécharger des vidéos ou pistes audio YouTube directement depuis le navigateur, sans installer d'outil en ligne de commande ni héberger de serveur dédié.

L'ensemble de l'interface et du traitement s'exécute côté client (navigateur) :
- **Extraction directe :** Résolution des flux via le client Innertube `VISIONOS` (aucune limite SABR des 25 Mo, flux 1080p, 2K, 4K et pistes audio directes).
- **Téléchargement par chunks :** Récupération séquentielle des fragments avec suivi de progression, débit en temps réel et reprise automatique.
- **Muxing dans le navigateur :** Fusion des pistes vidéo et audio séparées en un conteneur `.mp4` final via **Mediabunny** (Web Workers / WebAssembly).
- **Conversion audio MP3 :** Encodage MP3 (jusqu'à 320 kbps) exécuté localement via **lamejs**.
- **Internationalisation :** Support multilingue natif (Français, Anglais, Espagnol) avec chargement dynamique de fichiers `.lang`.
- **Historique local :** Sauvegarde persistante des téléchargements récents dans le `localStorage`.

---

## Formats supportés

| Type | Résolutions / Débits | Codecs | Conteneur |
| :--- | :--- | :--- | :--- |
| **Vidéo + Audio** | 4K (2160p), 2K (1440p), 1080p FHD, 720p HD, 480p, 360p | H.264 (AVC1), VP9, AV1 | `.mp4` |
| **Audio seul** | MP3 (320 kbps, 256 kbps, 128 kbps), M4A (AAC 128-256 kbps) | MP3 / AAC | `.mp3`, `.m4a` |

---

## Structure du projet

```text
MMD/
├── index.html            # Interface utilisateur
├── css/
│   └── style.css         # Styles de l'application
├── js/
│   ├── app.js            # Point d'entrée de l'application
│   ├── config.js         # Configuration globale
│   ├── parser.js         # Validation et extraction des identifiants vidéo
│   ├── ui.js             # Gestion du DOM, toasts et sélecteurs de qualité
│   ├── history.js        # Gestion du cache localStorage
│   ├── i18n.js           # Moteur de traduction dynamique
│   ├── youtube/
│   │   ├── constants.js  # Payloads Innertube, User-Agents et mapping itags
│   │   ├── extractor.js  # Extraction et parsing des formats VisionOS
│   │   ├── downloader.js # Gestionnaire de téléchargement par morceaux
│   │   ├── muxer.js      # Assemblage audio + vidéo (Mediabunny)
│   │   └── converter.js  # Encodage audio MP3 (lamejs)
│   └── vendor/           # Librairies client embarquées (Mediabunny, lamejs)
└── lang/
    ├── fr.lang           # Français
    ├── en.lang           # Anglais
    └── es.lang           # Espagnol
```

---

## Déploiement sur GitHub Pages

1. Forkez ou clonez ce dépôt sur votre compte GitHub.
2. Rendez-vous dans **Settings** > **Pages** de votre dépôt.
3. Sous **Source**, sélectionnez **Deploy from a branch**.
4. Choisissez la branche `main` et le dossier `/ (root)`, puis cliquez sur **Save**.
5. Votre instance est accessible sur `https://<pseudo>.github.io/<repo>/`.

Les requêtes cross-origin vers YouTube et Google Video transitent par le reverse-proxy Cloudflare configuré par défaut (`proxie.cataclyse.xyz`), assurant le contournement CORS et la compatibilité HTTPS stricte de GitHub Pages.
