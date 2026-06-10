# Binge-Room Architecture Overview

## System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (User A)                                                │
│  ┌────────────┐     chrome.runtime.sendMessage      ┌─────────┐ │
│  │   Popup    │ ◄─────────────────────────────────► │  Bg SW  │ │
│  │  (React)   │                                     │(Socket) │ │
│  └────────────┘                                     └────┬────┘ │
│                                                          │      │
│  ┌────────────────────────────────────────┐             │      │
│  │  YouTube Tab                           │   tabs.msg  │      │
│  │  ┌──────────┐  ┌──────────┐           │ ◄───────────┘      │
│  │  │ Content  │  │ YouTube  │           │                     │
│  │  │  Script  │─►│ Adapter  │           │                     │
│  │  │          │  └──────────┘           │                     │
│  │  │ SyncEngine│                        │                     │
│  │  │ ToastMgr │                         │                     │
│  │  │ Overlay  │                         │                     │
│  │  └──────────┘                         │                     │
│  └────────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
                         │ WebSocket (Socket.IO)
                         ▼
         ┌──────────────────────────────┐
         │   Binge-Room Server           │
         │   Express + Socket.IO        │
         │                              │
         │  ┌──────────┐ ┌──────────┐  │
         │  │  Socket  │ │  Room    │  │
         │  │ Gateway  │ │ Service  │  │
         │  └──────────┘ └──────────┘  │
         │         │          │        │
         │         └────┬─────┘        │
         │              │              │
         │         ┌────▼─────┐        │
         │         │  Redis   │        │
         │         └──────────┘        │
         └──────────────────────────────┘
```

## Data Flow: Host Presses PLAY

```
1. YouTube video.play event fires
2. YouTubeAdapter.onPlay() callback triggered
3. SyncEngine receives (not suppressed — applying=false)
4. SyncEngine calls chrome.runtime.sendMessage VIDEO_EVENT PLAY
5. Background SW receives message
6. Background emits PLAY socket event to server
7. Server validates payload with Zod
8. Server updates Redis videoState
9. Server broadcasts SYNC_UPDATE to all room members
10. Each client's BG SW receives SYNC_UPDATE
11. BG SW forwards SYNC_COMMAND to content script via tabs.sendMessage
12. SyncEngine.applySync() called — applying=true
13. YouTubeAdapter.play() called (drift-corrected)
14. applying=false after 100ms
```

## Key Design Decisions

### Feedback Loop Prevention
The `applying` flag in `SyncEngine` prevents the engine from re-emitting
events it triggered itself. The server also ignores events from the same
socket that triggered the update (the `triggeredBy` check on clients).

### Host Authority
All sync events from all users are forwarded to the server. The server
is the single source of truth — it accepts events from anyone in the
room and broadcasts to everyone else. The host concept determines who
controls video navigation but doesn't affect event validation.

### MV3 Service Worker Persistence
Manifest V3 service workers can be terminated after ~30 seconds of
inactivity. Binge-Room uses a keepalive alarm (`chrome.alarms`) to
ping the server every 24 seconds while in an active room.

### Shadow DOM Isolation
Both `ToastManager` and `RoomOverlay` use Shadow DOM to prevent
CSS conflicts with YouTube's page styles.

### Platform Adapter Pattern
Adding Netflix/Prime/etc. = create a new class extending `BaseAdapter`,
implement all abstract methods, register with `AdapterRegistry`. Zero
changes to `SyncEngine` or the background worker.
