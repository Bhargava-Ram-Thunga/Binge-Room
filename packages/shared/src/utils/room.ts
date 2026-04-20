import { nanoid } from 'nanoid'

export function generateRoomId(): string {
  return nanoid(8)
}

export function generateInviteToken(): string {
  return nanoid(16)
}
