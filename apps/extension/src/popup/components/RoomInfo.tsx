import React, { useState } from "react";
import { roomService } from "../../services/room.service.js";
import { useRoomStore } from "../../store/room.store.js";
import { buildInviteLink, formatTime } from "@binge-room/shared-utils";
import type { Room, User } from "../../types/index.js";

interface Props {
  room: Room;
  user: User;
}

export default function RoomInfo({ room, user }: Props) {
  const { setRoom, setCurrentUser, isConnected } = useRoomStore();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  const controlsLocked = room.controlsLocked ?? true;

  const toggleControls = async () => {
    if (!user.isHost || togglingLock) return;
    setTogglingLock(true);
    await roomService.toggleControls(!controlsLocked);
    setTogglingLock(false);
  };

  const inviteLink = buildInviteLink(room.code);
  const vs = room.videoState;

  const copy = async (type: "code" | "link") => {
    await navigator.clipboard.writeText(
      type === "code" ? room.code : inviteLink,
    );
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const leave = async () => {
    setLeaving(true);
    await roomService.leaveRoom();
    setRoom(null);
    setCurrentUser(null);
  };

  return (
    <div
      className="animate-fadeSlideUp"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 16px 16px",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "linear-gradient(135deg,#6366f1,#a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>
            Binge-Room
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 9px",
            borderRadius: 20,
            background: isConnected
              ? "rgba(34,197,94,.1)"
              : "rgba(239,68,68,.1)",
            border: `1px solid ${isConnected ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isConnected ? "#22c55e" : "#ef4444",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: isConnected ? "#4ade80" : "#f87171",
            }}
          >
            {isConnected ? "Synced" : "Reconnecting…"}
          </span>
        </div>
      </div>

      {/* Room code card */}
      <div
        style={{
          borderRadius: 12,
          background:
            "linear-gradient(135deg,rgba(99,102,241,.12),rgba(168,85,247,.08))",
          border: "1px solid rgba(99,102,241,.2)",
          padding: "12px 14px",
        }}
      >
        <p
          style={{
            fontSize: 10,
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom: 6,
          }}
        >
          Room Code
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 6,
              color: "#f1f5f9",
              fontFamily: "monospace",
            }}
          >
            {room.code}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {/* Copy code */}
            <button
              onClick={() => copy("code")}
              title="Copy code"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(99,102,241,.15)",
                border: "1px solid rgba(99,102,241,.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background .15s",
              }}
            >
              {copied === "code" ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
            {/* Copy invite link */}
            <button
              onClick={() => copy("link")}
              title="Copy invite link"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(99,102,241,.15)",
                border: "1px solid rgba(99,102,241,.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              {copied === "link" ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {copied && (
          <p style={{ fontSize: 10, color: "#4ade80", marginTop: 4 }}>
            {copied === "code" ? "Code copied!" : "Invite link copied!"}
          </p>
        )}
      </div>

      {/* Now playing */}
      <div
        style={{
          borderRadius: 11,
          background: "rgba(15,23,42,.7)",
          border: "1px solid rgba(99,102,241,.12)",
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: vs.isAdPlaying
                ? "rgba(245,158,11,.15)"
                : vs.isPlaying
                  ? "rgba(34,197,94,.15)"
                  : "rgba(100,116,139,.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {vs.isAdPlaying ? (
              <span style={{ fontSize: 13 }}>📺</span>
            ) : vs.isPlaying ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#22c55e">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#64748b">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: vs.isAdPlaying
                  ? "#fbbf24"
                  : vs.isPlaying
                    ? "#4ade80"
                    : "#64748b",
              }}
            >
              {vs.isAdPlaying
                ? "Ad Playing"
                : vs.isPlaying
                  ? "Playing"
                  : "Paused"}
            </p>
            {vs.videoId && (
              <p
                style={{
                  fontSize: 10,
                  color: "#475569",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                youtube.com/watch?v={vs.videoId}
              </p>
            )}
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#94a3b8",
              flexShrink: 0,
            }}
          >
            {formatTime(vs.currentTime)}
          </span>
        </div>
      </div>

      {/* Controls lock — host only */}
      {user.isHost && (
        <button
          onClick={toggleControls}
          disabled={togglingLock}
          title={
            controlsLocked
              ? "Allow everyone to control playback"
              : "Restrict playback to host only"
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "9px 12px",
            borderRadius: 10,
            cursor: "pointer",
            background: controlsLocked
              ? "rgba(99,102,241,.1)"
              : "rgba(34,197,94,.08)",
            border: `1px solid ${controlsLocked ? "rgba(99,102,241,.3)" : "rgba(34,197,94,.25)"}`,
            transition: "background .15s, border-color .15s",
            opacity: togglingLock ? 0.6 : 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>{controlsLocked ? "🔒" : "🔓"}</span>
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: controlsLocked ? "#818cf8" : "#4ade80",
                  marginBottom: 1,
                }}
              >
                {controlsLocked ? "Host controls only" : "Everyone can control"}
              </p>
              <p style={{ fontSize: 10, color: "#475569" }}>
                {controlsLocked
                  ? "Tap to unlock for everyone"
                  : "Tap to restrict to host"}
              </p>
            </div>
          </div>
          {/* Toggle pill */}
          <div
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              position: "relative",
              background: controlsLocked ? "#6366f1" : "#22c55e",
              transition: "background .2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 2,
                left: controlsLocked ? 2 : 18,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .2s",
                boxShadow: "0 1px 3px rgba(0,0,0,.3)",
              }}
            />
          </div>
        </button>
      )}

      {/* Participants */}
      <div>
        <p
          style={{
            fontSize: 10,
            color: "#475569",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom: 8,
          }}
        >
          {room.users.length} Watching
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 5,
            maxHeight: 110,
            overflowY: "auto",
          }}
        >
          {room.users.map((u) => (
            <div
              key={u.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "7px 10px",
                borderRadius: 9,
                background: "rgba(15,23,42,.7)",
                border: "1px solid rgba(99,102,241,.1)",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: `hsl(${hashColor(u.name)},65%,50%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {u.name[0]?.toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: "#e2e8f0",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {u.name}
              </span>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                {u.id === user.id && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#818cf8",
                      background: "rgba(99,102,241,.12)",
                      border: "1px solid rgba(99,102,241,.2)",
                      borderRadius: 5,
                      padding: "1px 6px",
                      fontWeight: 600,
                    }}
                  >
                    YOU
                  </span>
                )}
                {u.isHost && (
                  <span
                    style={{
                      fontSize: 9,
                      color: "#fbbf24",
                      background: "rgba(245,158,11,.1)",
                      border: "1px solid rgba(245,158,11,.2)",
                      borderRadius: 5,
                      padding: "1px 6px",
                      fontWeight: 600,
                    }}
                  >
                    HOST
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leave */}
      <button
        onClick={leave}
        disabled={leaving}
        style={{
          padding: "9px 14px",
          borderRadius: 10,
          background: "rgba(239,68,68,.06)",
          border: "1px solid rgba(239,68,68,.2)",
          color: "#f87171",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "background .15s",
          opacity: leaving ? 0.5 : 1,
        }}
      >
        {leaving ? "Leaving…" : "Leave Room"}
      </button>
    </div>
  );
}

function hashColor(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
}
