import React from "react";

// ── PARSERS & SERIALIZERS ──

export const parseLikes = (raw) => {
  if (raw == null || raw === "" || raw === "0") return [];
  return String(raw).split(",").map(s => s.trim()).filter(Boolean);
};

export const parsePostTitle = (raw) => {
  if (!raw) return { caption: "", tags: [] };
  const parts = raw.split(" || tags:");
  return {
    caption: parts[0] || "",
    tags: parts[1] ? parts[1].split(",").map(t => t.trim()).filter(Boolean) : []
  };
};

export const parseComments = (raw) => {
  if (raw == null || raw === "") return [];
  return String(raw).split("||").map(s => s.trim()).filter(Boolean).map(entry => {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) return { user: "unknown", text: entry };
    return { user: entry.slice(0, colonIdx).trim(), text: entry.slice(colonIdx + 1).trim() };
  });
};

export const serializeComments = (arr) => arr.map(c => `${c.user}:${c.text}`).join("||");

export const parseFollowList = (raw) => {
  if (raw == null || raw === "" || raw === "0") return [];
  return [...new Set(String(raw).split(",").map(s => s.trim()).filter(Boolean))];
};

export const serializeFollowList = (arr) => [...new Set(arr)].join(",");

export const calculateMatchScore = (myProfile, otherProfile) => {
  if (!myProfile || !otherProfile) return 0;
  const myInterests = myProfile.interests
    ? myProfile.interests.split(",").map(i => i.trim().toLowerCase()).filter(Boolean)
    : [];
  const otherInterests = otherProfile.interests
    ? otherProfile.interests.split(",").map(i => i.trim().toLowerCase()).filter(Boolean)
    : [];
  if (myInterests.length === 0) {
    return otherProfile.city?.toLowerCase() === myProfile.city?.toLowerCase() ? 15 : 0;
  }
  const matches = myInterests.filter(i => otherInterests.includes(i));
  const interestScore = (matches.length / myInterests.length) * 100;
  let score = Math.round(interestScore);
  if (otherProfile.city?.toLowerCase() === myProfile.city?.toLowerCase()) {
    score = Math.min(100, score + 15);
  }
  return score;
};

export const getMediaUrl = (raw) => {
  if (!raw?.trim()) return null;
  if (/^https?:\/\//i.test(raw.trim())) return raw.trim();
  return `https://${raw.trim()}`;
};

export const getMediaLabel = (raw) => {
  try {
    const url = new URL(getMediaUrl(raw));
    return url.hostname.replace("www.", "");
  } catch { return raw; }
};

// ── COMMENT CLICKABLE MENTIONS COMPONENT ──

export const CommentText = ({ text, onMentionClick }) => {
  if (!text || !text.startsWith("@")) return <>{text}</>;
  const [mention, ...rest] = text.split(" ");
  const userid = mention.substring(1);
  return (
    <>
      <span
        style={{ color: "#ff4081", fontWeight: 600, cursor: "pointer" }}
        onClick={(e) => {
          if (onMentionClick) {
            e.stopPropagation();
            onMentionClick(userid);
          }
        }}
      >
        {mention}
      </span>
      {" " + rest.join(" ")}
    </>
  );
};
