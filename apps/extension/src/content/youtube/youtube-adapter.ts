/**
 * YouTubeAdapter
 *
 * Controls YouTube via standard HTMLMediaElement APIs (video.play/pause/currentTime).
 * These are native DOM APIs accessible from Chrome content scripts, unlike
 * YouTube's proprietary player API (seekTo/playVideo/pauseVideo) which lives
 * in the page's isolated JS world and is not reliably reachable.
 */

import { BaseAdapter } from '@syncstream/platform-sdk';
import type { VideoState } from '../../types/index.js';
import { extractYouTubeVideoId } from '@syncstream/shared-utils';
import { debounce } from '@syncstream/shared-utils';

const YT_STATE = {
  PLAYING: 1,
  PAUSED: 2,
} as const;

export class YouTubeAdapter extends BaseAdapter {
  readonly platform = 'youtube' as const;

  // ─── Element accessors ────────────────────────────────────────────────────

  private get videoEl(): HTMLVideoElement | null {
    return (
      document.querySelector<HTMLVideoElement>('#movie_player video') ??
      document.querySelector<HTMLVideoElement>('.html5-main-video') ??
      document.querySelector<HTMLVideoElement>('video.video-stream') ??
      document.querySelector<HTMLVideoElement>('video')   // last resort
    );
  }

  /** YouTube player element — used only for read-only state queries. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get ytPlayer(): any {
    return document.getElementById('movie_player');
  }

  // ─── PlatformAdapter impl ─────────────────────────────────────────────────

  /**
   * Ready as soon as a <video> element exists on a YouTube watch page.
   * We no longer gate on YouTube's proprietary API (seekTo etc.).
   */
  isActive(): boolean {
    return (
      window.location.hostname.includes('youtube.com') &&
      !!this.videoEl
    );
  }

  /**
   * True once the <video> element has loaded enough metadata to accept a
   * currentTime assignment.  readyState >= 1 (HAVE_METADATA) is the minimum
   * required for a seek to actually stick — earlier than that, YouTube's own
   * init code may reset currentTime back to 0 after we set it.
   */
  canControl(): boolean {
    const v = this.videoEl;
    return !!v && v.readyState >= 1;
  }

  getVideoId(): string | null {
    try {
      const vd = this.ytPlayer?.getVideoData?.();
      if (vd?.video_id) return vd.video_id;
    } catch { /* ignore */ }
    return extractYouTubeVideoId(window.location.href);
  }

  getVideoUrl(): string {
    return window.location.href;
  }

  getCurrentTime(): number {
    return this.videoEl?.currentTime ?? 0;
  }

  isPlaying(): boolean {
    const v = this.videoEl;
    if (!v) return false;
    return !v.paused && !v.ended && v.readyState >= 2;
  }

  isAdPlaying(): boolean {
    return (
      !!document.querySelector('.ytp-ad-player-overlay') ||
      !!document.querySelector('.ytp-ad-skip-button') ||
      !!document.querySelector('[class*="ad-showing"]')
    );
  }

  // ─── Playback control via HTMLMediaElement (always works in content scripts)

  play(): void {
    const v = this.videoEl;
    if (!v) {
      // Defer until the video element appears (force-apply before DOM is ready)
      const observer = new MutationObserver(() => {
        const v2 = this.videoEl;
        if (!v2) return;
        observer.disconnect();
        try { if (typeof this.ytPlayer?.playVideo === 'function') { this.ytPlayer.playVideo(); return; } } catch { /* ignore */ }
        v2.play().catch(() => {});
      });
      observer.observe(document.body, { subtree: true, childList: true });
      setTimeout(() => observer.disconnect(), 15_000);
      return;
    }
    // Try YouTube API first for better buffering behaviour; fall back to DOM
    try {
      if (typeof this.ytPlayer?.playVideo === 'function') {
        this.ytPlayer.playVideo();
        return;
      }
    } catch { /* ignore */ }
    v.play().catch(() => {});
  }

  pause(): void {
    const v = this.videoEl;
    if (!v) return;
    try {
      if (typeof this.ytPlayer?.pauseVideo === 'function') {
        this.ytPlayer.pauseVideo();
        return;
      }
    } catch { /* ignore */ }
    v.pause();
  }

  seek(time: number): void {
    const v = this.videoEl;

    // ── No video element yet (force-apply before DOM is ready) ──────────────
    // Watch for the first <video> to appear in the DOM, then seek immediately.
    if (!v) {
      const observer = new MutationObserver(() => {
        const v2 = this.videoEl;
        if (!v2) return;
        observer.disconnect();
        v2.currentTime = time;
        if (v2.readyState < 1) {
          v2.addEventListener('loadedmetadata', () => { v2.currentTime = time; }, { once: true });
        }
        try { if (typeof this.ytPlayer?.seekTo === 'function') this.ytPlayer.seekTo(time, true); } catch { /* ignore */ }
      });
      observer.observe(document.body, { subtree: true, childList: true });
      // Self-cleanup after 15 s to avoid leaking observers on page unload
      setTimeout(() => observer.disconnect(), 15_000);
      return;
    }

    const doSeek = () => {
      v.currentTime = time;
      try {
        if (typeof this.ytPlayer?.seekTo === 'function') {
          this.ytPlayer.seekTo(time, true);
        }
      } catch { /* ignore */ }
    };

    // Primary seek — works immediately if metadata is loaded
    doSeek();

    // Safety net: if metadata wasn't loaded yet, YouTube's init may reset
    // currentTime after our set.  Re-apply once metadata arrives.
    if (v.readyState < 1) {
      v.addEventListener('loadedmetadata', doSeek, { once: true });
    }
  }

  getPlaybackRate(): number {
    return this.videoEl?.playbackRate ?? 1;
  }

  setPlaybackRate(rate: number): void {
    const v = this.videoEl;
    if (!v) return;
    v.playbackRate = rate;
  }

  getVideoState(): Partial<VideoState> {
    return {
      videoId: this.getVideoId() ?? '',
      videoUrl: this.getVideoUrl(),
      currentTime: this.getCurrentTime(),
      isPlaying: this.isPlaying(),
      isAdPlaying: this.isAdPlaying(),
      playbackRate: this.getPlaybackRate(),
      lastUpdated: Date.now(),
    };
  }

  // ─── Event subscriptions ──────────────────────────────────────────────────
  //
  // Dual-binding: document-level capture (always active) + direct videoEl
  // binding (most reliable when element exists). A 100 ms dedup gate prevents
  // both paths from firing the same callback twice for one event.

  private isVideoTarget(e: Event): boolean {
    return e.target instanceof HTMLVideoElement;
  }

  private makeDeduped(callback: (time: number) => void): () => void {
    let last = 0;
    return () => {
      const now = Date.now();
      if (now - last < 100) return;
      last = now;
      if (!this.isAdPlaying()) callback(this.getCurrentTime());
    };
  }

  onPlay(callback: (time: number) => void): () => void {
    const fire = this.makeDeduped(callback);
    const docH = (e: Event) => { if (this.isVideoTarget(e)) fire(); };
    document.addEventListener('play', docH, true);
    const v = this.videoEl;
    if (v) v.addEventListener('play', fire);
    const cleanup = () => {
      document.removeEventListener('play', docH, true);
      if (v) v.removeEventListener('play', fire);
    };
    this.addCleanup(cleanup);
    return cleanup;
  }

  onPause(callback: (time: number) => void): () => void {
    const fire = this.makeDeduped(callback);
    const docH = (e: Event) => { if (this.isVideoTarget(e)) fire(); };
    document.addEventListener('pause', docH, true);
    const v = this.videoEl;
    if (v) v.addEventListener('pause', fire);
    const cleanup = () => {
      document.removeEventListener('pause', docH, true);
      if (v) v.removeEventListener('pause', fire);
    };
    this.addCleanup(cleanup);
    return cleanup;
  }

  onSeeked(callback: (time: number) => void): () => void {
    const debouncedCb = debounce((time: number) => callback(time), 300);
    let lastFire = 0;
    const fire = () => {
      const now = Date.now();
      if (now - lastFire < 100) return;
      lastFire = now;
      if (!this.isAdPlaying()) debouncedCb(this.getCurrentTime());
    };
    const docH = (e: Event) => { if (this.isVideoTarget(e)) fire(); };
    document.addEventListener('seeked', docH, true);
    const v = this.videoEl;
    if (v) v.addEventListener('seeked', fire);
    const cleanup = () => {
      document.removeEventListener('seeked', docH, true);
      if (v) v.removeEventListener('seeked', fire);
    };
    this.addCleanup(cleanup);
    return cleanup;
  }

  onVideoChange(callback: (videoId: string, videoUrl: string) => void): () => void {
    const handler = () => {
      setTimeout(() => {
        const videoId = this.getVideoId();
        if (videoId) callback(videoId, this.getVideoUrl());
      }, 500);
    };
    document.addEventListener('yt-navigate-finish', handler);
    this.addCleanup(() => document.removeEventListener('yt-navigate-finish', handler));
    return () => document.removeEventListener('yt-navigate-finish', handler);
  }

  onAdStart(callback: (currentTime: number) => void): () => void {
    let wasAd = false;
    const observer = new MutationObserver(() => {
      const isAd = this.isAdPlaying();
      if (!wasAd && isAd) callback(this.getCurrentTime());
      wasAd = isAd;
    });
    const target = document.querySelector('#movie_player') ?? document.body;
    observer.observe(target, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    this.addCleanup(() => observer.disconnect());
    return () => observer.disconnect();
  }

  onAdEnd(callback: (resumeTime: number) => void): () => void {
    let wasAd = false;
    const observer = new MutationObserver(() => {
      const isAd = this.isAdPlaying();
      if (wasAd && !isAd) callback(this.getCurrentTime());
      wasAd = isAd;
    });
    const target = document.querySelector('#movie_player') ?? document.body;
    observer.observe(target, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    this.addCleanup(() => observer.disconnect());
    return () => observer.disconnect();
  }

  onRateChange(callback: (rate: number) => void): () => void {
    // Debounce: holding spacebar fires multiple ratechange events in quick
    // succession (1 → 2 → 1) — wait for it to settle before notifying.
    const debouncedCb = debounce((rate: number) => callback(rate), 150);
    let lastRate = this.getPlaybackRate();

    const fire = () => {
      if (this.isAdPlaying()) return; // ignore rate changes during ads
      const rate = this.getPlaybackRate();
      if (rate === lastRate) return; // no actual change
      lastRate = rate;
      debouncedCb(rate);
    };

    const docH = (e: Event) => { if (this.isVideoTarget(e)) fire(); };
    document.addEventListener('ratechange', docH, true);
    const v = this.videoEl;
    if (v) v.addEventListener('ratechange', fire);
    const cleanup = () => {
      document.removeEventListener('ratechange', docH, true);
      if (v) v.removeEventListener('ratechange', fire);
    };
    this.addCleanup(cleanup);
    return cleanup;
  }
}
