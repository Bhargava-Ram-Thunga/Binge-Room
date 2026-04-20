import type { Member } from './types.js'

export interface RoomStateEvent {
  type: 'ROOM_STATE'
  roomId: string
  videoId: string | null
  position: number
  isPlaying: boolean
  speed: number
  members: Member[]
  hostUserId: string
}

export interface PlayEvent {
  type: 'PLAY'
  roomId: string
  userId: string
  position: number
  timestamp: number
}

export interface PauseEvent {
  type: 'PAUSE'
  roomId: string
  userId: string
  position: number
  timestamp: number
}

export interface SeekEvent {
  type: 'SEEK'
  roomId: string
  userId: string
  position: number
  timestamp: number
}

export interface ChatMsgEvent {
  type: 'CHAT_MSG'
  roomId: string
  userId: string
  messageId: string
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
  previousHostId: string
  newHostId: string
}

export interface VideoChangeEvent {
  type: 'VIDEO_CHANGE'
  roomId: string
  userId: string
  videoId: string
}

export interface ReactionEvent {
  type: 'REACTION'
  roomId: string
  userId: string
  emoji: string
  timestamp: number
}

export interface RoomCloseEvent {
  type: 'ROOM_CLOSE'
  roomId: string
  userId: string
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
