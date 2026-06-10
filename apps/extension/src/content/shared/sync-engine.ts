/**
 * SyncEngine
 *
 * The central synchronisation logic for a single browser tab.
 *
 * Responsibilities:
 *  1. Listen to user-initiated video events via a PlatformAdapter
 *  2. Forward those events to the background worker (→ server)
 *  3. Receive SYNC_COMMAND messages from the background worker
 *  4. Apply remote commands to the video, handling drift correction
 *
 * The engine deliberately avoids re-emitting events triggered by its own
 * apply() calls to prevent feedback loops.
 */

import type { PlatformAdapter } from "@binge-room/platform-sdk";
import type {
  SyncUpdatePayload,
  Room,
  User,
  VideoState,
} from "../../types/index.js";
import { computeExpectedTime, isDriftExceeded } from "@binge-room/shared-utils";
import { DRIFT_THRESHOLD_MS, SYNC_INTERVAL_MS } from "@binge-room/event-schema";

// How long to hold the "applying" lock after sending a remote command to the
// adapter.  Must be long enough to cover async buffering / 'seeked' events
// that YouTube fires 500–1500 ms after the actual seek call.
const APPLYING_LOCK_MS = 2000;

export class SyncEngine {
  private adapter: PlatformAdapter;
  private room: Room | null = null;
  private currentUser: User | null = null;

  /** When true, the engine is applying a remote command — suppress outbound events */
  private applying = false;
  /** When true, an ad is in progress on this client */
  private localAdActive = false;
  /** Set to true when the extension context is invalidated so we stop all work */
  private contextInvalid = false;
  /** Callback fired when a non-host tries to control playback while locked */
  private onDenied: (() => void) | undefined;

  private cleanupFns: Array<() => void> = [];
  private driftIntervalId: ReturnType<typeof setInterval> | null = null;
  private applyingTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(adapter: PlatformAdapter) {
    this.adapter = adapter;
  }

  // ─── Start / Stop ─────────────────────────────────────────────────────────

  start(room: Room, user: User, onDenied?: () => void): void {
    this.room = room;
    this.currentUser = user;
    this.contextInvalid = false;
    this.onDenied = onDenied;
    this.attachVideoListeners();
    this.startDriftCorrection();
    console.log("[Binge-Room Engine] Started for room", room.id);
  }

  stop(): void {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
    if (this.driftIntervalId) {
      clearInterval(this.driftIntervalId);
      this.driftIntervalId = null;
    }
    if (this.applyingTimerId) {
      clearTimeout(this.applyingTimerId);
      this.applyingTimerId = null;
    }
    this.applying = false;
    this.room = null;
    this.currentUser = null;
    console.log("[Binge-Room Engine] Stopped");
  }

  updateRoom(room: Room): void {
    this.room = room;
  }

  /**
   * Push the adapter's actual current playback state to the server.
   * Called by the host immediately after the engine starts so the room state
   * reflects the real position rather than the stale {time:0, playing:false}
   * that createRoom stores.
   */
  broadcastCurrentState(): void {
    if (!this.room || !this.currentUser || this.contextInvalid) return;
    const isPlaying = this.adapter.isPlaying();
    const currentTime = this.adapter.getCurrentTime();
    if (isPlaying) {
      this.emitVideoEvent("PLAY", { currentTime });
    } else {
      this.emitVideoEvent("PAUSE", { currentTime });
    }
  }

  // ─── Controls check ───────────────────────────────────────────────────────

  /** Returns true if this user is allowed to control playback right now. */
  private isUserAllowed(): boolean {
    if (!this.room || !this.currentUser) return false;
    if (this.currentUser.isHost) return true;
    return !(this.room.controlsLocked ?? true);
  }

  /**
   * Revert the video to the expected room state.
   * Used when a non-host tries to control playback while controls are locked.
   */
  private revertToRoomState(): void {
    if (!this.room) return;
    this.setApplying();
    const vs = this.room.videoState;
    const expected = computeExpectedTime(vs, Date.now());
    this.adapter.seek(expected);
    if (vs.isPlaying) {
      this.adapter.play();
    } else {
      this.adapter.pause();
    }
    this.onDenied?.();
  }

  // ─── Outbound: video events → background ─────────────────────────────────

  private attachVideoListeners(): void {
    const off1 = this.adapter.onPlay((time) => {
      if (this.applying || this.localAdActive) return;
      if (!this.isUserAllowed()) {
        this.revertToRoomState();
        return;
      }
      // Optimistically update local state so drift correction doesn't fight this
      this.updateLocalVideoState({ isPlaying: true, currentTime: time });
      this.emitVideoEvent("PLAY", { currentTime: time });
    });

    const off2 = this.adapter.onPause((time) => {
      if (this.applying || this.localAdActive) return;
      if (!this.isUserAllowed()) {
        this.revertToRoomState();
        return;
      }
      this.updateLocalVideoState({ isPlaying: false, currentTime: time });
      this.emitVideoEvent("PAUSE", { currentTime: time });
    });

    const off3 = this.adapter.onSeeked((time) => {
      if (this.applying) return;
      if (!this.isUserAllowed()) {
        this.revertToRoomState();
        return;
      }
      // Update local state immediately so drift correction uses the new position
      this.updateLocalVideoState({ currentTime: time });
      this.emitVideoEvent("SEEK", { currentTime: time });
    });

    const off4 = this.adapter.onVideoChange((videoId, videoUrl) => {
      if (this.applying) return;
      if (!this.isUserAllowed()) return; // silently ignore video changes from non-hosts
      this.emitVideoEvent("VIDEO_CHANGE", { videoId, videoUrl });
    });

    const off5 = this.adapter.onAdStart((currentTime) => {
      this.localAdActive = true;
      this.emitVideoEvent("AD_START", { currentTime });
    });

    const off6 = this.adapter.onAdEnd((resumeTime) => {
      this.localAdActive = false;
      this.emitVideoEvent("AD_END", { resumeTime });
    });

    const off7 = this.adapter.onRateChange((rate) => {
      if (this.applying || this.localAdActive) return;
      if (!this.isUserAllowed()) {
        this.revertToRoomState();
        return;
      }
      // Capture currentTime at the moment of the rate change so other clients
      // seek to the same position before applying the new rate.
      const currentTime = this.adapter.getCurrentTime();
      this.updateLocalVideoState({ playbackRate: rate, currentTime });
      this.emitVideoEvent("PLAYBACK_RATE_CHANGE", {
        playbackRate: rate,
        currentTime,
      });
    });

    this.cleanupFns.push(off1, off2, off3, off4, off5, off6, off7);
  }

  /**
   * Optimistically update local room videoState so drift correction always
   * has an accurate reference after user-initiated actions.
   */
  private updateLocalVideoState(patch: Partial<VideoState>): void {
    if (!this.room) return;
    this.room = {
      ...this.room,
      videoState: {
        ...this.room.videoState,
        ...patch,
        lastUpdated: Date.now(),
      },
    };
  }

  private emitVideoEvent(
    action: string,
    extra: Record<string, unknown> = {},
  ): void {
    if (!this.room || !this.currentUser || this.contextInvalid) return;
    // chrome.runtime becomes undefined when the extension is reloaded
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(chrome as any)?.runtime) {
      this.contextInvalid = true;
      this.stop();
      return;
    }
    try {
      chrome.runtime.sendMessage({
        type: "VIDEO_EVENT",
        payload: { action, ...extra },
      });
    } catch {
      // Any error here means the extension context is gone
      this.contextInvalid = true;
      this.stop();
    }
  }

  // ─── Inbound: apply remote sync commands ──────────────────────────────────

  applySync(
    payload: SyncUpdatePayload & { action?: string },
    serverTime: number,
  ): void {
    if (!this.room || !this.currentUser) return;

    const { videoState, action } = payload;
    const triggeredByMe = payload.triggeredBy === this.currentUser.id;
    if (triggeredByMe) return; // don't apply your own commands back to yourself

    // Keep local room videoState current so drift correction always has accurate
    // data (isPlaying, currentTime, lastUpdated) after remote events.
    this.room = { ...this.room, videoState };

    this.setApplying();

    switch (action ?? "ROOM_STATE") {
      case "PLAY":
        this.applyPlay(videoState, serverTime);
        break;
      case "PAUSE":
        this.applyPause(videoState);
        break;
      case "SEEK":
        this.applySeek(videoState.currentTime);
        break;
      case "VIDEO_CHANGE":
        this.applyVideoChange(videoState);
        break;
      case "AD_START":
        this.applyAdStart();
        break;
      case "AD_END":
        this.applyAdEnd(videoState);
        break;
      case "PLAYBACK_RATE_CHANGE":
        this.applyRateChange(videoState);
        break;
      case "ROOM_STATE":
        // New joiner catch-up
        this.applyRoomState(videoState, serverTime);
        break;
    }
  }

  /**
   * Immediately acquire the applying lock for `ms` milliseconds.
   *
   * Call this right after engine.start() for any non-host / rejoin case so
   * that YouTube's page-load auto-play events don't fire spurious outbound
   * VIDEO_EVENTs (or trigger a false "controls locked" revert) before we've
   * had a chance to seek to the correct room position.
   *
   * applySync() resets the lock to APPLYING_LOCK_MS automatically once the
   * actual seek has been dispatched.
   */
  lockForSync(ms = 12_000): void {
    this.applying = true;
    if (this.applyingTimerId) clearTimeout(this.applyingTimerId);
    this.applyingTimerId = setTimeout(() => {
      this.applying = false;
      this.applyingTimerId = null;
    }, ms);
  }

  /** Set applying=true and schedule release after APPLYING_LOCK_MS.
   *  Clears any previously pending release to avoid stacking timers. */
  private setApplying(): void {
    this.applying = true;
    if (this.applyingTimerId) clearTimeout(this.applyingTimerId);
    this.applyingTimerId = setTimeout(() => {
      this.applying = false;
      this.applyingTimerId = null;
    }, APPLYING_LOCK_MS);
  }

  private applyPlay(videoState: VideoState, serverTime: number): void {
    const expected = computeExpectedTime(videoState, serverTime);
    const actual = this.adapter.getCurrentTime();
    if (isDriftExceeded(actual, expected, DRIFT_THRESHOLD_MS)) {
      this.adapter.seek(expected);
    }
    this.adapter.play();
  }

  private applyPause(videoState: VideoState): void {
    this.adapter.pause();
    const actual = this.adapter.getCurrentTime();
    if (isDriftExceeded(actual, videoState.currentTime, DRIFT_THRESHOLD_MS)) {
      this.adapter.seek(videoState.currentTime);
    }
  }

  private applySeek(time: number): void {
    this.adapter.seek(time);
  }

  private applyVideoChange(videoState: VideoState): void {
    if (videoState.videoUrl && videoState.videoUrl !== window.location.href) {
      window.location.href = videoState.videoUrl;
    }
  }

  private applyAdStart(): void {
    // Other clients pause while this client watches the ad
    this.adapter.pause();
  }

  private applyAdEnd(videoState: VideoState): void {
    // resumeTime is already in videoState.currentTime (set by server from AD_END payload).
    // Lock before seeking so the seeked/play events don't echo back as VIDEO_EVENTs.
    this.lockForSync(3_000);
    this.adapter.seek(videoState.currentTime);
    if (videoState.isPlaying) this.adapter.play();
  }

  private applyRateChange(videoState: VideoState): void {
    const rate = videoState.playbackRate ?? 1;
    // Seek to the sender's exact position so both clients are aligned before
    // the rate kicks in. setApplying() is already held by applySync().
    this.adapter.seek(videoState.currentTime);
    this.adapter.setPlaybackRate(rate);
    // Apply playback rate on ROOM_STATE too so joiners inherit the room speed.
  }

  private applyRoomState(videoState: VideoState, serverTime: number): void {
    const rate = videoState.playbackRate ?? 1;
    this.adapter.setPlaybackRate(rate);
    const expected = computeExpectedTime(videoState, serverTime);
    this.adapter.seek(expected);
    if (videoState.isPlaying) {
      this.adapter.play();
    } else {
      this.adapter.pause();
    }
  }

  // ─── Periodic Drift Correction ────────────────────────────────────────────

  private startDriftCorrection(): void {
    this.driftIntervalId = setInterval(() => {
      if (
        !this.room ||
        !this.currentUser ||
        this.applying ||
        this.localAdActive ||
        this.contextInvalid
      )
        return;

      const videoState = this.room.videoState;
      if (!videoState.isPlaying) return;

      const expected = computeExpectedTime(videoState, Date.now());
      const actual = this.adapter.getCurrentTime();

      if (isDriftExceeded(actual, expected, DRIFT_THRESHOLD_MS)) {
        console.log(
          `[Binge-Room Engine] Drift ${((actual - expected) * 1000).toFixed(0)}ms — correcting`,
        );
        this.setApplying();
        this.adapter.seek(expected);
      }
    }, SYNC_INTERVAL_MS);
  }
}
