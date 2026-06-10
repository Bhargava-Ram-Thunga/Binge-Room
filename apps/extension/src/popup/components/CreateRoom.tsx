import React, { useState, useEffect } from "react";
import { roomService } from "../../services/room.service.js";
import { useRoomStore } from "../../store/room.store.js";

interface Props {
  onBack: () => void;
}

export default function CreateRoom({ onBack }: Props) {
  const { setError, error, isCreating, setCreating } = useRoomStore();
  const [name, setName] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState("");

  useEffect(() => {
    setError(null);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      if (url.includes("youtube.com/watch") || url.includes("youtu.be")) {
        setVideoUrl(url);
        const m =
          url.match(/[?&]v=([^&#]+)/) ?? url.match(/youtu\.be\/([^?#]+)/);
        if (m) setVideoId(m[1]);
      }
    });
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Enter your display name");
      return;
    }
    setCreating(true);
    setError(null);
    const res = await roomService.createRoom(
      name.trim(),
      videoUrl || undefined,
    );
    setCreating(false);
    if (!res.success)
      setError(res.error ?? "Failed to create room. Is the server running?");
  };

  return (
    <div
      className="animate-fadeSlideUp"
      style={{
        paddingTop: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#64748b",
          fontSize: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          width: "fit-content",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back
      </button>

      {/* Title */}
      <div>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#f1f5f9",
            marginBottom: 2,
          }}
        >
          Create a Room
        </h2>
        <p style={{ fontSize: 12, color: "#475569" }}>
          Share the 6-digit code with friends.
        </p>
      </div>

      {/* Name input */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: ".05em",
          }}
        >
          Display Name
        </label>
        <input
          className="input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="e.g. Dinesh"
          maxLength={32}
          autoFocus
        />
      </div>

      {/* Video card */}
      {videoId ? (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(99,102,241,.2)",
            background: "rgba(15,23,42,.8)",
          }}
        >
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt="thumbnail"
            style={{
              width: "100%",
              height: 90,
              objectFit: "cover",
              display: "block",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div
            style={{
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: "#94a3b8",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {videoUrl.replace("https://www.youtube.com/watch?v=", "yt/")}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(245,158,11,.07)",
            border: "1px solid rgba(245,158,11,.2)",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
          <p style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>
            Open a YouTube video first — everyone in the room will be sent to
            the same video.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "9px 12px",
            borderRadius: 9,
            background: "rgba(239,68,68,.08)",
            border: "1px solid rgba(239,68,68,.25)",
          }}
        >
          <p style={{ fontSize: 12, color: "#f87171" }}>{error}</p>
        </div>
      )}

      {/* CTA */}
      <button
        className="btn-primary"
        onClick={handleCreate}
        disabled={isCreating}
      >
        {isCreating ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 13,
                height: 13,
                border: "2px solid rgba(255,255,255,.3)",
                borderTopColor: "#fff",
                borderRadius: "50%",
              }}
              className="animate-spin-sm"
            />
            Creating…
          </span>
        ) : (
          "+ Create Room"
        )}
      </button>
    </div>
  );
}
