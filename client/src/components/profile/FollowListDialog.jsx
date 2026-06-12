import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, Typography, IconButton, Avatar, Box, CircularProgress,
  TextField, InputAdornment
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import FollowBtn from "../FollowBtn";

export default function FollowListDialog({
  open,
  onClose,
  title,
  list = [],
  ownerUid,
  usersMap = {},
  profilesMap = {},
  currentUser,
  myFollowing,
  myFollowers,
  followLoading = {},
  onFollowToggle,
  onOpenProfile,
  onRemoveFollower,
  onUnfollowFromList,
  actionLoading = {}
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const followBtnProps = { myFollowing, myFollowers, followLoading, onToggle: onFollowToggle };

  const filteredList = list.filter(uid => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    const uRec = usersMap[uid] || {};
    const pRec = profilesMap[uid] || {};
    return (
      uid.toLowerCase().includes(query) ||
      (uRec.fullname && uRec.fullname.toLowerCase().includes(query)) ||
      (pRec.profession && pRec.profession.toLowerCase().includes(query))
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          background: "#1a1a24",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          color: "#fff",
          maxHeight: "75dvh",
          display: "flex",
          flexDirection: "column"
        }
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 15, color: "#fff" }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)" }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      {list.length > 0 && (
        <Box sx={{ px: 2.5, pt: 1.5, pb: 0.5 }}>
          <TextField
            fullWidth
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
                </InputAdornment>
              ),
              sx: {
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "10px",
                color: "#fff",
                fontSize: 13,
                fontFamily: "'DM Sans'",
                "& fieldset": { border: "none" },
                "&:hover": { background: "rgba(255,255,255,0.06)" },
                "&.Mui-focused": { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,64,129,0.3)" }
              }
            }}
          />
        </Box>
      )}
      <DialogContent sx={{ py: 1, px: 2.5 }}>
        {filteredList.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.28)", fontStyle: "italic", fontFamily: "'DM Sans'", textAlign: "center", py: 4 }}>
            {list.length === 0 ? "Nobody yet" : "No results found"}
          </Typography>
        ) : (
          filteredList.map((uid, i) => {
            const uRec = usersMap[uid] || {};
            const pRec = profilesMap[uid] || {};
            const isAct = actionLoading[uid];

            return (
              <div className="follow-list-item" key={i}>
                <Avatar
                  src={uRec.profilepic || ""}
                  sx={{ width: 36, height: 36, background: "rgba(255,64,129,0.3)", color: "#ff80ab", fontFamily: "'Syne'", fontWeight: 700, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
                  onClick={() => {
                    if (onClose) onClose();
                    if (onOpenProfile) onOpenProfile(uid);
                  }}
                >
                  {uid[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                  onClick={() => {
                    if (onClose) onClose();
                    if (onOpenProfile) onOpenProfile(uid);
                  }}
                >
                  <Typography
                    className="follow-list-name"
                    sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 13.5, color: "#fff" }}
                  >
                    @{uid}
                  </Typography>
                  {pRec.profession && (
                    <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.35)", mt: 0.1 }}>
                      {pRec.profession}
                    </Typography>
                  )}
                  {pRec.city && (
                    <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 10.5, color: "rgba(255,255,255,0.25)", mt: 0.1 }}>
                      📍 {pRec.city}
                    </Typography>
                  )}
                </Box>

                {/* Dashboard logic: If user is viewing their own profile list, show custom Action buttons */}
                {ownerUid === currentUser?.userid && title === "Followers" && onRemoveFollower ? (
                  <button className="fl-action-btn remove" disabled={isAct} onClick={() => onRemoveFollower(uid)}>
                    {isAct ? <CircularProgress size={10} sx={{ color: "inherit" }} /> : "Remove"}
                  </button>
                ) : ownerUid === currentUser?.userid && title === "Following" && onUnfollowFromList ? (
                  <button className="fl-action-btn unfollow" disabled={isAct} onClick={() => onUnfollowFromList(uid)}>
                    {isAct ? <CircularProgress size={10} sx={{ color: "inherit" }} /> : "Unfollow"}
                  </button>
                ) : (
                  currentUser && uid !== currentUser.userid && (
                    <FollowBtn uid={uid} {...followBtnProps} />
                  )
                )}
              </div>
            );
          })
        )}
      </DialogContent>
    </Dialog>
  );
}
