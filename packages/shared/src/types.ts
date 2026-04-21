export interface Room {
  id: string
  hostId: string
  videoUrl: string
  videoId: string
  platform: 'YOUTUBE' | 'NETFLIX' | 'PRIME' | 'DISNEY' | 'HOTSTAR' | 'OTHER'
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED'
  isActive: boolean
  createdAt: number
}

export interface Member {
  userId: string
  displayName: string
  avatarInitial: string
  isHost: boolean
  role: 'HOST' | 'COHOST' | 'MEMBER'
  joinedAt: number
}

export interface Message {
  id: string
  userId: string
  displayName: string
  text: string
  type: 'TEXT' | 'SYSTEM' | 'REACTION'
  timestamp: number
}

export interface SyncState {
  position: number
  isPlaying: boolean
  lastUpdated: number
  hostId: string
  videoUrl: string
}

export interface CallParticipant {
  userId: string
  displayName: string
  avatarInitial: string
  isMicOn: boolean
  isCamOn: boolean
  isSpeaking: boolean
}
