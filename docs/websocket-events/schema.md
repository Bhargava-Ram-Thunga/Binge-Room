# WebSocket Event Schema

All events use Socket.IO over WebSocket transport.

## Client → Server

| Event | Payload | Description |
|---|---|---|
| `create_room` | `CreateRoomPayload` | Create a new room |
| `join_room` | `JoinRoomPayload` | Join by roomId or 6-digit code |
| `leave_room` | _(none)_ | Leave current room |
| `play` | `PlayPayload` | User pressed play |
| `pause` | `PausePayload` | User pressed pause |
| `seek` | `SeekPayload` | User seeked to timestamp |
| `video_change` | `VideoChangePayload` | Host navigated to new video |
| `ad_start` | `AdStartPayload` | Ad detected on this client |
| `ad_end` | `AdEndPayload` | Ad finished |
| `sync_state` | `{ roomId }` | Pull current room state |
| `ping` | `{ clientTime: number }` | RTT measurement |

## Server → Client

| Event | Payload | Description |
|---|---|---|
| `room_created` | `RoomJoinedPayload` | Room created successfully |
| `room_joined` | `RoomJoinedPayload` | Successfully joined room |
| `user_joined` | `UserJoinedPayload` | Another user joined |
| `user_left` | `UserLeftPayload` | User disconnected/left |
| `sync_update` | `SyncUpdatePayload` | Broadcast video state change |
| `room_state` | `RoomStatePayload` | Full room state snapshot |
| `host_changed` | `HostChangedPayload` | Host role transferred |
| `pong` | `PongPayload` | RTT reply |
| `error` | `ErrorPayload` | Server-side error |

## Example Payloads

### `join_room`
```json
{
  "code": "AB12CD",
  "userName": "Rahul",
  "platform": "youtube"
}
```

### `sync_update` (broadcast)
```json
{
  "videoState": {
    "videoId": "dQw4w9WgXcQ",
    "currentTime": 42.5,
    "isPlaying": true,
    "isAdPlaying": false,
    "lastUpdated": 1716700000000,
    "updatedBy": "socket_abc123"
  },
  "serverTime": 1716700000005,
  "triggeredBy": "socket_abc123",
  "triggeredByName": "Rahul",
  "action": "PLAY"
}
```

## Error Codes

| Code | Meaning |
|---|---|
| `ROOM_NOT_FOUND` | No room with that ID/code |
| `ROOM_FULL` | Room has reached MAX_ROOM_USERS (20) |
| `INVALID_PAYLOAD` | Zod validation failed |
| `RATE_LIMITED` | Too many events from this socket |
