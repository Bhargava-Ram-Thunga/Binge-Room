export type {
  User,
  Room,
  VideoState,
  Platform,
  ToastNotification,
  ToastType,
  ConnectionStatus,
  ExtensionMessage,
  ExtensionMessageType,
  SyncUpdatePayload,
  RoomJoinedPayload,
  UserJoinedPayload,
  UserLeftPayload,
  RoomStatePayload,
  HostChangedPayload,
  CreateRoomPayload,
  JoinRoomPayload,
  PlayPayload,
  PausePayload,
  SeekPayload,
  VideoChangePayload,
  AdStartPayload,
  AdEndPayload,
} from "@binge-room/shared-types";

// Extension-internal message types (background ↔ content ↔ popup)
export interface BgMessage<T = unknown> {
  type: string;
  payload?: T;
  requestId?: string;
}

export interface BgResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
