import { describe, it, expect } from 'vitest'
import { generateRoomId, generateInviteToken } from '../room.js'

describe('room utilities', () => {
  it('generateRoomId returns string of exactly 8 characters', () => {
    expect(generateRoomId()).toHaveLength(8)
  })

  it('generateRoomId only contains lowercase letters and digits', () => {
    expect(generateRoomId()).toMatch(/^[a-z0-9]+$/)
  })

  it('generateRoomId produces unique values — 1000 calls, no duplicates', () => {
    const ids = new Set()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateRoomId())
    }
    expect(ids.size).toBe(1000)
  })

  it('generateInviteToken returns string of exactly 16 characters', () => {
    expect(generateInviteToken()).toHaveLength(16)
  })

  it('generateInviteToken only contains lowercase letters and digits', () => {
    expect(generateInviteToken()).toMatch(/^[a-z0-9]+$/)
  })

  it('generateInviteToken produces unique values — 1000 calls, no duplicates', () => {
    const tokens = new Set()
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateInviteToken())
    }
    expect(tokens.size).toBe(1000)
  })
})
