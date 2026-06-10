import type { Platform, VideoState } from "@binge-room/shared-types";

// ─── Platform Adapter Interface ───────────────────────────────────────────────
// Every streaming platform must implement this contract.
// New platforms (Netflix, Prime, etc.) can be added by creating a new adapter
// class that implements PlatformAdapter — no changes needed to the core engine.

export interface PlatformAdapter {
  /** Unique identifier for the platform */
  readonly platform: Platform;

  /** Whether this adapter is active on the current page */
  isActive(): boolean;

  /** Returns the current video ID / slug */
  getVideoId(): string | null;

  /** Returns the current video URL */
  getVideoUrl(): string;

  /** Returns playback position in seconds */
  getCurrentTime(): number;

  /** Returns true if currently playing */
  isPlaying(): boolean;

  /** Returns true if an ad is currently playing */
  isAdPlaying(): boolean;

  /** Start playback */
  play(): void;

  /** Pause playback */
  pause(): void;

  /** Seek to a specific time in seconds */
  seek(time: number): void;

  /** Returns the current playback rate (1 = normal, 2 = 2× speed, etc.) */
  getPlaybackRate(): number;

  /** Set the playback rate */
  setPlaybackRate(rate: number): void;

  /** Returns a snapshot of current video state */
  getVideoState(): Partial<VideoState>;

  // ─── Event Subscriptions ──────────────────────────────────────────────────

  onPlay(callback: (time: number) => void): () => void;
  onPause(callback: (time: number) => void): () => void;
  onSeeked(callback: (time: number) => void): () => void;
  onVideoChange(
    callback: (videoId: string, videoUrl: string) => void,
  ): () => void;
  onAdStart(callback: (currentTime: number) => void): () => void;
  onAdEnd(callback: (resumeTime: number) => void): () => void;
  /** Fires when the user changes playback speed. Not fired for programmatic changes. */
  onRateChange(callback: (rate: number) => void): () => void;

  /** Release all DOM listeners. Called when the user leaves a room. */
  destroy(): void;
}

// ─── Base Adapter with common teardown helpers ────────────────────────────────

export abstract class BaseAdapter implements PlatformAdapter {
  abstract readonly platform: Platform;

  protected cleanupFns: Array<() => void> = [];

  protected addCleanup(fn: () => void): void {
    this.cleanupFns.push(fn);
  }

  protected addDomListener<K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    event: K | string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, options);
    this.addCleanup(() => target.removeEventListener(event, handler, options));
  }

  destroy(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  abstract isActive(): boolean;
  abstract getVideoId(): string | null;
  abstract getVideoUrl(): string;
  abstract getCurrentTime(): number;
  abstract isPlaying(): boolean;
  abstract isAdPlaying(): boolean;
  abstract play(): void;
  abstract pause(): void;
  abstract seek(time: number): void;
  abstract getPlaybackRate(): number;
  abstract setPlaybackRate(rate: number): void;
  abstract getVideoState(): Partial<VideoState>;
  abstract onPlay(callback: (time: number) => void): () => void;
  abstract onPause(callback: (time: number) => void): () => void;
  abstract onSeeked(callback: (time: number) => void): () => void;
  abstract onVideoChange(
    callback: (videoId: string, videoUrl: string) => void,
  ): () => void;
  abstract onAdStart(callback: (currentTime: number) => void): () => void;
  abstract onAdEnd(callback: (resumeTime: number) => void): () => void;
  abstract onRateChange(callback: (rate: number) => void): () => void;
}

// ─── Adapter Registry ─────────────────────────────────────────────────────────

export class AdapterRegistry {
  private static adapters = new Map<Platform, () => PlatformAdapter>();

  static register(platform: Platform, factory: () => PlatformAdapter): void {
    this.adapters.set(platform, factory);
  }

  static create(platform: Platform): PlatformAdapter | null {
    const factory = this.adapters.get(platform);
    return factory ? factory() : null;
  }

  static detect(): Platform | null {
    const hostname = window.location.hostname;
    if (hostname.includes("youtube.com")) return "youtube";
    if (hostname.includes("netflix.com")) return "netflix";
    if (hostname.includes("primevideo.com") || hostname.includes("amazon.com"))
      return "prime";
    if (hostname.includes("disneyplus.com")) return "disney";
    if (hostname.includes("twitch.tv")) return "twitch";
    if (hostname.includes("vimeo.com")) return "vimeo";
    return null;
  }
}
