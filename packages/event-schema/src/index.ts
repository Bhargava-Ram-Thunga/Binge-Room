// ─── WebSocket Event Names ────────────────────────────────────────────────────
// This package centralises every event name used across client and server
// to prevent typos and ensure consistency.

// Client → Server
export const CLIENT_EVENTS = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  CREATE_ROOM: "create_room",
  PLAY: "play",
  PAUSE: "pause",
  SEEK: "seek",
  VIDEO_CHANGE: "video_change",
  AD_START: "ad_start",
  AD_END: "ad_end",
  SYNC_STATE: "sync_state",
  PING: "ping",
  LOCK_CONTROLS: "lock_controls",
  PLAYBACK_RATE_CHANGE: "playback_rate_change",
} as const;

// Server → Client
export const SERVER_EVENTS = {
  ROOM_JOINED: "room_joined",
  ROOM_CREATED: "room_created",
  USER_JOINED: "user_joined",
  USER_LEFT: "user_left",
  SYNC_UPDATE: "sync_update",
  ROOM_STATE: "room_state",
  HOST_CHANGED: "host_changed",
  CONTROLS_CHANGED: "controls_changed",
  PONG: "pong",
  ERROR: "error",
} as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];
export type ServerEvent = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

// ─── Error Codes ──────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_FULL: "ROOM_FULL",
  INVALID_CODE: "INVALID_CODE",
  INVALID_ROOM_ID: "INVALID_ROOM_ID",
  ALREADY_IN_ROOM: "ALREADY_IN_ROOM",
  NOT_IN_ROOM: "NOT_IN_ROOM",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─── Validation helpers ───────────────────────────────────────────────────────

export const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
export const ROOM_ID_REGEX = /^[a-z0-9]{20}$/;
export const USERNAME_MAX_LENGTH = 32;
export const MAX_ROOM_USERS = 20;
export const DRIFT_THRESHOLD_MS = 500;
export const SEEK_DEBOUNCE_MS = 300;
export const SYNC_INTERVAL_MS = 5000;
export const RECONNECT_ATTEMPTS = 5;
export const RECONNECT_DELAY_MS = 1000;
