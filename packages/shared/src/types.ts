export interface Member {
  userId: string
  displayName: string
  avatarUrl: string | null
  role: 'host' | 'guest'
  isOnline: boolean
}

export interface Room {
  roomId: string
  hostUserId: string
  videoId: string | null
  status: 'active' | 'ended'
  createdAt: number
}

export interface Message {
  messageId: string
  roomId: string
  userId: string
  text: string
  timestamp: number
}

export interface SyncState {
  position: number
  isPlaying: boolean
  speed: number
  lastTimestamp: number
  hostUserId: string
}
