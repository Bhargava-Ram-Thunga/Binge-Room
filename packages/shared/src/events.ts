import type { Member, Message } from './types.js'

export interface RoomStateEvent {
  type: 'ROOM_STATE'
  roomId: string
  members: Member[]
  messages: Message[]
  videoUrl: string
  hostPosition: number
  hostId: string
}

export interface PlayEvent {
  type: 'PLAY'
  roomId: string
  userId: string
  position: number
  serverTimestamp: number
}

export interface PauseEvent {
  type: 'PAUSE'
  roomId: string
  userId: string
  position: number
  serverTimestamp: number
}

export interface SeekEvent {
  type: 'SEEK'
  roomId: string
  userId: string
  position: number
  serverTimestamp: number
  seekFrom: number
}

export interface ChatMsgEvent {
  type: 'CHAT_MSG'
  roomId: string
  userId: string
  displayName: string
  text: string
  timestamp: number
}

export interface MemberJoinEvent {
  type: 'MEMBER_JOIN'
  roomId: string
  member: Member
}

export interface MemberLeaveEvent {
  type: 'MEMBER_LEAVE'
  roomId: string
  userId: string
}

export interface HostSwitchEvent {
  type: 'HOST_SWITCH'
  roomId: string
  newHostId: string
  previousHostId: string
}

export interface VideoChangeEvent {
  type: 'VIDEO_CHANGE'
  roomId: string
  videoUrl: string
  videoId: string
  position: number
}

export interface ReactionEvent {
  type: 'REACTION'
  roomId: string
  userId: string
  emoji: string
}

export interface RoomCloseEvent {
  type: 'ROOM_CLOSE'
  roomId: string
}

export type WsEvent =
  | RoomStateEvent
  | PlayEvent
  | PauseEvent
  | SeekEvent
  | ChatMsgEvent
  | MemberJoinEvent
  | MemberLeaveEvent
  | HostSwitchEvent
  | VideoChangeEvent
  | ReactionEvent
  | RoomCloseEvent
