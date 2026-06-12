import React, { useState } from "react";
import { Box, Avatar, Typography, IconButton, Chip, TextField } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import SendIcon from "@mui/icons-material/Send";
import FollowBtn from "../FollowBtn";
import {
  parseLikes,
  parseComments,
  parsePostTitle,
  CommentText,
  getMediaUrl
} from "../../utils/helpers";

export default function PostCard({
  post,
  author,
  profile,
  currentUser,
  myFollowing,
  followLoading,
  onFollowToggle,
  onLike,
  onOpenPost,
  onQuickCommentSubmit,
  onOpenProfile
}) {
  const [quickComment, setQuickComment] = useState("");

  const likers = parseLikes(post.likes);
  const isLiked = currentUser && likers.includes(currentUser.userid);
  const comments = parseComments(post.comment);
  const parsedTitle = parsePostTitle(post.title);
  const authorRec = author || { userid: post.userid };

  const handleSendQuickComment = () => {
    if (!quickComment.trim()) return;
    if (onQuickCommentSubmit) {
      onQuickCommentSubmit(post, quickComment.trim());
    }
    setQuickComment("");
  };

  const followBtnProps = { myFollowing, followLoading, onToggle: onFollowToggle };

  return (
    <div className="feed-card">
      {/* Post Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyItems: "center", p: 1.5, gap: 1.2 }}>
        <Avatar
          src={authorRec.profilepic}
          onClick={() => onOpenProfile && onOpenProfile(post.userid)}
          sx={{ width: 36, height: 36, cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {post.userid?.[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            onClick={() => onOpenProfile && onOpenProfile(post.userid)}
            sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 13.5, color: "#fff", cursor: "pointer", "&:hover": { color: "#ff80ab" } }}
          >
            @{post.userid}
          </Typography>
          {profile?.profession && (
            <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans'" }}>
              {profile.profession}
            </Typography>
          )}
        </Box>
        {currentUser && post.userid !== currentUser.userid && (
          <FollowBtn uid={post.userid} stopProp {...followBtnProps} />
        )}
      </Box>

      {/* Post Image */}
      <div className="feed-image-container" onClick={() => onOpenPost && onOpenPost(post)}>
        <img
          src={getMediaUrl(post.post)}
          alt="Feed content"
          onError={e => { e.target.style.display = "none"; }}
        />
      </div>

      {/* Post Body (Caption, tags, actions) */}
      <Box sx={{ p: 2 }}>
        {/* Actions bar */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <IconButton size="small" onClick={() => onLike && onLike(post)} sx={{ p: 0, color: isLiked ? "#ff4081" : "rgba(255,255,255,0.6)" }}>
            {isLiked ? <FavoriteIcon sx={{ fontSize: 24 }} /> : <FavoriteBorderIcon sx={{ fontSize: 24 }} />}
          </IconButton>
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "'Syne'", fontWeight: 700, mr: 0.8 }}>
            {likers.length}
          </Typography>

          <IconButton size="small" onClick={() => onOpenPost && onOpenPost(post)} sx={{ p: 0, color: "rgba(255,255,255,0.6)" }}>
            <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 22 }} />
          </IconButton>
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "'Syne'", fontWeight: 700 }}>
            {comments.length}
          </Typography>
        </Box>

        {/* Caption */}
        {parsedTitle.caption && (
          <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans'", lineHeight: 1.55 }}>
            <span
              style={{ fontFamily: "'Syne'", fontWeight: 700, color: "#fff", marginRight: 8, cursor: "pointer" }}
              onClick={() => onOpenProfile && onOpenProfile(post.userid)}
            >
              @{post.userid}
            </span>
            {parsedTitle.caption}
          </Typography>
        )}

        {/* Hashtags */}
        {parsedTitle.tags.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, mt: 1 }}>
            {parsedTitle.tags.map((t, idx) => (
              <Chip key={idx} label={`#${t}`} size="small" sx={{ background: "rgba(255,64,129,0.07)", color: "#ff80ab", border: "1px solid rgba(255,64,129,0.18)", fontSize: 10.5, height: 20 }} />
            ))}
          </Box>
        )}

        {/* Comments Preview */}
        {comments.length > 0 && (
          <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 0.8 }}>
            <Typography
              onClick={() => onOpenPost && onOpenPost(post)}
              sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans'", cursor: "pointer", "&:hover": { color: "#ff80ab" } }}
            >
              View all {comments.length} comments
            </Typography>
            {comments.slice(-2).map((cmt, idx) => (
              <Typography key={idx} sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans'" }}>
                <span
                  style={{ fontFamily: "'Syne'", fontWeight: 700, color: "rgba(255,255,255,0.9)", marginRight: 6, cursor: "pointer" }}
                  onClick={() => onOpenProfile && onOpenProfile(cmt.user)}
                >
                  @{cmt.user}
                </span>
                <CommentText text={cmt.text} onMentionClick={onOpenProfile} />
              </Typography>
            ))}
          </Box>
        )}
      </Box>

      {/* Quick Comment Input */}
      {currentUser && (
        <div className="feed-quick-comment">
          <TextField
            fullWidth
            size="small"
            placeholder="Add a comment..."
            value={quickComment}
            onChange={e => setQuickComment(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSendQuickComment();
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                "& fieldset": { borderColor: "rgba(255,255,255,0.08)" },
                "&.Mui-focused fieldset": { borderColor: "#ff4081" }
              },
              "& input::placeholder": { color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'", fontSize: "12.5px" }
            }}
          />
          <IconButton
            disabled={!quickComment.trim()}
            onClick={handleSendQuickComment}
            sx={{
              background: quickComment.trim() ? "#ff4081" : "rgba(255,255,255,0.04)",
              color: "#fff",
              borderRadius: "10px",
              width: 36,
              height: 36,
              "&:hover": { background: "#e91e63" },
              "&:disabled": { color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)" }
            }}
          >
            <SendIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
