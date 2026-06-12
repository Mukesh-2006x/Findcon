import React from "react";
import { Box, Typography, Chip, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MatchingScoreRing from "./MatchingScoreRing";

export default function MatchingCard({
  currentProfile,
  nextProfile,
  dragOffset = { x: 0, y: 0 },
  swipeDir = null,
  isDragging = false,
  animatingOut = false,
  cardRef,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  onInfoClick,
  onSwipe
}) {
  if (!currentProfile) return null;

  return (
    <>
      {/* Background card (next profile peek) */}
      {nextProfile && (
        <div className={`m-card-bg ${Math.abs(dragOffset.x) > 30 ? "peek" : ""}`}>
          {nextProfile.userRec?.profilepic && (
            <img
              src={nextProfile.userRec.profilepic}
              alt=""
              style={{ width: "100%", height: "46%", objectFit: "cover", opacity: 0.35, filter: "blur(2px)" }}
            />
          )}
        </div>
      )}

      {/* Main swipeable card */}
      <div
        ref={cardRef}
        className={`m-card ${swipeDir === "right" ? "swiping-right" : swipeDir === "left" ? "swiping-left" : ""}`}
        style={{
          transform: animatingOut
            ? `translate3d(${swipeDir === "right" ? 600 : -600}px, ${dragOffset.y * 0.3}px, 0) rotate(${swipeDir === "right" ? 30 : -30}deg)`
            : `translate3d(${dragOffset.x}px, ${dragOffset.y * 0.25}px, 0) rotate(${dragOffset.x * 0.04}deg)`,
          transition: isDragging ? "none" : "transform 0.38s cubic-bezier(0.175,0.885,0.32,1.275)",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Stamps */}
        {swipeDir === "left" && <div className="m-stamp pass">Pass</div>}
        {swipeDir === "right" && <div className="m-stamp follow">Follow</div>}

        {/* Photo section */}
        <div className="m-photo">
          {currentProfile.userRec?.profilepic ? (
            <img src={currentProfile.userRec.profilepic} alt="" draggable="false" />
          ) : (
            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#2a1040,#180c28)" }}>
              <Typography sx={{ fontSize: 64, opacity: 0.4 }}>👤</Typography>
            </Box>
          )}
          <div className="m-photo-grad" />

          {/* Name overlay */}
          <div className="m-photo-namerow">
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography
                onClick={(e) => {
                  e.stopPropagation();
                  if (onInfoClick) onInfoClick();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 22, color: "#fff", cursor: "pointer", lineHeight: 1, letterSpacing: "-0.3px", "&:hover": { color: "#ff80ab" }, transition: "color 0.15s", textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
              >
                @{currentProfile.userRec?.userid}
              </Typography>
              {currentProfile.profile?.age && (
                <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 14, color: "rgba(255,255,255,0.65)", fontWeight: 400, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
                  {currentProfile.profile.age}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.7, mt: 0.4 }}>
              {currentProfile.profile?.profession && (
                <span className="m-meta-pill accent">{currentProfile.profile.profession}</span>
              )}
              {currentProfile.profile?.city && (
                <span className="m-meta-pill">📍 {currentProfile.profile.city}</span>
              )}
              {currentProfile.followsMe && (
                <span className="m-meta-pill green">♥ Follows you</span>
              )}
            </Box>
          </div>

          {/* Score ring */}
          <MatchingScoreRing score={currentProfile.score} />
        </div>

        {/* Info section */}
        <div className="m-info">
          {/* Bio */}
          {currentProfile.profile?.bio && (
            <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontStyle: "italic", lineHeight: 1.65, fontWeight: 300 }}>
              "{currentProfile.profile.bio}"
            </Typography>
          )}

          {/* Matched interests */}
          {currentProfile.matchedTags?.length > 0 && (
            <Box>
              <div className="m-section-label hot">✦ Shared taste</div>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.7 }}>
                {currentProfile.matchedTags.map((tag, i) => (
                  <Chip key={i} label={tag} size="small" sx={{ background: "rgba(255,64,129,0.15)", color: "#fff", border: "1px solid rgba(255,64,129,0.35)", fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans'", height: 24 }} />
                ))}
              </Box>
            </Box>
          )}

          {/* Other interests */}
          {currentProfile.interests?.filter(t => !currentProfile.matchedTags?.includes(t)).length > 0 && (
            <Box>
              <div className="m-section-label">Interests</div>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.7 }}>
                {currentProfile.interests.filter(t => !currentProfile.matchedTags?.includes(t)).map((tag, i) => (
                  <Chip key={i} label={tag} size="small" sx={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, fontFamily: "'DM Sans'", fontWeight: 500, height: 24 }} />
                ))}
              </Box>
            </Box>
          )}

          {/* Spacer for action bar */}
          <Box sx={{ height: 4, flexShrink: 0 }} />
        </div>

        {/* ── ACTION BAR ── */}
        <div className="m-actions" onPointerDown={(e) => e.stopPropagation()}>
          <button className="m-btn info" onClick={onInfoClick}>
            <Typography sx={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 12 }}>info</Typography>
          </button>
          <button className="m-btn pass" onClick={() => onSwipe && onSwipe("left")}>
            <CloseIcon sx={{ fontSize: 16 }} />
            <span>reject</span>
          </button>
          <button className="m-btn follow" onClick={() => onSwipe && onSwipe("right")}>
            <PersonAddIcon sx={{ fontSize: 16 }} />
            <span>follow</span>
          </button>
        </div>
      </div>
    </>
  );
}
