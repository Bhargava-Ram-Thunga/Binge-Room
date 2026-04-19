# BingeRoom WebSocket Events

---

## Table of Contents

1. [Overview](#overview)
2. [Connection and Lifecycle](#connection-and-lifecycle)
3. [Error Response Format](#error-response-format)
4. [Event Reference](#event-reference)
   - [ROOM_STATE](#room_state)
   - [PLAY](#play)
   - [PAUSE](#pause)
   - [SEEK](#seek)
   - [CHAT_MSG](#chat_msg)
   - [MEMBER_JOIN](#member_join)
   - [MEMBER_LEAVE](#member_leave)
   - [HOST_SWITCH](#host_switch)
   - [VIDEO_CHANGE](#video_change)
   - [REACTION](#reaction)
   - [ROOM_CLOSE](#room_close)
5. [State Machine](#state-machine)
6. [Event Priority Order](#event-priority-order)
7. [Payload Size Limits](#payload-size-limits)
8. [Testing Matrix](#testing-matrix)

---

## Overview

### Connection

WebSocket connections are established via HTTP upgrade. The server reads these headers before allowing the upgrade:

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | YES | `Bearer {jwt}` — identifies the authenticated user |
| `X-Room-Id` | YES | The room to join |
| `X-User-Id` | YES | Must match the `sub` claim in the JWT |

Missing or invalid `Authorization` → 401 Unauthorized, upgrade rejected.
Missing `X-Room-Id` → 400 Bad Request.
`X-User-Id` / JWT mismatch → 401 Unauthorized.
User not a member of the room → 403 Forbidden.
Room not found → 404 Not Found.
Room status is `ended` → 409 Conflict, body: `{"code":"ROOM_CLOSED"}`.
Room at max capacity → 429 Too Many Requests.

### Message Format

All messages are JSON objects. Every message in either direction contains a `type` field matching one value of the `WsEvent` union type.

```json
{ "type": "PLAY", "position": 142.5 }
```

The server validates every incoming payload with zod before any handler runs. Invalid payloads return an `ERROR` message to the sender only and stop processing — they are never broadcast.

### Server Timestamp Policy

All broadcast events include a `serverTimestamp` field (Unix milliseconds) stamped by the server at the moment of processing. Client-supplied timestamps are never trusted and are discarded. Clients use `serverTimestamp` for drift compensation when applying sync events:

```
correctedPosition = event.position + (Date.now() - event.serverTimestamp) / 1000
```

### Host Authority Rule

`PLAY`, `PAUSE`, and `SEEK` from a sender who is not the current host are **silently dropped** — no error is returned to the sender, and nothing is broadcast. This prevents feedback loops and confusing UX for guests.

`VIDEO_CHANGE` and `HOST_SWITCH` from a non-host return `NOT_HOST` error (not silently dropped — these are deliberate actions that should surface feedback).

### Broadcast Behavior

Recipients for each event are defined per-event in the Event Reference. Terms used:

| Term | Meaning |
|------|---------|
| **All members** | Every connected member in the room, including sender |
| **All members except sender** | Every connected member except the one who triggered the event |
| **Remaining members** | All members still connected after the triggering action |
| **Sender only** | Only the connection that sent the triggering message |

### Connection Lifecycle

```
Client connects with headers
  → Server validates JWT and room membership
  → Server sends ROOM_STATE to new member
  → Server broadcasts MEMBER_JOIN to existing members
  → [normal event exchange]
  → Client disconnects (WS close / timeout / heartbeat failure)
  → If departing member was host: server broadcasts HOST_SWITCH first
  → Server broadcasts MEMBER_LEAVE to remaining members
```

---

## Connection and Lifecycle

### WS Upgrade Header Validation (in order)

1. `Authorization: Bearer {jwt}` — decoded to extract `userId`. Missing or invalid → **401**.
2. `X-Room-Id` — identifies the target room. Missing → **400**.
3. `X-User-Id` — must match `userId` from JWT sub claim. Mismatch → **401**.
4. Room looked up in Redis `room:{roomId}:state`. Not found → **404**.
5. Room status checked. If `ended` → **409** with `{"code":"ROOM_CLOSED"}`.
6. `ROOM_MEMBERS` checked for active membership. Not a member → **403**.
7. `current_member_count` vs `max_members` checked. At capacity → **429**.
8. WS upgrade completes.

### On Successful Connect

Immediately after upgrade:

1. Register connection: `ws:conn:{connectionId}` HSET `{userId, roomId, connectedAt}`. `user:{userId}:ws_connection` SET.
2. SADD `userId` to `room:{roomId}:members`.
3. Send `ROOM_STATE` to the new member.
4. Broadcast `MEMBER_JOIN` to all existing members.

### Heartbeat

- Server sends a `ping` frame every **20,000 ms** (`HEARTBEAT_MS`).
- Client must respond with a `pong` frame within **5,000 ms**.
- Failure to pong → connection treated as dead, closed, disconnect flow triggered.

### On Disconnect

When a WS connection closes (normal close, error, or heartbeat timeout):

1. SREM `userId` from `room:{roomId}:members`. On failure: log error, retry once. If retry fails: log critical error; presence is stale until 24h TTL.
2. DEL `ws:conn:{connectionId}` and `user:{userId}:ws_connection`.
3. If departing member was the **host** and at least one member remains:
   - Select next host by `joined_at` ASC (longest-staying active member).
   - Broadcast `HOST_SWITCH` before `MEMBER_LEAVE`.
4. Broadcast `MEMBER_LEAVE` to all remaining connected members.
5. UPDATE `ROOM_MEMBERS`: `status=left`, `left_at=now()`, `total_watch_time_seconds` (async).
6. UPDATE `ROOMS.current_member_count - 1` (async).
7. If room is now empty: HSET `room:{roomId}:sync` `isPlaying=false`. Room is **not** automatically closed — TTL and cleanup cron handle expiry.

---

## Error Response Format

All errors sent to the client follow this shape:

```json
{
  "type": "ERROR",
  "code": "ERROR_CODE",
  "message": "Human-readable description",
  "eventType": "PLAY"
}
```

`eventType` is the `type` of the message that triggered the error. Errors are always sent to the **sender only** — never broadcast.

### All Error Codes

| Code | When Returned |
|------|--------------|
| `INVALID_PAYLOAD` | Payload fails zod validation — missing field, wrong type, out-of-range value |
| `NOT_IN_ROOM` | Sender's userId is not in `room:{roomId}:members` Redis Set |
| `ROOM_NOT_FOUND` | Room not found in Redis or DB |
| `ROOM_CLOSED` | Room `status` is `ended` |
| `NOT_HOST` | Sender is not the current host and the event requires host authority |
| `INVALID_EMOJI` | `REACTION` emoji not in the allowed set |
| `INVALID_VIDEO_URL` | `VIDEO_CHANGE` URL is not a valid YouTube URL |
| `MEMBER_NOT_FOUND` | `HOST_SWITCH` `newHostId` is not an active member of the room |
| `INTERNAL_ERROR` | Unhandled server error (e.g., Redis unavailable for a required read) |

---

## Event Reference

---

### ROOM_STATE

**Direction**: server→client only

**Who can send**: server only — clients cannot send or request this event

**Trigger**: Immediately after a successful WS upgrade (new connect or reconnect). Also sent by the sync engine when severe drift is detected and a full resync is needed.

**Client payload**: N/A

**Server broadcast payload**:

```json
{
  "type": "ROOM_STATE",
  "roomId": "string",
  "status": "string — waiting | active | paused | ended",
  "hostId": "string — userId of current host",
  "videoUrl": "string | null",
  "videoId": "string | null — platform video ID",
  "isPlaying": "boolean",
  "hostPosition": "number — computed current position in seconds",
  "speed": "number — playback speed, e.g. 1.0",
  "members": [
    {
      "userId": "string",
      "displayName": "string",
      "avatarUrl": "string | null",
      "role": "string — host | co_host | member",
      "joinedAt": "number — Unix ms"
    }
  ],
  "recentMessages": [
    {
      "id": "string",
      "userId": "string",
      "displayName": "string",
      "text": "string",
      "serverTimestamp": "number — Unix ms"
    }
  ],
  "serverTimestamp": "number — Unix ms, when ROOM_STATE was assembled"
}
```

`recentMessages` is the last 50 entries from `room:{roomId}:messages:recent` (Redis List, LRANGE 0 49).

**Recipients**: sender only (the newly connected member)

**Server actions** (in order):
1. Read `room:{roomId}:state` from Redis — get `status`, `host_user_id`, `current_video_id`. On failure → reject WS upgrade with `INTERNAL_ERROR`.
2. Read `room:{roomId}:sync` from Redis — get `position_s`, `playing`, `speed`, `last_event_at`.
3. Compute `hostPosition`:
   - If `playing = true`: `hostPosition = position_s + (Date.now() - last_event_at) / 1000`
   - If `playing = false`: `hostPosition = position_s`
4. Read `room:{roomId}:members` (SMEMBERS) — get active userIds.
5. Fetch member profiles (displayName, avatarUrl, role, joinedAt) from DB or cache.
6. LRANGE `room:{roomId}:messages:recent` 0 49 — last 50 messages.
7. Assemble and send ROOM_STATE to connecting member only.

**Redis updates**: None — ROOM_STATE is a read-only snapshot.

**Postgres updates**: None.

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| Redis unavailable | INTERNAL_ERROR | Sender — WS upgrade rejected |
| Room not found in Redis | ROOM_NOT_FOUND | Sender — WS upgrade rejected |
| Room status is `ended` | ROOM_CLOSED | Sender — WS upgrade rejected |

**Silent drops**: N/A — server-initiated.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Member connects while ROOM_CLOSE is processing | ROOM_STATE read sees `ended` → rejected with ROOM_CLOSED |
| Two members connect simultaneously | Each gets an independent snapshot; member lists may differ by one — acceptable eventual consistency |

**Example flow**:
1. Guest opens YouTube. Extension detects room code in URL.
2. Background worker fetches JWT from storage.
3. Background worker opens WS with `Authorization`, `X-Room-Id`, `X-User-Id` headers.
4. Server validates, upgrade completes.
5. Server reads Redis: `position_s=142.5`, `last_event_at=1713430800000`, `playing=true`.
6. `Date.now() = 1713430810000`. `hostPosition = 142.5 + 10.0 = 152.5s`.
7. Server sends ROOM_STATE with `hostPosition=152.5`, `isPlaying=true`, last 50 messages.
8. Guest content script receives ROOM_STATE, calls `ytPlayer.seekTo(152.5)` then `ytPlayer.play()`.
9. Server broadcasts MEMBER_JOIN to the 3 existing members.

**Notes**:
- `hostPosition` is **never** the raw `position_s` from Redis when `isPlaying=true`. Always use `computeHostPosition(position_s, last_event_at, playing)` from `@bingeroom/shared`.
- On reconnect, treat ROOM_STATE as authoritative — seek to `hostPosition` even if local state differs.
- If `recentMessages` is empty (Redis list expired or new room), send an empty array. Do not query Postgres for historical messages on connect.

---

### PLAY

**Direction**: client→server (host only), then server→all members

**Who can send**: host only. Non-host sends are silently dropped.

**Trigger**: Host presses play on YouTube. Content script detects `play` event on `<video>` and sends PLAY (if `isApplyingRemote` is false).

**Client payload**:
```json
{
  "type": "PLAY",
  "position": "number — video position in seconds at the moment play was triggered"
}
```

**Server broadcast payload**:
```json
{
  "type": "PLAY",
  "position": "number — video position in seconds",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender

**Server actions** (in order):
1. Validate — `position` must be a non-negative number. On failure: `INVALID_PAYLOAD` to sender, stop.
2. Read `room:{roomId}:state` `host_user_id` — if sender ≠ host: **silent drop**, stop.
3. Check room status — if `ended`: `ROOM_CLOSED` to sender, stop.
4. Check sender in `room:{roomId}:members` — if not: `NOT_IN_ROOM` to sender, stop.
5. `serverTimestamp = Date.now()`.
6. HSET `room:{roomId}:sync` `isPlaying=true position={position} last_event_at={serverTimestamp}`. Reset TTL to 24h.
7. Broadcast PLAY to all members.
8. INSERT `SYNC_EVENTS` async (fire-and-forget): `event_type=play, video_position_seconds={position}, server_timestamp, triggered_by_user_id, room_id, room_video_id`.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:sync` | HSET | `isPlaying=true, position={position}, last_event_at={serverTimestamp}` | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| SYNC_EVENTS | INSERT | event_type, video_position_seconds, server_timestamp, triggered_by_user_id, room_id, room_video_id | YES |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `position` missing or not a number | INVALID_PAYLOAD | Sender only |
| `position` is negative | INVALID_PAYLOAD | Sender only |
| Sender not in room | NOT_IN_ROOM | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**:
| Scenario | Why silently dropped |
|----------|---------------------|
| Non-host sends PLAY | Prevents feedback loops — guest video events must not drive room playback |

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Two PLAY events within 50ms | Both update Redis (last write wins), both broadcast — clients handle duplicate PLAY idempotently |
| PLAY when already playing | Idempotent — Redis HSET overwrites (no state change), broadcast fires anyway; guests re-apply drift compensation |
| PLAY while ROOM_CLOSE is processing | Handler checks room status → ROOM_CLOSED error |

**Example flow**:
1. Host presses play. Content script checks `isApplyingRemote=false` → proceeds.
2. Sends `{type:"PLAY", position:142.5}` via WS.
3. Server validates. Confirms sender is host. `serverTimestamp=1713430800000`.
4. HSET `room:{roomId}:sync` `isPlaying=true position=142.5 last_event_at=1713430800000`.
5. Broadcasts `{type:"PLAY", position:142.5, serverTimestamp:1713430800000}` to all 4 members.
6. Guest background workers relay to content scripts via `chrome.tabs.sendMessage`.
7. Content script sets `isApplyingRemote=true`.
8. Drift-corrected seek: `video.currentTime = 142.5 + (Date.now() - 1713430800000) / 1000`.
9. `video.play()` called.
10. `isApplyingRemote` cleared after 100ms.
11. SYNC_EVENTS INSERT queued async (non-blocking).

**Notes**:
- When a guest receives PLAY, they must seek to `position + (Date.now() - serverTimestamp) / 1000` before calling `play()`. Playing from the current position without seeking causes drift equal to round-trip latency.
- `isApplyingRemote=true` prevents the guest's resulting `play` DOM event from re-triggering a PLAY send to the server.

---

### PAUSE

**Direction**: client→server (host only), then server→all members

**Who can send**: host only. Non-host sends are silently dropped.

**Trigger**: Host presses pause on YouTube. Content script detects `pause` event on `<video>` (if `isApplyingRemote` is false).

**Client payload**:
```json
{
  "type": "PAUSE",
  "position": "number — exact video position in seconds at the moment of pause"
}
```

**Server broadcast payload**:
```json
{
  "type": "PAUSE",
  "position": "number — exact pause position in seconds",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender

**Server actions** (in order):
1. Validate — `position` must be a non-negative number. On failure: `INVALID_PAYLOAD` to sender, stop.
2. Check host — if sender ≠ host: **silent drop**, stop.
3. Check room status — if `ended`: `ROOM_CLOSED` to sender, stop.
4. Check sender in members — if not: `NOT_IN_ROOM`, stop.
5. `serverTimestamp = Date.now()`.
6. HSET `room:{roomId}:sync` `isPlaying=false position={position} last_event_at={serverTimestamp}`. Reset TTL.
7. Broadcast PAUSE to all members.
8. INSERT `SYNC_EVENTS` async: `event_type=pause, video_position_seconds={position}`.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:sync` | HSET | `isPlaying=false, position={position}, last_event_at={serverTimestamp}` | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| SYNC_EVENTS | INSERT | event_type=pause, video_position_seconds, server_timestamp, triggered_by_user_id, room_id, room_video_id | YES |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `position` missing or not a number | INVALID_PAYLOAD | Sender only |
| `position` is negative | INVALID_PAYLOAD | Sender only |
| Sender not in room | NOT_IN_ROOM | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**:
| Scenario | Why |
|----------|-----|
| Non-host sends PAUSE | Only host controls playback for the room |
| Guest's local `pause` DOM event while `isApplyingRemote=true` | Suppressed at content-script layer before reaching network |

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| PAUSE when already paused | Idempotent — Redis HSET is a no-op for state, broadcast fires |
| PAUSE + PLAY within 50ms | Both broadcast; last Redis write determines final `isPlaying` state |

**Notes**:
- `position` must be the exact snapshot at the moment of pause — not a stale cached value.
- When guests receive PAUSE: set `isApplyingRemote=true`, call `video.pause()` and `video.currentTime = event.position` (no drift compensation — video is stopped), clear `isApplyingRemote` after 100ms.

---

### SEEK

**Direction**: client→server (host only), then server→all members

**Who can send**: host only. Non-host sends are silently dropped.

**Trigger**: Host scrubs to a new position on YouTube. Content script detects `seeked` event on `<video>` (if `isApplyingRemote` is false).

**Client payload**:
```json
{
  "type": "SEEK",
  "position": "number — new video position in seconds"
}
```

**Server broadcast payload**:
```json
{
  "type": "SEEK",
  "position": "number — new position in seconds",
  "previousPosition": "number — position before seek (read from Redis at processing time)",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender

**Server actions** (in order):
1. Validate — `position` must be a non-negative number. On failure: `INVALID_PAYLOAD`, stop.
2. Check host — if sender ≠ host: **silent drop**, stop.
3. Check room status — if `ended`: `ROOM_CLOSED`, stop.
4. Check sender in members — if not: `NOT_IN_ROOM`, stop.
5. Read `position_s` and `isPlaying` from `room:{roomId}:sync`.
6. **Drift threshold check** (only when `isPlaying=true`): if `|position - position_s| * 1000 < DRIFT_THRESHOLD_MS (2000)` → **silent drop**. Skip this check when `isPlaying=false`.
7. `serverTimestamp = Date.now()`.
8. HSET `room:{roomId}:sync` `position={position} last_event_at={serverTimestamp}` (preserve `isPlaying`). Reset TTL.
9. Broadcast SEEK with `previousPosition = position_s` from step 5.
10. INSERT `SYNC_EVENTS` async: `event_type=seek, video_position_seconds={position}, previous_position_seconds={previousPosition}, seek_delta_seconds={position - previousPosition}`.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:sync` | HSET | `position={position}, last_event_at={serverTimestamp}` | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| SYNC_EVENTS | INSERT | event_type=seek, video_position_seconds, previous_position_seconds, seek_delta_seconds, server_timestamp, triggered_by_user_id, room_id, room_video_id | YES |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `position` missing or not a number | INVALID_PAYLOAD | Sender only |
| `position` is negative | INVALID_PAYLOAD | Sender only |
| Sender not in room | NOT_IN_ROOM | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**:
| Scenario | Why |
|----------|-----|
| Non-host sends SEEK | Only host controls playback position |
| Seek position within 2s of current Redis position while playing | Prevents drift-correction auto-seeks from looping back to server as new SEEK events |

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Host seeks twice within 100ms | Both pass threshold check, both update Redis (second wins), both broadcast — guests end at correct final position |
| SEEK while `isApplyingRemote=true` on guest | Content script suppresses the `seeked` DOM event — never sent to server |

**Notes**:
- When guests receive SEEK while **playing**: `video.currentTime = event.position + (Date.now() - event.serverTimestamp) / 1000`.
- When guests receive SEEK while **paused**: `video.currentTime = event.position` (no drift compensation).
- `previousPosition` in the broadcast is the Redis value at server processing time — it may differ from the host's local last-known position if there was a concurrent update.

---

### CHAT_MSG

**Direction**: client→server (any member), then server→all members

**Who can send**: any member (host or guest)

**Trigger**: Member submits a message in the chat panel.

**Client payload**:
```json
{
  "type": "CHAT_MSG",
  "text": "string — message text, 1–500 characters"
}
```

**Server broadcast payload**:
```json
{
  "type": "CHAT_MSG",
  "messageId": "string — server-generated cuid",
  "userId": "string",
  "displayName": "string — from auth record, never from payload",
  "avatarUrl": "string | null",
  "text": "string",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender

**Server actions** (in order):
1. Validate — `text` must be a non-empty string, length ≤ 500 (`MAX_MESSAGE_LENGTH`). On failure: `INVALID_PAYLOAD`, stop.
2. Check room status — if `ended`: `ROOM_CLOSED`, stop.
3. Check sender in members — if not: `NOT_IN_ROOM`, stop.
4. Look up sender's `displayName` and `avatarUrl` from auth record (ignore any displayName in payload).
5. `messageId = cuid()`. `serverTimestamp = Date.now()`.
6. LPUSH JSON of broadcast payload to `room:{roomId}:messages:recent`. LTRIM to 50. Reset TTL.
7. Broadcast CHAT_MSG to all members.
8. INSERT `MESSAGES` async: `room_id, user_id, content={text}, content_hash=SHA256(text), type=text, status=sent, created_at={serverTimestamp}, video_position_seconds` (read from Redis sync), `room_video_id`.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:messages:recent` | LPUSH + LTRIM 0 49 | JSON broadcast payload, capped at 50 | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| MESSAGES | INSERT | room_id, user_id, content, content_hash, type, status, created_at, video_position_seconds, room_video_id | YES |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `text` is empty | INVALID_PAYLOAD | Sender only |
| `text` exceeds 500 chars | INVALID_PAYLOAD | Sender only |
| `text` field missing | INVALID_PAYLOAD | Sender only |
| Sender not in room | NOT_IN_ROOM | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**: None — all validation failures surface an error.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Two messages within 50ms | Each gets its own `serverTimestamp` and `messageId`; chat panel orders by `serverTimestamp` |
| CHAT_MSG while ROOM_CLOSE is processing | ROOM_CLOSE has higher priority — by the time CHAT_MSG handler runs, room status is `ended` → ROOM_CLOSED error |
| Redis LPUSH fails | Broadcast still delivers to live members; Redis failure logged; new members joining will not see the message in ROOM_STATE |

**Notes**:
- `displayName` in the broadcast always comes from the server-side user record — never from the client payload. This prevents display name spoofing.
- `video_position_seconds` in the Postgres INSERT is read from `room:{roomId}:sync` at insert time, not sent by the client.
- After ROOM_CLOSE, `room:{roomId}:messages:recent` is kept for 24h so the `/room/{roomId}/ended` redirect page can display chat history.

---

### MEMBER_JOIN

**Direction**: server→clients only (server emits; clients never send this)

**Who can send**: server only

**Trigger**: A new member's WS upgrade completes successfully.

**Client payload**: N/A

**Server broadcast payload**:
```json
{
  "type": "MEMBER_JOIN",
  "userId": "string",
  "displayName": "string",
  "avatarUrl": "string | null",
  "role": "string — host | co_host | member",
  "joinedAt": "number — Unix ms",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members already in the room at time of join — the joining member is excluded (they receive ROOM_STATE instead)

**Server actions** (in order):
1. (ROOM_STATE already sent to new member.)
2. Assemble MEMBER_JOIN payload from user record.
3. Check `ROOM_MEMBERS` for existing `(room_id, user_id)` record:
   - **First join**: INSERT new row (`status=active`, `role=member` unless they are the room creator, `joined_at=now()`).
   - **Rejoin** (`status=left` row exists): UPDATE `status=active`, `joined_at=now()`, `left_at=NULL`; increment `metadata.rejoin_count`.
4. SADD `userId` to `room:{roomId}:members`. Reset TTL.
5. HSET `room:{roomId}:state` `member_count` incremented.
6. Broadcast MEMBER_JOIN to all existing members (not to the joiner).

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:members` | SADD | `{userId}` | reset to 24h |
| `room:{roomId}:state` | HSET | `member_count={new count}` | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| ROOM_MEMBERS | INSERT or UPDATE | role, status=active, joined_at, left_at=NULL | NO — must complete before broadcast |
| ROOMS | UPDATE | current_member_count + 1 | YES |

**Error cases**: Server-side only; logged internally. If `ROOM_MEMBERS` INSERT fails, drop the WS connection — client must reconnect.

**Silent drops**: N/A — server-initiated.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Two members join simultaneously | Each gets an independent MEMBER_JOIN broadcast; `current_member_count` incremented atomically via `UPDATE … SET current_member_count = current_member_count + 1` |
| Member joins while ROOM_CLOSE is processing | WS upgrade rejected with ROOM_CLOSED before MEMBER_JOIN fires |

**Notes**:
- A member who disconnects and reconnects follows the **rejoin** path — `ROOM_MEMBERS` row is updated, not duplicated. The `UNIQUE (room_id, user_id)` constraint enforces this.
- `role` in the broadcast reflects the member's current `ROOM_MEMBERS.role`. A co_host who rejoins retains their role.

---

### MEMBER_LEAVE

**Direction**: server→clients only (server emits on WS close)

**Who can send**: server only

**Trigger**: WS connection closes — normal close, error, or heartbeat timeout.

**Client payload**: N/A

**Server broadcast payload**:
```json
{
  "type": "MEMBER_LEAVE",
  "userId": "string — who left",
  "displayName": "string",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all remaining connected members (not the member who left — their connection is already closed)

**Server actions** (in order):
1. If departing member was the **host**:
   - If at least one member remains: select next host (remaining members sorted by `joined_at` ASC → earliest). Broadcast `HOST_SWITCH` first (see HOST_SWITCH for payload). Then proceed to step 2.
   - If no members remain: skip HOST_SWITCH and MEMBER_LEAVE broadcast (no recipients). Go to step 2.
2. SREM `userId` from `room:{roomId}:members`. On failure: log error, retry once.
3. DEL `ws:conn:{connectionId}` and `user:{userId}:ws_connection`.
4. Broadcast MEMBER_LEAVE to all remaining connected members.
5. UPDATE `ROOM_MEMBERS`: `status=left`, `left_at=now()`, `total_watch_time_seconds = EXTRACT(EPOCH FROM (now() - joined_at))` (async).
6. UPDATE `ROOMS.current_member_count - 1` (async).
7. If room is now empty: HSET `room:{roomId}:sync` `isPlaying=false`. Room is **not** closed.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:members` | SREM | `{userId}` | — |
| `room:{roomId}:state` | HSET | `member_count={new count}` | reset to 24h |
| `room:{roomId}:sync` | HSET (empty room only) | `isPlaying=false` | — |
| `ws:conn:{connectionId}` | DEL | — | — |
| `user:{userId}:ws_connection` | DEL | — | — |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| ROOM_MEMBERS | UPDATE | status=left, left_at=now(), total_watch_time_seconds | YES |
| ROOMS | UPDATE | current_member_count - 1 | YES |

**Error cases**: Server-side only; logged internally.

**Silent drops**: N/A — server-initiated.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Host leaves while guest sends PLAY | HOST_SWITCH fires first (higher priority); by the time PLAY is processed, the new host is set in Redis |
| Redis SREM fails after retries | Member appears online to others until TTL; critical error logged for alerting |

**Notes**:
- When the last member leaves, the room enters a quiet state — `isPlaying=false` in Redis, room status unchanged. The cleanup cron job transitions rooms with no heartbeat activity for 15 minutes to `abandoned`.
- Automatic host selection: `joined_at` ASC among remaining active members. Deterministic — no ambiguity.

---

### HOST_SWITCH

**Direction**: client→server (current host, manual) AND server→all clients (automatic on host disconnect)

**Who can send**: current host (manual trigger) or server (automatic trigger)

**Triggers**:
1. **Manual**: Current host explicitly transfers host role via popup UI.
2. **Automatic**: Server selects next host after current host disconnects.

**Client payload** (manual only):
```json
{
  "type": "HOST_SWITCH",
  "newHostId": "string — userId of the intended new host"
}
```

**Server broadcast payload**:
```json
{
  "type": "HOST_SWITCH",
  "previousHostId": "string",
  "newHostId": "string",
  "newHostDisplayName": "string",
  "reason": "string — manual | host_disconnected",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including old host and new host

**Server actions — manual path** (in order):
1. Validate — `newHostId` must be a non-empty string. On failure: `INVALID_PAYLOAD`, stop.
2. Check sender is current host (`room:{roomId}:state` `host_user_id`). On failure: `NOT_HOST`, stop.
3. Check room status — if `ended`: `ROOM_CLOSED`, stop.
4. SISMEMBER `room:{roomId}:members` `newHostId`. If not member: `MEMBER_NOT_FOUND`, stop.
5. `serverTimestamp = Date.now()`.
6. HSET `room:{roomId}:state` `host_user_id={newHostId}`. Reset TTL.
7. UPDATE `ROOM_MEMBERS` old host: `role=member` (async).
8. UPDATE `ROOM_MEMBERS` new host: `role=host` (async).
9. UPDATE `ROOMS.host_user_id = {newHostId}` (async).
10. INSERT `ROOM_MEMBER_ROLE_HISTORY` for both old and new host (async).
11. Broadcast HOST_SWITCH with `reason=manual`.

**Server actions — automatic path** (triggered from MEMBER_LEAVE disconnect flow):
1. Query remaining members from `room:{roomId}:members` Set; join with `ROOM_MEMBERS.joined_at` to sort ASC; select first.
2. If selected member disconnects before processing completes: re-run selection from remaining members.
3. Execute steps 5–11 above with `reason=host_disconnected`.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:state` | HSET | `host_user_id={newHostId}` | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| ROOM_MEMBERS (old host) | UPDATE | role=member | YES |
| ROOM_MEMBERS (new host) | UPDATE | role=host | YES |
| ROOMS | UPDATE | host_user_id={newHostId} | YES |
| ROOM_MEMBER_ROLE_HISTORY | INSERT ×2 | room_id, user_id, changed_by_user_id, previous_role, new_role, changed_at | YES |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `newHostId` missing | INVALID_PAYLOAD | Sender only |
| Sender is not current host | NOT_HOST | Sender only |
| `newHostId` not in room | MEMBER_NOT_FOUND | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**: None.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| HOST_SWITCH + PLAY arrive simultaneously | HOST_SWITCH processed first; PLAY validated against updated `host_user_id` |
| Manual double-click on transfer button | Second HOST_SWITCH fails with NOT_HOST (first updated Redis `host_user_id`) |
| Automatic: selected new host disconnects mid-processing | Re-run host selection from remaining active members |

**Notes**:
- After receiving HOST_SWITCH, the new host's client needs no special action — their next PLAY/PAUSE/SEEK is automatically accepted because the server reads `host_user_id` from Redis on every event.
- The old host also receives the broadcast (they are still connected during a manual transfer) and becomes a regular member.

---

### VIDEO_CHANGE

**Direction**: client→server (host only), then server→all members

**Who can send**: host only. Non-host sends return `NOT_HOST` error (not silently dropped — wrong URL warrants user feedback).

**Trigger**: Host navigates YouTube to a new video. Content script detects URL change and sends VIDEO_CHANGE.

**Client payload**:
```json
{
  "type": "VIDEO_CHANGE",
  "videoUrl": "string — full YouTube video URL"
}
```

**Server broadcast payload**:
```json
{
  "type": "VIDEO_CHANGE",
  "videoUrl": "string",
  "videoId": "string — extracted YouTube video ID",
  "title": "string | null — from oEmbed; null if fetch not yet complete",
  "thumbnailUrl": "string | null",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender

**Server actions** (in order):
1. Validate — `videoUrl` must be a non-empty string. On failure: `INVALID_PAYLOAD`, stop.
2. Validate `videoUrl` matches YouTube URL pattern (`youtube.com/watch?v=` or `youtu.be/`). On failure: `INVALID_VIDEO_URL`, stop.
3. Check sender is host. On failure: `NOT_HOST`, stop.
4. Check room status — if `ended`: `ROOM_CLOSED`, stop.
5. Check sender in members — if not: `NOT_IN_ROOM`, stop.
6. Extract `videoId` from URL.
7. `serverTimestamp = Date.now()`.
8. HSET `room:{roomId}:sync` `isPlaying=false position=0 last_event_at={serverTimestamp}`. Reset TTL.
9. Broadcast VIDEO_CHANGE immediately (with `title=null`, `thumbnailUrl=null` until oEmbed completes).
10. Async (non-blocking, do not await):
    - Fetch YouTube oEmbed metadata for `videoId`.
    - UPDATE previous `ROOM_VIDEOS` row: `is_current=false`.
    - INSERT new `ROOM_VIDEOS` row: `is_current=true`, populate `title`, `thumbnail_url`, `platform_video_id`, etc.
    - UPDATE `ROOMS.current_video_id` to new row id.
    - HSET `room:{roomId}:state` `current_video_id={new id}`.
11. INSERT `SYNC_EVENTS` async: `event_type=video_change`.

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:sync` | HSET | `isPlaying=false, position=0, last_event_at={serverTimestamp}` | reset to 24h |
| `room:{roomId}:state` | HSET (async, after insert) | `current_video_id={id}` | reset to 24h |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| ROOM_VIDEOS (old) | UPDATE | is_current=false | YES |
| ROOM_VIDEOS (new) | INSERT | room_id, added_by_user_id, platform, platform_video_id, video_url, title, thumbnail_url, is_current=true, added_at | YES |
| ROOMS | UPDATE | current_video_id | YES |
| SYNC_EVENTS | INSERT | event_type=video_change, server_timestamp | YES |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `videoUrl` missing | INVALID_PAYLOAD | Sender only |
| Not a YouTube URL | INVALID_VIDEO_URL | Sender only |
| Sender not host | NOT_HOST | Sender only |
| Sender not in room | NOT_IN_ROOM | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**: None.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Host changes video twice in rapid succession | Both broadcast; second wins in Redis and DB (`current_video_id`); first metadata fetch writes to its own ROOM_VIDEOS row — harmless |
| oEmbed fetch fails | Video changes; `title` and `thumbnailUrl` remain null; `ROOM_VIDEOS.metadata_fetched=false`, `metadata_fetch_error` populated; non-blocking |

**Notes**:
- Clients navigate on receive: content script calls `window.location.href = event.videoUrl`.
- Guests not currently on a YouTube tab: background worker opens a new tab or navigates an existing YouTube tab to the new URL.
- `isPlaying` is reset to `false` and `position` to `0` on every VIDEO_CHANGE. The host must press play on the new video to start synchronized playback.
- The broadcast fires before metadata is fetched. Clients display the video with no title/thumbnail initially; metadata can be fetched client-side or pushed via a follow-up message.

---

### REACTION

**Direction**: client→server (any member), then server→all members

**Who can send**: any member (host or guest)

**Trigger**: Member clicks an emoji reaction button in the UI overlay.

**Client payload**:
```json
{
  "type": "REACTION",
  "emoji": "string — one of: 🎉 😂 ❤️ 😮 👏 🔥"
}
```

**Server broadcast payload**:
```json
{
  "type": "REACTION",
  "userId": "string",
  "displayName": "string",
  "emoji": "string",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender

**Server actions** (in order):
1. Validate — `emoji` must be a non-empty string. On failure: `INVALID_PAYLOAD`, stop.
2. Check `emoji` is in the allowed set: `['🎉','😂','❤️','😮','👏','🔥']`. On failure: `INVALID_EMOJI`, stop.
3. Check room status — if `ended`: `ROOM_CLOSED`, stop.
4. Check sender in members — if not: `NOT_IN_ROOM`, stop.
5. `serverTimestamp = Date.now()`.
6. Broadcast REACTION to all members.
7. INSERT `VIDEO_REACTIONS` async: `room_id, room_video_id, user_id, emoji, emoji_name, video_position_seconds` (from Redis sync), `created_at={serverTimestamp}, members_in_room_at_time`.

**Redis updates**: None — reactions are ephemeral.

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| VIDEO_REACTIONS | INSERT | room_id, room_video_id, user_id, emoji, emoji_name, video_position_seconds, created_at, members_in_room_at_time | YES — fire and forget |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| `emoji` missing | INVALID_PAYLOAD | Sender only |
| `emoji` not in allowed set | INVALID_EMOJI | Sender only |
| Sender not in room | NOT_IN_ROOM | Sender only |
| Room is closed | ROOM_CLOSED | Sender only |

**Silent drops**: None.

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| 5 reactions arrive simultaneously from different members | All 5 broadcast independently; content script renders each with a randomized `left` CSS offset to stagger animations |

**Notes**:
- The emoji allowlist is a security control. Arbitrary strings from clients could include injection payloads or oversized Unicode. Never trust client emoji without validation.
- Content script receives REACTION: inject a floating `<div>` into the YouTube page `<body>` (not inside the player iframe) with the emoji character; apply `float-up` CSS keyframe animation; remove element after animation completes.
- The sender receives their own reaction in the broadcast — this serves as send confirmation.

---

### ROOM_CLOSE

**Direction**: client→server (host only, via `navigator.sendBeacon`) AND server-internal (triggered by `DELETE /rooms/:id`)

**Who can send**: host (external) or server (internal)

**Triggers**:
1. **Tab close**: YouTube tab's `beforeunload` fires. Extension sends ROOM_CLOSE via `navigator.sendBeacon`. (`sendMessage` is unreliable during `beforeunload` — Chrome may terminate the background worker before it completes.)
2. **Explicit close**: Host clicks "End Room" in the extension popup → calls `DELETE /rooms/:id` REST endpoint → server triggers ROOM_CLOSE internally.

**Client payload**:
```json
{
  "type": "ROOM_CLOSE"
}
```

No additional fields. All state is derived server-side.

**Server broadcast payload**:
```json
{
  "type": "ROOM_CLOSE",
  "reason": "string — host_closed | tab_closed | admin_closed",
  "serverTimestamp": "number — Unix ms"
}
```

**Recipients**: all members including sender (if still connected)

**Server actions** (in order):
1. Check sender is host (`room:{roomId}:state` `host_user_id`) OR request is internal (from `DELETE /rooms/:id` route). On failure: `NOT_HOST` to sender, stop.
2. Check room status — if already `ended`: **no-op** (idempotent close), stop.
3. UPDATE `ROOMS`: `status=ended`, `end_reason=host_ended`, `ended_at=now()` in Postgres. **Blocking** — must complete before broadcast to ensure consistency.
4. HSET `room:{roomId}:state` `status=ended`.
5. Broadcast ROOM_CLOSE to all connected members.
6. Close all WS connections for this room (send WS close frame after broadcast).
7. DEL `room:{roomId}:members`.
8. DEL `room:{roomId}:sync`.
9. Keep `room:{roomId}:messages:recent` — do NOT delete. The `/room/{roomId}/ended` page reads this for 24h until TTL expires.
10. Call Daily.co API to delete the Daily room async (non-blocking; failures logged but never retried synchronously).

**Redis updates**:
| Key | Operation | Value | TTL |
|-----|-----------|-------|-----|
| `room:{roomId}:state` | HSET | `status=ended` | — |
| `room:{roomId}:members` | DEL | — | — |
| `room:{roomId}:sync` | DEL | — | — |
| `room:{roomId}:messages:recent` | (keep) | — | 24h (existing TTL) |

**Postgres updates**:
| Table | Operation | Columns | Async? |
|-------|-----------|---------|--------|
| ROOMS | UPDATE | status=ended, end_reason=host_ended, ended_at=now() | NO — blocking |

**Error cases**:
| Scenario | Error code | Who receives error |
|----------|-----------|-------------------|
| Sender is not host | NOT_HOST | Sender only |
| Room already `ended` | (idempotent — no error) | — |

**Silent drops**:
| Scenario | Why |
|----------|-----|
| ROOM_CLOSE when room is already `ended` | Idempotent — beacon may deliver twice on flaky connections |

**Race conditions**:
| Scenario | How handled |
|----------|-------------|
| Beacon sent; host reconnects before processing | ROOM_CLOSE processed → room ends → reconnect attempt rejected with ROOM_CLOSED |
| CHAT_MSG in flight during ROOM_CLOSE | ROOM_CLOSE is higher priority; CHAT_MSG handler checks status → ROOM_CLOSED error |
| Beacon lost (dropped packet) | Room stays `active` in DB/Redis; cleanup cron runs every 15 minutes and closes rooms with no heartbeat |

**Notes**:
- `navigator.sendBeacon` is used in `beforeunload` because Chrome terminates extension background workers during tab close, making `sendMessage` unreliable. Beacons are queued at the browser level and survive background worker termination.
- Guests already disconnected before ROOM_CLOSE fires: they see ROOM_CLOSED on their next connection attempt.
- Guests who receive ROOM_CLOSE: redirect to `{APP_URL}/room/{roomId}/ended`.
- A guest typing when ROOM_CLOSE arrives: the in-progress message is discarded; the guest is redirected immediately.
- Use `status=ended` for host-closed rooms. Use `status=abandoned` for rooms closed by the cleanup cron (no heartbeat for 15 minutes). The ROOMS schema CHECK constraint includes both.

---

## State Machine

```
WAITING ──────────────────────────────► ACTIVE
         first member joins; video loads

ACTIVE ────────────────────────────────► PAUSED
         all members disconnect; host may reconnect

ACTIVE ────────────────────────────────► ENDED
         ROOM_CLOSE received (host or DELETE /rooms/:id)

PAUSED ────────────────────────────────► ACTIVE
         host reconnects; MEMBER_JOIN processed

PAUSED ────────────────────────────────► ABANDONED
         15-minute TTL exceeded; cleanup cron fires

ENDED      [terminal — no transitions]
ABANDONED  [terminal — no transitions]
```

**Notes**:
- `PAUSED` (room status) is distinct from the video being paused. A room with `status=paused` means all members have disconnected and the room is holding for the host to return. Video playback state (`isPlaying`) is tracked separately in `room:{roomId}:sync`.
- The cleanup cron checks all rooms with `status=active|paused` in Redis. Rooms with no WS heartbeat for >15 minutes are transitioned to `abandoned` in Postgres and removed from Redis.

---

## Event Priority Order

When multiple events arrive simultaneously, the server processes them in this order:

| Priority | Events | Reason |
|----------|--------|--------|
| 1 — highest | ROOM_CLOSE | Terminates the room — must preempt all other events |
| 2 | HOST_SWITCH | Determines who is host — must resolve before PLAY/PAUSE/SEEK validation |
| 3 | PLAY / PAUSE / SEEK | Core sync — processed before membership or cosmetic events |
| 4 | VIDEO_CHANGE | Changes content — higher priority than membership updates |
| 5 | MEMBER_JOIN / MEMBER_LEAVE | Membership — affects broadcast recipients but not sync state |
| 6 — lowest | CHAT_MSG / REACTION | Cosmetic — lowest impact, safe to process last |

---

## Payload Size Limits

| Event | Max payload size | Notes |
|-------|-----------------|-------|
| CHAT_MSG | ~600 bytes | Text ≤ 500 chars + metadata |
| REACTION | ~100 bytes | Single emoji + type |
| PLAY / PAUSE | ~100 bytes | Position float + type |
| SEEK | ~150 bytes | Position + previousPosition + type |
| VIDEO_CHANGE (client) | ~300 bytes | URL + type |
| HOST_SWITCH (client) | ~100 bytes | newHostId + type |
| VIDEO_CHANGE (broadcast) | ~2 KB | URL + title + thumbnailUrl + metadata |
| ROOM_STATE | ~50 KB | 50 messages × ~500 chars + 10 members × profile data |

The server rejects any WebSocket frame exceeding **64 KB**. Frames above this limit return `INVALID_PAYLOAD` and close the connection.

---

## Testing Matrix

| Event | Test Scenario | Expected Result |
|-------|--------------|----------------|
| ROOM_STATE | Connect to active room mid-play | `hostPosition` = `position_s + elapsed`, `isPlaying=true`, last 50 messages present |
| ROOM_STATE | Connect to paused room | `isPlaying=false`, `hostPosition` = static `position_s` |
| ROOM_STATE | Reconnect | ROOM_STATE sent again; client reconciles to `hostPosition` |
| ROOM_STATE | Redis unavailable on connect | WS upgrade rejected with 503 |
| ROOM_STATE | Room status `ended` on connect | WS upgrade rejected with 409 ROOM_CLOSED |
| PLAY | Host sends valid PLAY | All members receive PLAY broadcast with `serverTimestamp`; Redis `isPlaying=true` |
| PLAY | Guest sends PLAY | Silent drop — no broadcast, no error to sender |
| PLAY | PLAY when already playing | Broadcast fires; Redis `isPlaying` unchanged; guests re-apply drift |
| PLAY | `position` negative | INVALID_PAYLOAD to sender only |
| PLAY | `position` field missing | INVALID_PAYLOAD to sender only |
| PLAY | Room is `ended` | ROOM_CLOSED to sender only |
| PAUSE | Host sends valid PAUSE | All members receive PAUSE with exact position; Redis `isPlaying=false` |
| PAUSE | Guest sends PAUSE | Silent drop |
| PAUSE | PAUSE when already paused | Idempotent — broadcast fires |
| SEEK | Host seeks forward >2s while playing | SEEK broadcast; `previousPosition` in payload; Redis `position` updated |
| SEEK | Host seeks backward >2s while playing | SEEK broadcast; `seek_delta_seconds` negative in SYNC_EVENTS |
| SEEK | Guest sends SEEK | Silent drop |
| SEEK | Seek within 2s of current position while playing | Silent drop (drift threshold guard) |
| SEEK | Seek any distance while paused | Always applies — no threshold check |
| SEEK | Two seeks within 100ms | Both broadcast; second `position` wins in Redis |
| CHAT_MSG | Any member sends valid message ≤500 chars | All members receive broadcast; Redis list updated; MESSAGES INSERT queued |
| CHAT_MSG | Empty text | INVALID_PAYLOAD to sender |
| CHAT_MSG | Text 501 chars | INVALID_PAYLOAD to sender |
| CHAT_MSG | Payload includes `displayName` | Server ignores payload `displayName`; broadcast uses auth record value |
| CHAT_MSG | Room `ended` | ROOM_CLOSED to sender |
| CHAT_MSG | Redis LPUSH fails | Broadcast still fires to live members; error logged |
| MEMBER_JOIN | New member joins active room | ROOM_STATE to new member; MEMBER_JOIN broadcast to existing members |
| MEMBER_JOIN | Existing member rejoins | ROOM_MEMBERS updated (not duplicated); `metadata.rejoin_count` incremented |
| MEMBER_JOIN | Room at max capacity | WS upgrade rejected 429; no MEMBER_JOIN fired |
| MEMBER_LEAVE | Active member disconnects | MEMBER_LEAVE broadcast to remaining members; ROOM_MEMBERS updated async |
| MEMBER_LEAVE | Host disconnects (members remain) | HOST_SWITCH broadcast first, then MEMBER_LEAVE; new host is earliest `joined_at` |
| MEMBER_LEAVE | Last member leaves | No broadcast (no recipients); room `isPlaying=false` in Redis; room NOT closed |
| MEMBER_LEAVE | Redis SREM fails | Error logged; retry once; presence stale until TTL if retry fails |
| HOST_SWITCH | Current host manually transfers | HOST_SWITCH broadcast to all; Redis `host_user_id` updated; DB updated async |
| HOST_SWITCH | Non-host sends HOST_SWITCH | NOT_HOST error to sender |
| HOST_SWITCH | `newHostId` not in room | MEMBER_NOT_FOUND error to sender |
| HOST_SWITCH | `newHostId` field missing | INVALID_PAYLOAD to sender |
| HOST_SWITCH | Automatic on host disconnect | HOST_SWITCH broadcast before MEMBER_LEAVE; selection by `joined_at` ASC |
| HOST_SWITCH | Selected new host disconnects before processing | Re-run host selection from remaining members |
| VIDEO_CHANGE | Host sends valid YouTube URL | All members receive VIDEO_CHANGE; Redis reset `isPlaying=false, position=0` |
| VIDEO_CHANGE | Non-host sends VIDEO_CHANGE | NOT_HOST error to sender |
| VIDEO_CHANGE | Not a YouTube URL | INVALID_VIDEO_URL to sender |
| VIDEO_CHANGE | oEmbed fetch fails | Video changes; broadcast fires with `title=null, thumbnailUrl=null`; error logged |
| VIDEO_CHANGE | Host changes video twice quickly | Both broadcast; second wins in Redis and DB |
| REACTION | Member sends valid emoji | All members receive REACTION including sender; float-up animation rendered |
| REACTION | Unknown emoji string | INVALID_EMOJI to sender |
| REACTION | 5 simultaneous reactions from 5 members | All 5 broadcast; staggered horizontal positions in content script |
| REACTION | Sender receives own reaction | Yes — confirmation of successful send |
| ROOM_CLOSE | Host closes room | All members receive ROOM_CLOSE; WS connections closed; ROOMS.status=ended in DB |
| ROOM_CLOSE | Non-host sends ROOM_CLOSE | NOT_HOST to sender |
| ROOM_CLOSE | Room already `ended` | Idempotent — no error, no action |
| ROOM_CLOSE | Beacon fails (packet dropped) | Room stays active; cleanup cron closes after 15 min with no heartbeat |
| ROOM_CLOSE | Guest typing when ROOM_CLOSE arrives | Message discarded; guest redirected to `/room/{roomId}/ended` |
