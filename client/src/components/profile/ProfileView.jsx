import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box, IconButton, Typography, Avatar, CircularProgress, Divider, Button
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GridOnIcon from "@mui/icons-material/GridOn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import FollowBtn from "../FollowBtn";
import FollowListDialog from "./FollowListDialog";
import PostDetailModal from "../posts/PostDetailModal";
import {
  parseLikes,
  parseComments,
  parsePostTitle,
  serializeComments,
  getMediaUrl,
  calculateMatchScore,
  parseFollowList
} from "../../utils/helpers";
import { ENDPOINTS } from "../../config/api";

const POST_API = ENDPOINTS.POSTS;

export default function ProfileView({
  profileStack = [],
  viewingUser = null, // fallback for single-user overlay
  currentUser,
  myFollowing,
  myFollowers,       // Set of UIDs who follow the current user (optional, derived below)
  followLoading = {},
  onFollowToggle,
  onClose,
  onOpenProfile,
  usersMap = {},
  profilesMap = {},
  onProfileUpdate // callback to notify parent of changes in posts (likes/comments)
}) {
  const navigate = useNavigate();
  // Normalize profileStack to always be an array
  const stack = Array.isArray(profileStack) && profileStack.length > 0 
    ? profileStack 
    : (viewingUser ? [viewingUser] : []);

  // Internal states for local modals
  const [activeFollowList, setActiveFollowList] = useState(null); // { title, list, ownerUid }
  const [activePost, setActivePost] = useState(null); // post object
  const [postLiking, setPostLiking] = useState(false);
  const [postSubmitting, setPostSubmitting] = useState(false);

  if (stack.length === 0) return null;

  // Derive myFollowers Set from currentUser if not passed explicitly
  const resolvedMyFollowers = myFollowers instanceof Set
    ? myFollowers
    : new Set(parseFollowList(currentUser?.followers));

  const followBtnProps = { myFollowing, myFollowers: resolvedMyFollowers, followLoading, onToggle: onFollowToggle };

  const handleOpenFollowList = (title, list, ownerUid) => {
    setActiveFollowList({ title, list, ownerUid });
  };

  const handlePostLike = async (post) => {
    if (!currentUser || postLiking) return;
    setPostLiking(true);
    const currentLikers = parseLikes(post.likes);
    const isLiked = currentLikers.includes(currentUser.userid);
    const updatedLikers = isLiked
      ? currentLikers.filter(u => u !== currentUser.userid)
      : [...currentLikers, currentUser.userid];
    const newLikesStr = updatedLikers.join(",");
    const updatedPost = { ...post, likes: newLikesStr };

    try {
      // Optimistic state update locally
      setActivePost(updatedPost);
      if (onProfileUpdate) {
        onProfileUpdate(updatedPost);
      }

      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log("Error liking profile post:", err);
    } finally {
      setPostLiking(false);
    }
  };

  const handlePostCommentSubmit = async (post, commentText, replyToUser) => {
    if (!currentUser || postSubmitting) return;
    setPostSubmitting(true);
    const text = replyToUser ? `@${replyToUser} ${commentText}` : commentText;
    const existing = parseComments(post.comment);
    const updated = [...existing, { user: currentUser.userid, text }];
    const serialized = serializeComments(updated);
    const updatedPost = { ...post, comment: serialized };

    try {
      setActivePost(updatedPost);
      if (onProfileUpdate) {
        onProfileUpdate(updatedPost);
      }

      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log("Error commenting on profile post:", err);
    } finally {
      setPostSubmitting(false);
    }
  };

  const handlePostCommentDelete = async (post, idx) => {
    const comments = parseComments(post.comment);
    const target = comments[idx];
    if (!currentUser || (target.user !== currentUser.userid && post.userid !== currentUser.userid)) return;

    const updated = comments.filter((_, i) => i !== idx);
    const serialized = serializeComments(updated);
    const updatedPost = { ...post, comment: serialized };

    try {
      setActivePost(updatedPost);
      if (onProfileUpdate) {
        onProfileUpdate(updatedPost);
      }

      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log("Error deleting profile post comment:", err);
    }
  };

  const handleNestedProfileOpen = (uid) => {
    if (onOpenProfile) {
      onOpenProfile(uid);
    }
  };

  return (
    <>
      <style>{`
        .profile-page { position: fixed; inset: 0; z-index: 1300; background: #0a0a0f; display: flex; flex-direction: column; overflow: hidden; animation: slideInUpProfile 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .profile-page-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,15,0.92); backdrop-filter: blur(20px); flex-shrink: 0; }
        .profile-page-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

        .uprofile-hero { background: linear-gradient(160deg,#1c0a15 0%,#2a0e22 50%,#160a1e 100%); padding: 32px 20px 24px; position: relative; overflow: hidden; text-align: center; }
        .uprofile-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% -20%,rgba(255,64,129,0.25) 0%,transparent 65%); pointer-events: none; }
        .uprofile-avatar-ring { position: relative; width: 88px; height: 88px; margin: 0 auto 14px; }
        .uprofile-avatar-ring::before { content: ''; position: absolute; inset: -3px; border-radius: 50%; background: conic-gradient(#ff4081,#ff80ab,#f50057,#ff4081); animation: spinRingProfile 5s linear infinite; z-index: 0; }
        .uprofile-avatar-inner { position: absolute; inset: 2px; border-radius: 50%; overflow: hidden; z-index: 1; background: #1a1a24; }
        @keyframes spinRingProfile { to { transform: rotate(360deg); } }

        .stats-row { display: flex; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); margin: 16px 0 0; }
        .stat-block { flex: 1; text-align: center; padding: 12px 4px; border-right: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: background 0.18s; }
        .stat-block:last-child { border-right: none; }
        .stat-block:hover { background: rgba(255,64,129,0.06); }
        .stat-block.no-click { cursor: default; }
        .stat-block.no-click:hover { background: transparent; }

        .uprofile-posts-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px; }
        .uprofile-post-thumb { aspect-ratio: 1; overflow: hidden; background: rgba(255,255,255,0.04); position: relative; cursor: pointer; }
        .uprofile-post-thumb img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s; }
        .uprofile-post-thumb:hover img { transform: scale(1.06); }
        .uprofile-post-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; gap: 12px; opacity: 0; transition: opacity 0.2s; }
        .uprofile-post-thumb:hover .uprofile-post-overlay { opacity: 1; }

        @keyframes slideInUpProfile { from { transform: translateY(100%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {stack.map((vu, stackIdx) => {
        const isTop = stackIdx === stack.length - 1;
        const postsList = vu.posts || [];

        return (
          <div
            className="profile-page"
            key={vu.userid + stackIdx}
            style={{
              zIndex: 1300 + stackIdx * 10,
              display: isTop ? "flex" : "none" // optimized to show only top profile
            }}
          >
            {/* Header */}
            <div className="profile-page-header">
              <IconButton
                size="small"
                onClick={onClose}
                sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#ff80ab" } }}
              >
                <ArrowBackIcon sx={{ fontSize: 22 }} />
              </IconButton>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 16, color: "#fff", lineHeight: 1 }}>
                  {vu.loading ? "Loading…" : `@${vu.userid}`}
                </Typography>
                {!vu.loading && vu.posts && (
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.35)", mt: 0.2 }}>
                    {postsList.length} {postsList.length === 1 ? "post" : "posts"}
                  </Typography>
                )}
              </Box>
              {!vu.loading && currentUser && currentUser.userid !== vu.userid && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FollowBtn uid={vu.userid} {...followBtnProps} />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      localStorage.setItem("startChatWith", vu.userid);
                      if (onClose) onClose();
                      navigate("/messages");
                    }}
                    sx={{
                      borderColor: "rgba(255,64,129,0.3)",
                      color: "#ff80ab",
                      borderRadius: "20px",
                      textTransform: "none",
                      fontFamily: "'Syne'",
                      fontWeight: 700,
                      fontSize: "11px",
                      px: 2,
                      py: 0.4,
                      minWidth: "68px",
                      lineHeight: 1.5,
                      "&:hover": { borderColor: "#ff4081", background: "rgba(255,64,129,0.05)" }
                    }}
                  >
                    Message
                  </Button>
                </Box>
              )}
            </div>

            {/* Body */}
            {vu.loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <CircularProgress sx={{ color: "#ff4081" }} />
              </Box>
            ) : (
              <div className="profile-page-body">
                <div className="uprofile-hero">
                  <div className="uprofile-avatar-ring">
                    <div className="uprofile-avatar-inner">
                      <Avatar
                        src={vu.userRec?.profilepic}
                        sx={{ width: "100%", height: "100%", borderRadius: 0, background: "#1a1a24" }}
                      >
                        {vu.userid?.[0]?.toUpperCase()}
                      </Avatar>
                    </div>
                  </div>
                  <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 22, color: "#fff", letterSpacing: "-0.3px", position: "relative", zIndex: 1 }}>
                    @{vu.userid}
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, mt: 0.8, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                    {vu.profile?.profession && (
                      <Box sx={{ px: 1.4, py: 0.3, borderRadius: "20px", background: "rgba(255,64,129,0.15)", border: "1px solid rgba(255,64,129,0.3)" }}>
                        <Typography sx={{ fontSize: 11, color: "#ff80ab", fontFamily: "'DM Sans'", fontWeight: 500 }}>
                          {vu.profile.profession}
                        </Typography>
                      </Box>
                    )}
                    {currentUser && vu.userid !== currentUser.userid && (() => {
                      const myProfile = profilesMap[currentUser.userid];
                      const otherProfile = vu.profile;
                      if (!myProfile || !otherProfile) return null;
                      const score = calculateMatchScore(myProfile, otherProfile);
                      return (
                        <Box sx={{ px: 1.4, py: 0.3, borderRadius: "20px", background: "rgba(76,206,172,0.12)", border: "1px solid rgba(76,206,172,0.25)", display: "flex", alignItems: "center", gap: 0.4 }}>
                          <span style={{ fontSize: 11, lineHeight: 1 }}>⚡</span>
                          <Typography sx={{ fontSize: 11, color: "#4cceac", fontFamily: "'Syne'", fontWeight: 700 }}>
                            {score}% Match
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Box>

                  {/* Stats Row */}
                  <div className="stats-row">
                    <div className="stat-block no-click">
                      <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1 }}>
                        {postsList.length}
                      </Typography>
                      <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.4)", mt: 0.3 }}>
                        Posts
                      </Typography>
                    </div>
                    <div
                      className="stat-block"
                      onClick={() => handleOpenFollowList("Followers", vu.followers || [], vu.userid)}
                    >
                      <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1 }}>
                        {vu.followers?.length || 0}
                      </Typography>
                      <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.4)", mt: 0.3 }}>
                        Followers
                      </Typography>
                    </div>
                    <div
                      className="stat-block"
                      onClick={() => handleOpenFollowList("Following", vu.following || [], vu.userid)}
                    >
                      <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 20, color: "#fff", lineHeight: 1 }}>
                        {vu.following?.length || 0}
                      </Typography>
                      <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.4)", mt: 0.3 }}>
                        Following
                      </Typography>
                    </div>
                  </div>

                  {/* Meta Details */}
                  <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 0.8, mt: 1.5, position: "relative", zIndex: 1 }}>
                    {vu.profile?.age && <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>🎂 {vu.profile.age}</span>}
                    {vu.profile?.gender && <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>⚧ {vu.profile.gender}</span>}
                    {vu.profile?.city && <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>📍 {vu.profile.city}</span>}
                    {vu.profile?.relationshipstatus && <span style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>💞 {vu.profile.relationshipstatus}</span>}
                  </Box>

                  {/* Mutual Follows */}
                  {currentUser && vu.userid !== currentUser.userid && (() => {
                    const mutual = (vu.followers || []).filter(uid => myFollowing.has(uid));
                    if (!mutual || mutual.length === 0) return null;
                    return (
                      <Box sx={{ mt: 1, textAlign: "center" }}>
                        <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "'DM Sans'" }}>
                          Followed by{" "}
                          {mutual.slice(0, 2).map((uid, i) => (
                            <span
                              key={uid}
                              style={{ color: "#ff80ab", fontWeight: 700, cursor: "pointer" }}
                              onClick={e => {
                                e.stopPropagation();
                                handleNestedProfileOpen(uid);
                              }}
                            >
                              @{uid}{i < Math.min(mutual.length, 2) - 1 ? ", " : ""}
                            </span>
                          ))}
                          {mutual.length > 2 && (
                            <span
                              style={{ color: "#ff80ab", cursor: "pointer" }}
                              onClick={() => handleOpenFollowList("Mutuals", mutual, vu.userid)}
                            >
                              {" "}and {mutual.length - 2} others
                            </span>
                          )}
                        </Typography>
                      </Box>
                    );
                  })()}
                </div>

                {/* Bio Section */}
                {vu.profile?.bio && (
                  <Box sx={{ px: 2.5, py: 2 }}>
                    <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "'DM Sans'", lineHeight: 1.7, textAlign: "center", fontStyle: "italic" }}>
                      "{vu.profile.bio}"
                    </Typography>
                  </Box>
                )}

                {/* Interests Section */}
                {vu.profile?.interests && (
                  <Box sx={{ px: 2, pb: 2, display: "flex", flexWrap: "wrap", gap: 0.7, justifyContent: "center" }}>
                    {vu.profile.interests.split(",").map((tag, i) => (
                      <Box key={i} sx={{ px: 1, py: 0.4, borderRadius: "8px", background: "rgba(255,64,129,0.08)", border: "1px solid rgba(255,64,129,0.18)" }}>
                        <Typography sx={{ fontSize: 11.5, color: "#ff80ab", fontFamily: "'DM Sans'" }}>
                          {tag.trim()}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* External Social Media Link */}
                {vu.profile?.othermedia?.trim() && (() => {
                  const mUrl = getMediaUrl(vu.profile.othermedia);
                  return mUrl ? (
                    <Box sx={{ mx: 2, mb: 2 }}>
                      <a
                        href={mUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,64,129,0.08)", border: "1px solid rgba(255,64,129,0.2)", borderRadius: 14, padding: "10px 14px", textDecoration: "none" }}
                      >
                        <LinkIcon sx={{ fontSize: 16, color: "#ff80ab" }} />
                        <Typography sx={{ flex: 1, fontSize: 12.5, color: "#ff80ab", fontFamily: "'DM Sans'", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {vu.profile.othermedia}
                        </Typography>
                        <OpenInNewIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }} />
                      </a>
                    </Box>
                  ) : null;
                })()}

                <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mx: 2, mb: 1 }} />
                <Box sx={{ px: 2, py: 1.2, display: "flex", alignItems: "center", gap: 1 }}>
                  <GridOnIcon sx={{ fontSize: 15, color: "rgba(255,255,255,0.35)" }} />
                  <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                    Posts
                  </Typography>
                </Box>

                {/* Posts Thumb Grid */}
                {postsList.length > 0 ? (
                  <div className="uprofile-posts-grid">
                    {postsList.map(post => {
                      const pLikers = parseLikes(post.likes);
                      const pComments = parseComments(post.comment);
                      return (
                        <div
                          className="uprofile-post-thumb"
                          key={post.id}
                          onClick={() => setActivePost(post)}
                        >
                          <img
                            src={getMediaUrl(post.post)}
                            alt="post"
                            onError={e => { e.target.style.display = "none"; }}
                          />
                          <div className="uprofile-post-overlay">
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <FavoriteIcon sx={{ fontSize: 13, color: "#fff" }} />
                              <Typography sx={{ fontSize: 11, color: "#fff", fontFamily: "'Syne'", fontWeight: 700 }}>
                                {pLikers.length}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 12, color: "#fff" }} />
                              <Typography sx={{ fontSize: 11, color: "#fff", fontFamily: "'Syne'", fontWeight: 700 }}>
                                {pComments.length}
                              </Typography>
                            </Box>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Box sx={{ textAlign: "center", py: 6, color: "rgba(255,255,255,0.2)", fontFamily: "'DM Sans'", fontSize: 13, fontStyle: "italic" }}>
                    No posts yet
                  </Box>
                )}
                <Box sx={{ height: 80 }} />
              </div>
            )}
          </div>
        );
      })}

      {/* Followers/Following Popup Dialog */}
      {activeFollowList && (
        <FollowListDialog
          open={!!activeFollowList}
          onClose={() => setActiveFollowList(null)}
          title={activeFollowList.title}
          list={activeFollowList.list}
          ownerUid={activeFollowList.ownerUid}
          usersMap={usersMap}
          profilesMap={profilesMap}
          currentUser={currentUser}
          myFollowing={myFollowing}
          myFollowers={resolvedMyFollowers}
          followLoading={followLoading}
          onFollowToggle={onFollowToggle}
          onOpenProfile={(uid) => {
            setActiveFollowList(null);
            handleNestedProfileOpen(uid);
          }}
        />
      )}

      {/* Detailed Post Dialog inside the Profile Overlay */}
      {activePost && (
        <PostDetailModal
          open={!!activePost}
          onClose={() => setActivePost(null)}
          post={activePost}
          usersMap={usersMap}
          currentUser={currentUser}
          onLike={handlePostLike}
          onCommentSubmit={handlePostCommentSubmit}
          onCommentDelete={handlePostCommentDelete}
          onOpenProfile={(uid) => {
            setActivePost(null);
            handleNestedProfileOpen(uid);
          }}
          likeLoading={postLiking}
          commentSubmitting={postSubmitting}
        />
      )}
    </>
  );
}
