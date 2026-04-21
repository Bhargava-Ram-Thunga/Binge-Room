import { customAlphabet } from 'nanoid'
import { ROOM_ID_LENGTH, INVITE_TOKEN_LENGTH } from '../constants.js'

const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
const roomIdGenerator = customAlphabet(alphabet, ROOM_ID_LENGTH)
const tokenGenerator = customAlphabet(alphabet, INVITE_TOKEN_LENGTH)

export function generateRoomId(): string {
  return roomIdGenerator()
}

export function generateInviteToken(): string {
  return tokenGenerator()
}
