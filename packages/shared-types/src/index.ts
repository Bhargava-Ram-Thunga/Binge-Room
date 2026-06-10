// ─── Platform Types ───────────────────────────────────────────────────────────

export type Platform =
  | "youtube"
  | "netflix"
  | "prime"
  | "disney"
  | "twitch"
  | "vimeo";

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
  platform: Platform;
}

// ─── Video State ──────────────────────────────────────────────────────────────

export interface VideoState {
  videoId: string;
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  isAdPlaying: boolean;
  lastUpdated: number;
  updatedBy: string;
  /** Playback speed multiplier — 0.25 / 0.5 / 1 / 1.25 / 1.5 / 2. Default 1. */
  playbackRate: number;
}

// ─── Room ─────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  code: string; // 6-digit alphanumeric join code
  hostId: string;
  users: User[];
  videoState: VideoState;
  platform: Platform;
  createdAt: number;
  updatedAt: number;
  /** When true only the host can play/pause/seek; non-host actions are reverted */
  controlsLocked: boolean;
}

// ─── Controls ─────────────────────────────────────────────────────────────────

export interface ToggleControlsPayload extends BaseSyncEvent {
  locked: boolean;
}

export interface ControlsChangedPayload {
  roomId: string;
  locked: boolean;
  room: Room;
}

// ─── Sync Event Base ──────────────────────────────────────────────────────────

export interface BaseSyncEvent {
  roomId: string;
  userId: string;
  userName: string;
  timestamp: number;
  platform: Platform;
}

// ─── Client → Server Events ───────────────────────────────────────────────────

export interface PlayPayload extends BaseSyncEvent {
  type: "PLAY";
  currentTime: number;
}

export interface PausePayload extends BaseSyncEvent {
  type: "PAUSE";
  currentTime: number;
}

export interface SeekPayload extends BaseSyncEvent {
  type: "SEEK";
  currentTime: number;
}

export interface VideoChangePayload extends BaseSyncEvent {
  type: "VIDEO_CHANGE";
  videoId: string;
  videoUrl: string;
}

export interface AdStartPayload extends BaseSyncEvent {
  type: "AD_START";
  currentTime: number;
}

export interface AdEndPayload extends BaseSyncEvent {
  type: "AD_END";
  resumeTime: number;
}

export interface JoinRoomPayload {
  roomId?: string;
  code?: string;
  userName: string;
  platform: Platform;
}

export interface CreateRoomPayload {
  userName: string;
  platform: Platform;
  videoId?: string;
  videoUrl?: string;
}

export interface SyncStatePayload extends BaseSyncEvent {
  type: "SYNC_STATE";
  videoState: VideoState;
}

export interface PingPayload {
  clientTime: number;
}

// ─── Server → Client Events ───────────────────────────────────────────────────

export interface RoomJoinedPayload {
  room: Room;
  user: User;
  serverTime: number;
}

export interface UserJoinedPayload {
  user: User;
  room: Room;
}

export interface UserLeftPayload {
  userId: string;
  userName: string;
  newHostId?: string;
  room: Room;
}

export interface SyncUpdatePayload {
  videoState: VideoState;
  serverTime: number;
  triggeredBy: string;
  triggeredByName: string;
  action:
    | "PLAY"
    | "PAUSE"
    | "SEEK"
    | "VIDEO_CHANGE"
    | "AD_START"
    | "AD_END"
    | "PLAYBACK_RATE_CHANGE";
}

export interface RoomStatePayload {
  room: Room;
  serverTime: number;
}

export interface HostChangedPayload {
  newHostId: string;
  newHostName: string;
  room: Room;
}

export interface PongPayload {
  clientTime: number;
  serverTime: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ─── Chrome Extension Message Types ──────────────────────────────────────────

export type ExtensionMessageType =
  | "CREATE_ROOM"
  | "JOIN_ROOM"
  | "LEAVE_ROOM"
  | "GET_ROOM_STATE"
  | "VIDEO_EVENT"
  | "SYNC_COMMAND"
  | "CONNECTION_STATUS"
  | "ROOM_UPDATE"
  | "SHOW_TOAST";

export interface ExtensionMessage<T = unknown> {
  type: ExtensionMessageType;
  payload: T;
}

export interface ConnectionStatus {
  connected: boolean;
  roomId: string | null;
  userId: string | null;
  userName: string | null;
  isHost: boolean;
  userCount: number;
}

// ─── Toast Notification Types ─────────────────────────────────────────────────

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastNotification {
  id: string;
  type: ToastType;
  message: string;
  userName?: string;
  duration?: number;
  timestamp: number;
}
