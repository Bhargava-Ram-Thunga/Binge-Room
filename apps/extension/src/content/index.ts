/**
 * Binge-Room Content Script — injected into YouTube pages
 */

import { YouTubeAdapter } from "./youtube/youtube-adapter.js";
import { SyncEngine } from "./shared/sync-engine.js";
import { ToastManager } from "./shared/toast-manager.js";
import { RoomOverlay } from "./shared/room-overlay.js";
import type { Room, User, SyncUpdatePayload } from "../types/index.js";

// ─── Singletons ───────────────────────────────────────────────────────────────

const adapter = new YouTubeAdapter();
const engine = new SyncEngine(adapter);
const toastManager = new ToastManager();
const overlay = new RoomOverlay();

let currentRoom: Room | null = null;
let currentUser: User | null = null;
let engineRunning = false;

// ─── Extension context guard ──────────────────────────────────────────────────

function isContextValid(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(chrome as any)?.runtime?.id;
  } catch {
    return false;
  }
}

// ─── Message listener ────────────────────────────────────────────────────────

try {
  chrome.runtime.onMessage.addListener((message) => {
    if (!isContextValid()) return;
    const { type, payload } = message;
    switch (type) {
      case "ROOM_JOINED":
        handleRoomJoined(
          payload.room,
          payload.user,
          payload.serverTime ?? Date.now(),
        );
        break;
      case "ROOM_LEFT":
        handleRoomLeft();
        break;
      case "SYNC_COMMAND":
        handleSyncCommand(payload);
        break;
      case "SHOW_TOAST":
        toastManager.show({
          message: payload.message,
          type: payload.type ?? "info",
          duration: payload.duration,
        });
        break;
      case "ROOM_UPDATE":
        if (payload.room) {
          currentRoom = payload.room;
          engine.updateRoom(payload.room);
          overlay.show(payload.room, true);
        }
        break;
      case "CONNECTION_STATUS":
        if (currentRoom) overlay.show(currentRoom, payload.connected ?? false);
        break;
    }
  });
} catch (err) {
  console.warn("[Binge-Room] Could not register message listener:", err);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleRoomJoined(
  room: Room,
  user: User,
  serverTime: number,
  isRejoin = false,
) {
  currentRoom = room;
  currentUser = user;

  // Stop any previously running engine
  if (engineRunning) engine.stop();

  // Start engine IMMEDIATELY — don't wait for the player.
  // Document-capture listeners work as soon as they're attached.
  // play()/pause()/seek() have their own guards and will no-op until the
  // player API is ready.
  engine.start(room, user, () => {
    toastManager.show({
      message: "🔒 Only the host can control playback",
      type: "warning",
      duration: 2500,
    });
  });
  engineRunning = true;
  overlay.show(room, true);

  console.log(
    "[Binge-Room] Engine started for room",
    room.code,
    "user",
    user.name,
    "isHost",
    user.isHost,
    "isRejoin",
    isRejoin,
  );

  const vs = room.videoState;

  if (user.isHost && !isRejoin) {
    // Fresh host session: push actual playback state to server so joiners
    // receive accurate state. Retry until the player API is ready.
    waitForControl(
      30,
      () => {
        engine.broadcastCurrentState();
      },
      /* forceOnTimeout */ false,
    );
  } else {
    // Non-host join OR any reload:
    //  1. Lock immediately — prevents YouTube's page-load auto-play from firing
    //     spurious outbound events or triggering a false "controls locked" revert
    //     before we've seeked to the correct position.
    //  2. Poll until the player is ready (200 ms intervals), then seek + play.
    //  3. Force-apply after 12 s even if not yet "ready" — the adapter's
    //     loadedmetadata safety net will finalise the seek once metadata arrives.
    engine.lockForSync(12_000);
    if (vs.videoId || vs.videoUrl) {
      waitForControl(
        60,
        () => {
          engine.applySync(
            {
              videoState: vs,
              serverTime: Date.now(),
              triggeredBy: "__server__",
              triggeredByName: "server",
              action: "ROOM_STATE",
            },
            Date.now(),
          );
        },
        /* forceOnTimeout */ true,
      );
    }
  }
}

/**
 * Poll until adapter.canControl() is true, then run cb.
 *
 * @param attemptsLeft  max poll rounds before giving up / forcing
 * @param cb            callback to run once ready (or on forced apply)
 * @param forceOnTimeout  if true, call cb() even when player isn't ready yet;
 *                        the adapter's loadedmetadata safety net will finalise
 *                        the seek once the video element is available.
 *                        Set false for the host-broadcast path so we don't push
 *                        a stale (time=0, paused) state to the server.
 */
function waitForControl(
  attemptsLeft: number,
  cb: () => void,
  forceOnTimeout = false,
): void {
  if (adapter.canControl()) {
    cb();
    return;
  }
  if (attemptsLeft <= 0) {
    if (forceOnTimeout) {
      console.warn(
        "[Binge-Room] Forcing sync — player not yet ready, will re-seek on loadedmetadata",
      );
      cb();
    } else {
      console.warn(
        "[Binge-Room] Player never became controllable — skipping broadcast",
      );
    }
    return;
  }
  setTimeout(() => waitForControl(attemptsLeft - 1, cb, forceOnTimeout), 200);
}

function handleRoomLeft() {
  engine.stop();
  engineRunning = false;
  overlay.hide();
  currentRoom = null;
  currentUser = null;
}

function handleSyncCommand(
  payload: SyncUpdatePayload & { action?: string; serverTime?: number },
) {
  if (!engineRunning) {
    console.warn(
      "[Binge-Room] SYNC_COMMAND ignored — engine not running",
      payload.action,
    );
    return;
  }
  console.log(
    "[Binge-Room] Applying sync command:",
    payload.action,
    payload.triggeredByName,
  );
  engine.applySync(payload, payload.serverTime ?? Date.now());
}

// ─── On load: re-attach if already in a room ─────────────────────────────────

if (isContextValid()) {
  try {
    chrome.runtime.sendMessage({ type: "GET_ROOM_STATE" }, (response) => {
      if (!isContextValid() || chrome.runtime.lastError) return;
      if (response?.success && response.data?.room && response.data?.user) {
        const { room, user } = response.data;
        handleRoomJoined(room, user, Date.now() - 2000, true /* isRejoin */);
      }
    });
  } catch (err) {
    console.warn("[Binge-Room] Could not send GET_ROOM_STATE:", err);
  }
}

console.log("[Binge-Room] Content script ready on", window.location.hostname);
