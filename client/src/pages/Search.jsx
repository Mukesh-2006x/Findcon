import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/ui";
import { ENDPOINTS } from "../config/api";
import { Box, Typography, Avatar, CircularProgress, IconButton, Chip, TextField, InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import { useAuth } from "../context/AuthContext";
import FollowBtn from "../components/FollowBtn";
import Notifications from "../components/Notification";
import { PostDetailModal } from "../components/posts";
import { ProfileView } from "../components/profile";
import {
  parseLikes,
  parseComments,
  serializeComments,
  parseFollowList,
  serializeFollowList,
  parsePostTitle,
  getMediaUrl
} from "../utils/helpers";

const POST_API    = ENDPOINTS.POSTS;
const USER_API    = ENDPOINTS.USERS;
const PROFILE_API = ENDPOINTS.PROFILES;

export default function Search() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts]       = useState([]);
  const [users, setUsers]       = useState({});
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading]   = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // myFollowing = Set of userids the current user follows
  const [myFollowing, setMyFollowing]   = useState(new Set());
  const [myFollowers, setMyFollowers]   = useState(new Set());
  const [followLoading, setFollowLoading] = useState({});

  // Full-page user profile overlay stack
  const [viewingUser, setViewingUser] = useState(null);

  // Post detail modal
  const [viewPost, setViewPost] = useState(null);

  // ── INITIAL LOAD ──
  const fetchAll = async () => {
    try {
      const [postRes, userRes, profileRes] = await Promise.all([
        axios.get(POST_API),
        axios.get(USER_API),
        axios.get(PROFILE_API),
      ]);
      const userMap = {};
      userRes.data.forEach(u => { userMap[u.userid] = u; });
      const profileMap = {};
      profileRes.data.forEach(p => { profileMap[p.userid] = p; });

      if (currentUser) {
        const myRec = userRes.data.find(u => u.userid === currentUser.userid);
        if (myRec) {
          setMyFollowing(new Set(parseFollowList(myRec.following)));
          setMyFollowers(new Set(parseFollowList(myRec.followers)));
        }
      }

      // Show ALL posts in the Discover feed (sorted newest first)
      const allPosts = [...postRes.data].sort((a, b) => b.id - a.id);
      setPosts(allPosts);
      setUsers(userMap);
      setProfiles(profileMap);
    } catch (err) {
      console.log("Discover fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [currentUser?.userid]);

  // ── OPEN USER PROFILE ──
  const openUserProfile = useCallback(async (userid) => {
    if (!userid) return;
    if (currentUser && userid === currentUser.userid) {
      navigate("/dashboard");
      return;
    }
    setViewingUser({ loading: true, userid });
    setViewPost(null); // Close any open post
    try {
      const [userRes, profileRes, postRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API),
      ]);
      const userRec   = userRes.data.find(u => u.userid === userid) || { userid };
      const profile   = profileRes.data.find(p => p.userid === userid) || {};
      const userPosts = postRes.data.filter(p => p.userid === userid).sort((a, b) => b.id - a.id);
      const followers = parseFollowList(userRec.followers);
      const following = parseFollowList(userRec.following);
      setViewingUser({ userRec, profile, posts: userPosts, userid, followers, following });
    } catch (err) {
      console.log(err);
      setViewingUser(null);
    }
  }, [currentUser?.userid, navigate]);

  // ── FOLLOW / UNFOLLOW ──
  const handleFollowToggle = async (targetUserid) => {
    if (!currentUser || followLoading[targetUserid]) return;
    setFollowLoading(prev => ({ ...prev, [targetUserid]: true }));

    try {
      const userRes   = await axios.get(USER_API);
      const allUsers  = userRes.data;
      const myRec     = allUsers.find(u => u.userid === currentUser.userid);
      const targetRec = allUsers.find(u => u.userid === targetUserid);
      if (!myRec || !targetRec) throw new Error("User not found");

      const freshMyFollowing     = parseFollowList(myRec.following);
      const freshTargetFollowers = parseFollowList(targetRec.followers);
      const amFollowingFresh = freshMyFollowing.includes(targetUserid);

      const newMyFollowing = amFollowingFresh
        ? freshMyFollowing.filter(u => u !== targetUserid)
        : [...new Set([...freshMyFollowing, targetUserid])];

      const newTargetFollowers = amFollowingFresh
        ? freshTargetFollowers.filter(u => u !== currentUser.userid)
        : [...new Set([...freshTargetFollowers, currentUser.userid])];

      setMyFollowing(new Set(newMyFollowing));

      const { id: myId, ...myRecBody }         = myRec;
      const { id: targetId, ...targetRecBody } = targetRec;

      await axios.put(`${USER_API}/${myId}`, { ...myRecBody, following: serializeFollowList(newMyFollowing) });
      await axios.put(`${USER_API}/${targetId}`, { ...targetRecBody, followers: serializeFollowList(newTargetFollowers) });

      // Sync local maps
      setUsers(prev => ({
        ...prev,
        [targetUserid]:       { ...prev[targetUserid],       followers: serializeFollowList(newTargetFollowers) },
        [currentUser.userid]: { ...prev[currentUser.userid], following: serializeFollowList(newMyFollowing) },
      }));

      // Sync viewing profile
      if (viewingUser?.userid === targetUserid) {
        setViewingUser(prev => prev ? ({
          ...prev,
          followers: newTargetFollowers,
          userRec: { ...prev.userRec, followers: serializeFollowList(newTargetFollowers) },
        }) : prev);
      }
    } catch (err) {
      console.log("Follow toggle error:", err);
      try {
        const userRes = await axios.get(USER_API);
        const myRec   = userRes.data.find(u => u.userid === currentUser.userid);
        if (myRec) setMyFollowing(new Set(parseFollowList(myRec.following)));
      } catch (_) {}
    } finally {
      setFollowLoading(prev => ({ ...prev, [targetUserid]: false }));
    }
  };

  // ── POST LIKES & COMMENTS ──
  const handlePostLike = async (post) => {
    if (!currentUser) return;
    const likers = parseLikes(post.likes);
    const updatedLikers = likers.includes(currentUser.userid)
      ? likers.filter(u => u !== currentUser.userid)
      : [...likers, currentUser.userid];
    const newLikesStr = updatedLikers.join(",");
    const updatedPost = { ...post, likes: newLikesStr };

    try {
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));

      if (viewingUser && viewingUser.userid === post.userid) {
        setViewingUser(prev => prev ? ({
          ...prev,
          posts: prev.posts.map(p => p.id === post.id ? updatedPost : p)
        }) : prev);
      }

      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log(err);
    }
  };

  const handlePostComment = async (post, text, replyToUser) => {
    if (!currentUser) return;
    const replyText = replyToUser ? `@${replyToUser} ${text}` : text;
    const existing   = parseComments(post.comment);
    const updated    = [...existing, { user: currentUser.userid, text: replyText }];
    const serialized = serializeComments(updated);
    const updatedPost = { ...post, comment: serialized };

    try {
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));

      if (viewingUser && viewingUser.userid === post.userid) {
        setViewingUser(prev => prev ? ({
          ...prev,
          posts: prev.posts.map(p => p.id === post.id ? updatedPost : p)
        }) : prev);
      }

      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteComment = async (post, idx) => {
    if (!currentUser) return;
    const comments = parseComments(post.comment);
    const updated    = comments.filter((_, i) => i !== idx);
    const serialized = serializeComments(updated);
    const updatedPost = { ...post, comment: serialized };

    try {
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));

      if (viewingUser && viewingUser.userid === post.userid) {
        setViewingUser(prev => prev ? ({
          ...prev,
          posts: prev.posts.map(p => p.id === post.id ? updatedPost : p)
        }) : prev);
      }

      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log(err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0a0f", zIndex: 50 }}>
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress sx={{ color: "#ff4081" }} />
          <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'", fontSize: 13 }}>Loading Discover feed…</Typography>
        </Box>
      </Box>
    );
  }

  // Filter users based on query
  const filteredUsers = Object.values(users).filter(u =>
    u.userid && u.userid.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Filter posts by caption
  const filteredPosts = posts.filter(p => {
    const parsed = parsePostTitle(p.title);
    return parsed.caption && parsed.caption.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const followBtnProps = { myFollowing, myFollowers, followLoading, onToggle: handleFollowToggle };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0f; font-family: 'DM Sans', sans-serif; min-height: 100dvh; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,64,129,0.3); border-radius: 4px; }

        .discover-page { position: fixed; inset: 0; z-index: 50; background: #0a0a0f; display: flex; flex-direction: column; overflow: hidden; }
        .discover-page-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

        .discover-header {
          position: sticky; top: 0; z-index: 100; flex-shrink: 0;
          background: rgba(10,10,15,0.88); backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 14px 16px;
        }
        .search-results {
          margin-top: 10px;
        }
        .search-result-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;
          margin-bottom: 8px; cursor: pointer; transition: background 0.2s, border-color 0.2s;
        }
        .search-result-row:hover {
          background: rgba(255,64,129,0.05); border-color: rgba(255,64,129,0.2);
        }

        .explore-grid {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px;
          margin-top: 16px;
        }
        .explore-item {
          aspect-ratio: 1; overflow: hidden; position: relative;
          cursor: pointer; background: #1a1a24;
        }
        .explore-item img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.25s;
        }
        .explore-item:hover img {
          transform: scale(1.05);
        }
        .explore-overlay {
          position: absolute; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center; gap: 12px;
          opacity: 0; transition: opacity 0.2s;
        }
        .explore-item:hover .explore-overlay {
          opacity: 1;
        }

        .dialog-dark .MuiDialog-paper { background:#1a1a24!important; border:1px solid rgba(255,255,255,0.08)!important; border-radius:20px!important; color:#fff!important; }
        .dialog-dark .MuiInputBase-root { color:#fff!important; }
        .dialog-dark .MuiOutlinedInput-notchedOutline { border-color:rgba(255,255,255,0.1)!important; }
        .dialog-dark .MuiInputLabel-root { color:rgba(255,255,255,0.5)!important; }
        .dialog-dark .MuiDialogTitle-root { font-family:'Syne',sans-serif!important; font-weight:700!important; color:#fff!important; border-bottom:1px solid rgba(255,255,255,0.06); }

        .comment-item { padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; margin-bottom:8px; }
        .reply-btn { font-size:11px; color:rgba(255,64,129,0.7); cursor:pointer; background:none; border:none; padding:0; margin-top:4px; font-family:'DM Sans',sans-serif; display:inline-block; }
        .reply-btn:hover { color:#ff4081; }
        .liker-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(255,64,129,0.08); border:1px solid rgba(255,64,129,0.18); border-radius:20px; padding:4px 10px; margin:3px; cursor:pointer; transition:background 0.2s; }
        .liker-pill:hover { background:rgba(255,64,129,0.16); }
        .comment-input-row { display:flex; gap:8px; align-items:flex-end; padding:12px 16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.3); }

        .tab-btn { flex:1; padding:8px; border:none; cursor:pointer; font-family:'Syne',sans-serif; font-weight:700; font-size:12px; border-radius:10px; transition:background 0.2s,color 0.2s; }
        .tab-btn.active   { background:rgba(255,64,129,0.18); color:#ff80ab; border:1px solid rgba(255,64,129,0.3); }
        .tab-btn.inactive { background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.07); }

        .follow-list-item { display:flex; align-items:center; gap:10px; padding:10px 6px; border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s; border-radius:8px; }
        .follow-list-item:last-child { border-bottom:none; }
        .follow-list-item:hover { background:rgba(255,64,129,0.04); }
        .follow-list-name { cursor:pointer; }
        .follow-list-name:hover { color:#ff80ab !important; }
      `}</style>

      <div className="discover-page">
        {/* ── HEADER & SEARCH ── */}
        <div className="discover-header">
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Brand variant="small" />
            <Notifications />
          </Box>

          <TextField
            fullWidth
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search people or captions…"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "rgba(255,255,255,0.3)" }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery("")} sx={{ color: "rgba(255,255,255,0.3)" }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                background: "rgba(255,255,255,0.04)",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff"
              },
              "& .MuiOutlinedInput-notchedOutline": { border: "none" },
              "& input::placeholder": { color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans'" }
            }}
          />
        </div>

        {/* ── SEARCH RESULTS OR EXPLORE GRID ── */}
        <div className="discover-page-scroll">
          <Box sx={{ maxWidth: 500, mx: "auto", px: 2, pt: 1, pb: "96px" }}>
            {searchQuery.trim() !== "" ? (
              <div className="search-results">
                {/* People results */}
                {filteredUsers.length > 0 && (
                  <>
                    <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", mb: 1.5, textTransform: "uppercase" }}>
                      People
                    </Typography>
                    {filteredUsers.map(user => {
                      const profile = profiles[user.userid] || {};
                      const isOwn = currentUser && user.userid === currentUser.userid;
                      return (
                        <div className="search-result-row" key={user.userid} onClick={() => openUserProfile(user.userid)}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: 1 }}>
                            <Avatar src={user.profilepic} sx={{ width: 42, height: 42, background: "#ff4081", fontFamily: "'Syne'", fontWeight: 700, fontSize: 15 }}>
                              {user.userid?.[0]?.toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 14, color: "#fff", lineHeight: 1.2 }}>
                                @{user.userid}
                              </Typography>
                              {profile.profession && (
                                <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.4)", mt: 0.3 }}>
                                  {profile.profession}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          {currentUser && !isOwn && (
                            <FollowBtn uid={user.userid} stopProp {...followBtnProps} />
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Post caption results */}
                {filteredPosts.length > 0 && (
                  <>
                    <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", mb: 1.5, mt: filteredUsers.length > 0 ? 2.5 : 0, textTransform: "uppercase" }}>
                      Posts
                    </Typography>
                    {filteredPosts.map(post => {
                      const likers = parseLikes(post.likes);
                      const cmts   = parseComments(post.comment);
                      const mediaUrl = getMediaUrl(post.post);
                      return (
                        <div
                          key={post.id}
                          onClick={() => setViewPost(post)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 12px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 16, marginBottom: 8,
                            cursor: "pointer", transition: "background 0.2s, border-color 0.2s"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,64,129,0.05)"; e.currentTarget.style.borderColor = "rgba(255,64,129,0.2)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                        >
                          {/* Thumbnail */}
                          <Box sx={{ width: 52, height: 52, borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)" }}>
                            {mediaUrl ? (
                              <img src={mediaUrl} alt="post" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            ) : (
                              <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Typography sx={{ fontSize: 22 }}>📄</Typography>
                              </Box>
                            )}
                          </Box>

                          {/* Caption + author */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            {(() => {
                              const parsed = parsePostTitle(post.title);
                              return (
                                <>
                                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.4,
                                    overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical"
                                  }}>
                                    {parsed.caption}
                                  </Typography>
                                  {parsed.tags.length > 0 && (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                                      {parsed.tags.map((t, idx) => (
                                        <Chip key={idx} label={`#${t}`} size="small" sx={{ background: "rgba(255,64,129,0.08)", color: "#ff80ab", fontSize: 9.5, height: 18, border: "1px solid rgba(255,64,129,0.18)" }} />
                                      ))}
                                    </Box>
                                  )}
                                </>
                              );
                            })()}
                            <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 11, color: "#ff80ab", mt: 0.4 }}>
                              @{post.userid}
                            </Typography>
                          </Box>

                          {/* Stats */}
                          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5, flexShrink: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <FavoriteIcon sx={{ fontSize: 12, color: "#ff4081" }} />
                              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Syne'", fontWeight: 700 }}>{likers.length}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'Syne'", fontWeight: 700 }}>{cmts.length}</Typography>
                            </Box>
                          </Box>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* No results at all */}
                {filteredUsers.length === 0 && filteredPosts.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 6 }}>
                    <Typography sx={{ fontSize: 32 }}>🔍</Typography>
                    <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.3)", mt: 1 }}>No results for "{searchQuery}"</Typography>
                  </Box>
                )}
              </div>
            ) : (
              <div>
                <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", mb: 1, textTransform: "uppercase" }}>
                  Explore Posts
                </Typography>
                {posts.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <Typography sx={{ fontSize: 36 }}>📭</Typography>
                    <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.25)", mt: 1 }}>No posts to discover yet</Typography>
                  </Box>
                ) : (
                  <div className="explore-grid">
                    {posts.map((post) => {
                      const likers = parseLikes(post.likes);
                      const cmts   = parseComments(post.comment);
                      return (
                        <div className="explore-item" key={post.id} onClick={() => setViewPost(post)}>
                          <img src={post.post} alt="Explore post" onError={e => { e.target.style.display="none"; }} />
                          <div className="explore-overlay">
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <FavoriteIcon sx={{ fontSize: 14, color: "#fff" }} />
                              <Typography sx={{ fontSize: 12, color: "#fff", fontFamily: "'Syne'", fontWeight: 700 }}>{likers.length}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                              <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 13, color: "#fff" }} />
                              <Typography sx={{ fontSize: 12, color: "#fff", fontFamily: "'Syne'", fontWeight: 700 }}>{cmts.length}</Typography>
                            </Box>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Box>
        </div>
      </div>

      {/* ── DETAILED POST MODAL ── */}
      <PostDetailModal
        open={!!viewPost}
        onClose={() => setViewPost(null)}
        post={viewPost}
        usersMap={users}
        currentUser={currentUser}
        onLike={handlePostLike}
        onCommentSubmit={handlePostComment}
        onCommentDelete={handleDeleteComment}
        onOpenProfile={openUserProfile}
      />

      {/* ── PROFILE STACK OVERLAY ── */}
      {viewingUser && createPortal(
        <ProfileView
          viewingUser={viewingUser}
          currentUser={currentUser}
          myFollowing={myFollowing}
          myFollowers={myFollowers}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          onClose={() => setViewingUser(null)}
          onOpenProfile={openUserProfile}
          usersMap={users}
          profilesMap={profiles}
          onProfileUpdate={(updatedPost) => {
            setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
            setViewingUser(prev => prev ? ({
              ...prev,
              posts: prev.posts.map(p => p.id === updatedPost.id ? updatedPost : p)
            }) : null);
          }}
        />,
        document.body
      )}
    </>
  );
}
