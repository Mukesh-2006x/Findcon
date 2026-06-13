import React, { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, Box, Avatar, Typography, IconButton,
  Divider, TextField, CircularProgress, InputAdornment, Chip, List, ListItem
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import SendIcon from "@mui/icons-material/Send";
import SearchIcon from "@mui/icons-material/Search";
import {
  parseLikes,
  parseComments,
  parsePostTitle,
  CommentText,
  getMediaUrl
} from "../../utils/helpers";

export default function PostDetailModal({
  post,
  open,
  onClose,
  usersMap = {},
  profilesMap = {},
  currentUser,
  onLike,
  onCommentSubmit,
  onCommentDelete,
  onOpenProfile,
  headerAction,
  likeLoading = false,
  commentSubmitting = false
}) {
  const [showComments, setShowComments] = useState(true);
  const [showLikers, setShowLikers] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [likerSearchQuery, setLikerSearchQuery] = useState("");

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = () => setShowSuggestions(false);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setNewComment(val);
    handleCaretCheck(val, e.target.selectionStart);
  };

  const handleCaretCheck = (val, caretPos) => {
    const textBeforeCaret = val.slice(0, caretPos);
    const match = textBeforeCaret.match(/(?:^|\s)@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectMention = (selectedUserId) => {
    const val = newComment;
    const caretPos = inputRef.current ? inputRef.current.selectionStart : val.length;
    const textBeforeCaret = val.slice(0, caretPos);
    const textAfterCaret = val.slice(caretPos);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const insertText = `@${selectedUserId} `;
      const newVal = val.slice(0, lastAtIdx) + insertText + textAfterCaret;
      setNewComment(newVal);
      setShowSuggestions(false);

      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = lastAtIdx + insertText.length;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const matchedUsers = Object.keys(usersMap)
    .filter(uid => {
      if (!mentionQuery) return true;
      const lowerQuery = mentionQuery.toLowerCase();
      const displayName = profilesMap[uid]?.username || "";
      return uid.toLowerCase().includes(lowerQuery) || displayName.toLowerCase().includes(lowerQuery);
    })
    .map(uid => ({
      userid: uid,
      displayName: profilesMap[uid]?.username || uid,
      profilepic: usersMap[uid]?.profilepic
    }))
    .slice(0, 8);

  if (!post) return null;

  const likers = parseLikes(post.likes);
  const filteredLikers = likers.filter(uid =>
    uid.toLowerCase().includes(likerSearchQuery.trim().toLowerCase())
  );
  const comments = parseComments(post.comment);
  const parsedTitle = parsePostTitle(post.title);
  const isLiked = currentUser && likers.includes(currentUser.userid);
  const authorPic = usersMap[post.userid]?.profilepic;

  const handleSendComment = async () => {
    if (!newComment.trim() || commentSubmitting) return;
    if (onCommentSubmit) {
      await onCommentSubmit(post, newComment.trim(), replyTo);
    }
    setNewComment("");
    setReplyTo(null);
  };

  const handleDeleteCommentClick = (idx) => {
    if (onCommentDelete) {
      onCommentDelete(post, idx);
    }
  };

  const handleLikerClick = (uid) => {
    if (onClose) onClose();
    if (onOpenProfile) onOpenProfile(uid);
  };

  const handleAuthorClick = () => {
    if (onClose) onClose();
    if (onOpenProfile) onOpenProfile(post.userid);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      className="dialog-dark"
      PaperProps={{ sx: { maxHeight: "88dvh", display: "flex", flexDirection: "column" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={handleAuthorClick}>
          <Avatar
            src={authorPic}
            sx={{ width: 30, height: 30, fontSize: 12, background: "#ff4081", fontFamily: "'Syne'", fontWeight: 700 }}
          >
            {post.userid?.[0]?.toUpperCase()}
          </Avatar>
          <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 14.5, color: "#fff" }}>
            @{post.userid}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {headerAction}
          <IconButton size="small" onClick={onClose} sx={{ color: "rgba(255,255,255,0.4)" }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, overflowY: "auto", p: 0 }}>
        {/* Post Image */}
        <Box sx={{ background: "#0a0a0f", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
          <img
            src={getMediaUrl(post.post)}
            alt="post content"
            style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }}
            onError={e => { e.target.style.display = "none"; }}
          />
        </Box>

        {/* Post Actions */}
        <Box sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            onClick={() => onLike && onLike(post)}
            disabled={likeLoading || !currentUser}
            sx={{ p: "6px", color: isLiked ? "#ff4081" : "rgba(255,255,255,0.55)" }}
          >
            {isLiked ? <FavoriteIcon sx={{ fontSize: 22 }} /> : <FavoriteBorderIcon sx={{ fontSize: 22 }} />}
          </IconButton>
          <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontFamily: "'Syne'", fontWeight: 700, mr: 0.5 }}>
            {likers.length}
          </Typography>

          <IconButton
            sx={{ p: "6px", color: "rgba(255,255,255,0.55)" }}
            onClick={() => { setShowComments(true); setShowLikers(false); }}
          >
            <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontFamily: "'Syne'", fontWeight: 700 }}>
            {comments.length}
          </Typography>
        </Box>

        {/* Title/Caption and Tags */}
        <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
          {parsedTitle.caption && (
            <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans'", lineHeight: 1.6 }}>
              <span
                style={{ fontFamily: "'Syne'", fontWeight: 700, color: "#fff", marginRight: 6, cursor: "pointer" }}
                onClick={handleAuthorClick}
              >
                @{post.userid}
              </span>
              {parsedTitle.caption}
            </Typography>
          )}
          {parsedTitle.tags.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, mt: 1 }}>
              {parsedTitle.tags.map((t, idx) => (
                <Chip
                  key={idx}
                  label={`#${t}`}
                  size="small"
                  sx={{ background: "rgba(255,64,129,0.08)", color: "#ff80ab", border: "1px solid rgba(255,64,129,0.2)", fontSize: 11 }}
                />
              ))}
            </Box>
          )}
        </Box>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mx: 2 }} />

        {/* Tabs */}
        {/* Tabs */}
        <Box sx={{ display: "flex", gap: 1, px: 2, py: 1.5 }}>
          <button
            className={`tab-btn ${showComments ? "active" : "inactive"}`}
            onClick={() => { setShowComments(true); setShowLikers(false); setLikerSearchQuery(""); }}
          >
            💬 Comments ({comments.length})
          </button>
          <button
            className={`tab-btn ${showLikers ? "active" : "inactive"}`}
            onClick={() => { setShowLikers(true); setShowComments(false); setLikerSearchQuery(""); }}
          >
            ❤️ Likes ({likers.length})
          </button>
        </Box>

        {/* Comments Block */}
        {showComments && (
          <Box sx={{ px: 2, pb: 2 }}>
            {comments.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic", fontFamily: "'DM Sans'", py: 1 }}>
                No comments yet
              </Typography>
            ) : (
              comments.map((cmt, i) => {
                const commentUserPic = usersMap[cmt.user]?.profilepic;
                return (
                  <div className="comment-item" key={i}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                      <Avatar
                        onClick={() => handleLikerClick(cmt.user)}
                        src={commentUserPic}
                        sx={{ width: 26, height: 26, fontSize: 11, background: "rgba(255,64,129,0.3)", color: "#ff80ab", fontFamily: "'Syne'", fontWeight: 700, flexShrink: 0, mt: 0.2, cursor: "pointer" }}
                      >
                        {cmt.user?.[0]?.toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          onClick={() => handleLikerClick(cmt.user)}
                          sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12, color: "#ff80ab", lineHeight: 1, cursor: "pointer" }}
                        >
                          @{cmt.user}
                        </Typography>
                        <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.75)", mt: 0.3, lineHeight: 1.5 }}>
                          <CommentText text={cmt.text} usersMap={usersMap} onMentionClick={(uid) => handleLikerClick(uid)} />
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                          <button className="reply-btn" onClick={() => setReplyTo(cmt.user)}>↩ Reply</button>
                          {(cmt.user === currentUser?.userid || post.userid === currentUser?.userid) && (
                            <button className="reply-btn" style={{ color: "#ff5252" }} onClick={() => handleDeleteCommentClick(i)}>
                              🗑 Delete
                            </button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </div>
                );
              })
            )}
          </Box>
        )}

        {/* Likes Block */}
        {showLikers && (
          <Box sx={{ px: 2, pb: 2 }}>
            {likers.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic", fontFamily: "'DM Sans'", py: 1 }}>
                No likes yet
              </Typography>
            ) : (
              <>
                <TextField
                  fullWidth
                  placeholder="Search likes"
                  value={likerSearchQuery}
                  onChange={(e) => setLikerSearchQuery(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 2 }}
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
                {filteredLikers.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic", fontFamily: "'DM Sans'", py: 1, textAlign: "center" }}>
                    No results found
                  </Typography>
                ) : (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {filteredLikers.map((uid, i) => {
                      const likerPic = usersMap[uid]?.profilepic;
                      return (
                        <div className="liker-pill" key={i} onClick={() => handleLikerClick(uid)}>
                          <Avatar src={likerPic} sx={{ width: 20, height: 20, fontSize: 10, background: "#ff4081", fontFamily: "'Syne'" }}>
                            {uid[0]?.toUpperCase()}
                          </Avatar>
                          <Typography sx={{ fontSize: 12, color: "#ff80ab", fontFamily: "'Syne'", fontWeight: 700 }}>
                            @{uid}
                          </Typography>
                        </div>
                      );
                    })}
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      {currentUser && (
        <Box className="comment-input-row" sx={{ position: "relative" }}>
          {showSuggestions && matchedUsers.length > 0 && (
            <Box
              onClick={e => e.stopPropagation()}
              sx={{
                position: "absolute",
                bottom: "100%",
                left: 16,
                right: 16,
                zIndex: 10,
                background: "rgba(20, 20, 30, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                boxShadow: "0 -8px 24px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.5)",
                maxHeight: 200,
                overflowY: "auto",
                mb: 1
              }}
            >
              <List disablePadding>
                {matchedUsers.map((u, idx) => (
                  <ListItem
                    key={u.userid}
                    onClick={() => handleSelectMention(u.userid)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      cursor: "pointer",
                      py: 1,
                      px: 2,
                      borderBottom: idx < matchedUsers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      "&:hover": {
                        background: "rgba(255, 64, 129, 0.15)",
                      }
                    }}
                  >
                    <Avatar
                      src={u.profilepic}
                      sx={{ width: 28, height: 28, mr: 1.5, fontSize: 12, background: "#ff4081", fontFamily: "'Syne'", fontWeight: 700 }}
                    >
                      {u.userid?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Syne'", lineHeight: 1.2 }}>
                        {u.displayName}
                      </Typography>
                      <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'DM Sans'" }}>
                        @{u.userid}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            {replyTo && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, px: 1, py: 0.3, background: "rgba(255,64,129,0.1)", borderRadius: "8px", width: "fit-content" }}>
                <Typography sx={{ fontSize: 11, color: "#ff80ab", fontFamily: "'DM Sans'" }}>↩ Replying to @{replyTo}</Typography>
                <IconButton size="small" sx={{ p: 0, color: "rgba(255,255,255,0.4)" }} onClick={() => setReplyTo(null)}>
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Box>
            )}
            <TextField
              inputRef={inputRef}
              fullWidth
              size="small"
              placeholder={replyTo ? `Reply to @${replyTo}…` : "Add a comment…"}
              value={newComment}
              onChange={handleInputChange}
              onClick={(e) => handleCaretCheck(e.target.value, e.target.selectionStart)}
              onKeyUp={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  handleCaretCheck(e.target.value, e.target.selectionStart);
                }
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendComment();
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": { color: "#fff", background: "rgba(255,255,255,0.05)", borderRadius: "10px" },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.1)" },
                "& input::placeholder": { color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'" }
              }}
            />
          </Box>
          <IconButton
            onClick={handleSendComment}
            disabled={!newComment.trim() || commentSubmitting}
            sx={{
              background: newComment.trim() ? "#ff4081" : "rgba(255,255,255,0.06)",
              color: "#fff",
              borderRadius: "10px",
              width: 40,
              height: 40,
              flexShrink: 0,
              "&:hover": { background: "#e91e63" },
              "&:disabled": { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }
            }}
          >
            {commentSubmitting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SendIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>
      )}
    </Dialog>
  );
}
