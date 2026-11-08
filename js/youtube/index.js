import { CLOUDFLARE_WORKER_URL, buildProxyUrl, ITAG_MAP } from './constants.js';
import { YouTubeExtractorEngine } from './extractor.js';
import {
  downloadBufferParallel,
  downloadParallel,
  downloadWithFallback,
  triggerAnchorDownload,
  getProxiedDownloadUrl,
} from './downloader.js';
import { downloadAndMux } from './muxer.js';
import { convertToMp3 } from './converter.js';
import { formatDuration, formatFileSize, buildFilename } from './utils.js';

export {
  CLOUDFLARE_WORKER_URL,
  buildProxyUrl,
  ITAG_MAP,
  YouTubeExtractorEngine,
  downloadBufferParallel,
  downloadParallel,
  downloadWithFallback,
  triggerAnchorDownload,
  getProxiedDownloadUrl,
  downloadAndMux,
  convertToMp3,
  formatDuration,
  formatFileSize,
  buildFilename,
};

export class YouTubeExtractor {
  static extract(videoId) {
    return YouTubeExtractorEngine.extract(videoId);
  }

  static getProxiedDownloadUrl(streamUrl, filename) {
    return getProxiedDownloadUrl(streamUrl, filename);
  }

  static downloadWithFallback(streamUrl, filename, onProgress, onStatus, contentLength = null) {
    return downloadWithFallback(streamUrl, filename, onProgress, onStatus, contentLength);
  }

  static _downloadBufferParallel(streamUrl, totalBytes, onProgress, label = '') {
    return downloadBufferParallel(streamUrl, totalBytes, onProgress, label);
  }

  static downloadAndMux(videoFmt, audioFmt, filename, onProgress, onStatus) {
    return downloadAndMux(videoFmt, audioFmt, filename, onProgress, onStatus);
  }

  static convertToMp3(audioArrayBuffer, kbps = 320, onProgress, onStatus) {
    return convertToMp3(audioArrayBuffer, kbps, onProgress, onStatus);
  }

  static downloadParallel(streamUrl, filename, contentLength, onProgress, onStatus) {
    return downloadParallel(streamUrl, filename, contentLength, onProgress, onStatus);
  }

  static _triggerAnchorDownload(href, filename) {
    return triggerAnchorDownload(href, filename);
  }

  static formatDuration(seconds) {
    return formatDuration(seconds);
  }

  static formatFileSize(bytes) {
    return formatFileSize(bytes);
  }

  static buildFilename(title, ext = 'mp4') {
    return buildFilename(title, ext);
  }

  static getWorkerUrl() {
    return CLOUDFLARE_WORKER_URL;
  }
}
