import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Notifications from "../components/Notification";
import { PostComposer, PostCard, PostDetailModal } from "../components/posts";
import { ProfileView } from "../components/profile";
import { Brand } from "../components/ui";
import { ENDPOINTS } from "../config/api";
import {
  parseLikes,
  parseComments,
  serializeComments,
  parseFollowList,
  serializeFollowList
} from "../utils/helpers";

const POST_API    = ENDPOINTS.POSTS;
const USER_API    = ENDPOINTS.USERS;
const PROFILE_API = ENDPOINTS.PROFILES;

export default function Home() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts]       = useState([]);
  const [users, setUsers]       = useState({});
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Follow State
  const [myFollowing, setMyFollowing]   = useState(new Set());
  const [followLoading, setFollowLoading] = useState({});

  // Full-page user profile overlay stack
  const [viewingUser, setViewingUser] = useState(null);

  // Post detail modal
  const [viewPost, setViewPost] = useState(null);

  // ── INITIAL FETCH ──
  const fetchFeedData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const [postRes, userRes, profileRes] = await Promise.all([
        axios.get(POST_API),
        axios.get(USER_API),
        axios.get(PROFILE_API)
      ]);

      const userMap = {};
      userRes.data.forEach(u => { userMap[u.userid] = u; });

      const profileMap = {};
      profileRes.data.forEach(p => { profileMap[p.userid] = p; });

      if (currentUser) {
        const myRec = userRes.data.find(u => u.userid === currentUser.userid);
        if (myRec) setMyFollowing(new Set(parseFollowList(myRec.following)));
      }

      // Sort posts by id descending (newest first)
      const sortedPosts = [...postRes.data].sort((a, b) => b.id - a.id);

      setPosts(sortedPosts);
      setUsers(userMap);
      setProfiles(profileMap);
    } catch (err) {
      console.log("Error loading feed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchFeedData(true);
    }
  }, [currentUser?.userid]);

  // ── OPEN USER PROFILE ──
  const openUserProfile = useCallback(async (userid) => {
    if (!userid) return;
    setViewingUser({ loading: true, userid });
    setViewPost(null); // Close post modal if open

    try {
      const [userRes, profileRes, postRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API)
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
  }, []);

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

      // Sync viewing profile if open
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

  // ── LIKE FEED POST ──
  const handleLikePost = async (post) => {
    if (!currentUser) return;
    const currentLikers = parseLikes(post.likes);
    const isLiked = currentLikers.includes(currentUser.userid);
    const updatedLikers = isLiked
      ? currentLikers.filter(u => u !== currentUser.userid)
      : [...currentLikers, currentUser.userid];
    const newLikesStr = updatedLikers.join(",");
    const updatedPost = { ...post, likes: newLikesStr };

    try {
      // Optimistic updates
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      if (viewPost?.id === post.id) {
        setViewPost(updatedPost);
      }

      await axios.put(`${POST_API}/${post.id}`, { ...post, likes: newLikesStr });
    } catch (err) {
      console.log("Error updating like:", err);
    }
  };

  // ── ADD QUICK COMMENT ──
  const handleQuickCommentSubmit = async (post, text) => {
    if (!text || !currentUser) return;

    try {
      const existing = parseComments(post.comment);
      const updated = [...existing, { user: currentUser.userid, text }];
      const serialized = serializeComments(updated);

      const updatedPost = { ...post, comment: serialized };
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));

      await axios.put(`${POST_API}/${post.id}`, { ...post, comment: serialized });
    } catch (err) {
      console.log("Error submitting quick comment:", err);
    }
  };

  // ── POST DETAILS COMMENTS & LIKES ──
  const handlePostDetailComment = async (post, text, replyToUser) => {
    if (!currentUser) return;
    const replyText = replyToUser ? `@${replyToUser} ${text}` : text;
    const existing = parseComments(post.comment);
    const updated = [...existing, { user: currentUser.userid, text: replyText }];
    const serialized = serializeComments(updated);
    const updatedPost = { ...post, comment: serialized };

    try {
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log("Error adding detail comment:", err);
    }
  };

  const handlePostDetailCommentDelete = async (post, idx) => {
    if (!currentUser) return;
    const comments = parseComments(post.comment);
    const updated = comments.filter((_, i) => i !== idx);
    const serialized = serializeComments(updated);
    const updatedPost = { ...post, comment: serialized };

    try {
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log("Error deleting detail comment:", err);
    }
  };

  // Filter posts to show only Following Feed (posts from followed users + own posts)
  const displayedPosts = posts.filter(p => myFollowing.has(p.userid) || p.userid === currentUser?.userid);

  if (loading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0a0f", zIndex: 50 }}>
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress sx={{ color: "#ff4081" }} />
          <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'", fontSize: 13 }}>Loading Feed…</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #090b14; font-family: 'DM Sans', sans-serif; min-height: 100dvh; }

        .home-page { position: fixed; inset: 0; z-index: 50; background: #090b14; display: flex; flex-direction: column; overflow: hidden; }
        .home-page-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

        .feed-header {
          position: sticky; top: 0; z-index: 100; flex-shrink: 0;
          background: rgba(9, 11, 20, 0.92); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 12px 16px;
          display: flex; align-items: center; justify-content: space-between;
        }

        .feed-composer {
          background: linear-gradient(160deg, #1c1c28 0%, #141420 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 18px;
          margin-bottom: 20px;
        }

        .feed-card {
          background: linear-gradient(160deg, #1c1c28 0%, #141420 100%);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          margin-bottom: 20px;
          overflow: hidden;
        }

        .feed-image-container {
          position: relative;
          background: #0a0a0f;
          cursor: pointer;
          overflow: hidden;
          max-height: 500px;
        }
        .feed-image-container img {
          width: 100%; height: auto; max-height: 500px; object-fit: cover; display: block;
          transition: transform 0.3s ease;
        }
        .feed-image-container:hover img {
          transform: scale(1.015);
        }

        .feed-quick-comment {
          display: flex; gap: 8px; align-items: center;
          padding: 10px 16px 14px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }

        .tab-btn { flex: 1; padding: 8px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; border-radius: 10px; transition: background 0.2s, color 0.2s; }
        .tab-btn.active   { background: rgba(255,64,129,0.18); color: #ff80ab; border: 1px solid rgba(255,64,129,0.3); }
        .tab-btn.inactive { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.07); }

        .dialog-dark .MuiDialog-paper { background: #1a1a24 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 20px !important; color: #fff !important; }
        .dialog-dark .MuiInputBase-root { color: #fff !important; }
        .dialog-dark .MuiOutlinedInput-notchedOutline { border-color: rgba(255,255,255,0.1) !important; }
        .dialog-dark .MuiInputLabel-root { color: rgba(255,255,255,0.5) !important; }
        .dialog-dark .MuiDialogTitle-root { font-family: 'Syne', sans-serif !important; font-weight: 700 !important; color: #fff !important; border-bottom: 1px solid rgba(255,255,255,0.06); }

        .comment-item { padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 8px; }
        .reply-btn { font-size: 11px; color: rgba(255,64,129,0.7); cursor: pointer; background: none; border: none; padding: 0; margin-top: 4px; font-family: 'DM Sans', sans-serif; display: inline-block; }
        .reply-btn:hover { color: #ff4081; }
        .liker-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,64,129,0.08); border: 1px solid rgba(255,64,129,0.18); border-radius: 20px; padding: 4px 10px; margin: 3px; cursor: pointer; transition: background 0.2s; }
        .liker-pill:hover { background: rgba(255,64,129,0.16); }
        .comment-input-row { display: flex; gap: 8px; align-items: flex-end; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); }

        .follow-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; border-radius: 8px; }
        .follow-list-item:last-child { border-bottom: none; }
        .follow-list-item:hover { background: rgba(255,64,129,0.04); }
        .follow-list-name { cursor: pointer; }
        .follow-list-name:hover { color: #ff80ab !important; }
      `}</style>

      <div className="home-page">
        {/* ── HEADER ── */}
        <div className="feed-header">
          <Brand variant="small" />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton onClick={() => fetchFeedData(false)} disabled={refreshing} sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#ff4081" } }}>
              <RefreshIcon sx={{ fontSize: 22, transform: refreshing ? "rotate(360deg)" : "none", transition: "transform 0.8s ease" }} />
            </IconButton>
            <Notifications />
          </Box>
        </div>

        <div className="home-page-scroll">
          <Box sx={{ maxWidth: 500, mx: "auto", px: 2, pt: 2, pb: "96px" }}>
            
            {/* ── POST COMPOSER ── */}
            <PostComposer currentUser={currentUser} onPostCreated={() => fetchFeedData(false)} />

            {/* ── FEED LIST ── */}
            {displayedPosts.length === 0 ? (
              <Box sx={{
                textAlign: "center",
                py: 8,
                px: 3,
                background: "linear-gradient(160deg, #1c1c28 0%, #141420 100%)",
                borderRadius: "24px",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
                backdropFilter: "blur(4px)",
                mt: 2
              }}>
                <Typography sx={{ fontSize: 48, mb: 2 }}>✨</Typography>
                <Typography variant="h6" sx={{ fontFamily: "'Syne'", fontWeight: 700, color: "#fff", mb: 1 }}>
                  Your feed is empty
                </Typography>
                <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 14, color: "rgba(255,255,255,0.4)", mb: 4, maxWidth: 320, mx: "auto", lineHeight: 1.5 }}>
                  Follow other creators and users on Findcon to see their latest posts and updates show up here.
                </Typography>
                <IconButton
                  onClick={() => navigate("/discover")}
                  sx={{
                    background: "linear-gradient(135deg, #ff4081, #f50057)",
                    borderRadius: "12px",
                    textTransform: "none",
                    fontFamily: "'Syne'",
                    fontWeight: 700,
                    fontSize: 14,
                    px: 4,
                    py: 1.2,
                    boxShadow: "0 4px 20px rgba(255, 64, 129, 0.4)",
                    color: "#fff",
                    "&:hover": {
                      background: "linear-gradient(135deg, #ff80ab, #ff4081)",
                      boxShadow: "0 6px 24px rgba(255, 64, 129, 0.6)",
                      transform: "translateY(-1px)"
                    },
                    transition: "all 0.2s ease-in-out"
                  }}
                >
                  Explore Discover
                </IconButton>
              </Box>
            ) : (
              displayedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  author={users[post.userid]}
                  profile={profiles[post.userid]}
                  currentUser={currentUser}
                  myFollowing={myFollowing}
                  followLoading={followLoading}
                  onFollowToggle={handleFollowToggle}
                  onLike={handleLikePost}
                  onOpenPost={(p) => setViewPost(p)}
                  onQuickCommentSubmit={handleQuickCommentSubmit}
                  onOpenProfile={openUserProfile}
                />
              ))
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
        onLike={handleLikePost}
        onCommentSubmit={handlePostDetailComment}
        onCommentDelete={handlePostDetailCommentDelete}
        onOpenProfile={openUserProfile}
      />

      {/* ── PROFILE STACK OVERLAY ── */}
      {viewingUser && createPortal(
        <ProfileView
          viewingUser={viewingUser}
          currentUser={currentUser}
          myFollowing={myFollowing}
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