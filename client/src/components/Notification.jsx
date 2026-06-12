import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  Box, IconButton, Badge, Dialog, DialogTitle, DialogContent,
  Tab, Tabs, Typography, Avatar, List, ListItem, ListItemAvatar,
  ListItemText, Divider, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Snackbar, Chip
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CloseIcon from "@mui/icons-material/Close";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import CommentIcon from "@mui/icons-material/Comment";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import SendIcon from "@mui/icons-material/Send";
import LockIcon from "@mui/icons-material/Lock";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweepOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GridOnIcon from "@mui/icons-material/GridOn";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { useAuth } from "../context/AuthContext";
import FollowBtn from "./FollowBtn";
import { ProfileView } from "./profile";
import {
  parseLikes,
  parseComments,
  serializeComments,
  parseFollowList,
  serializeFollowList,
  getMediaUrl,
  parsePostTitle
} from "../utils/helpers";

const USER_API    = "https://retoolapi.dev/4M2wEM/credentials";
const POST_API    = "https://retoolapi.dev/1Rdejb/post";
const CHAT_API    = "https://retoolapi.dev/6cs4kq/message";
const PROFILE_API = "https://retoolapi.dev/X1QiCR/persona";

export default function Notifications() {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Notifications state
  const [activities, setActivities] = useState([]);
  const [confessions, setConfessions] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [allUsersMap, setAllUsersMap] = useState({});

  // Deleted activity IDs (stored in localStorage)
  const getDeletedActivityIds = () => {
    if (!currentUser) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(`deletedActivities_${currentUser.userid}`) || "[]"));
    } catch { return new Set(); }
  };

  const saveDeletedActivityIds = (set) => {
    if (!currentUser) return;
    localStorage.setItem(`deletedActivities_${currentUser.userid}`, JSON.stringify([...set]));
  };

  const getSeenActivityIds = () => {
    if (!currentUser) return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(`seenActivities_${currentUser.userid}`) || "[]")); }
    catch { return new Set(); }
  };
  const saveSeenActivityIds = (set) => {
    if (!currentUser) return;
    localStorage.setItem(`seenActivities_${currentUser.userid}`, JSON.stringify([...set]));
  };

  // Deleted confession indices (stored in localStorage as timestamps)
  const getDeletedConfessionTimestamps = () => {
    if (!currentUser) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(`deletedConfessions_${currentUser.userid}`) || "[]"));
    } catch { return new Set(); }
  };

  const saveDeletedConfessionTimestamps = (set) => {
    if (!currentUser) return;
    localStorage.setItem(`deletedConfessions_${currentUser.userid}`, JSON.stringify([...set]));
  };

  // Send Confession state
  const [showSendConfession, setShowSendConfession] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [confessionText, setConfessionText] = useState("");
  const [sendingConfession, setSendingConfession] = useState(false);

  // Badge count tracking
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastViewedAt, setLastViewedAt] = useState(0);

  // Toast alert
  const [toast, setToast] = useState({ open: false, msg: "", severity: "success" });
  const showToast = (msg, severity = "success") => setToast({ open: true, msg, severity });

  // Format date/time for display — shows relative time for recent, absolute for older
  const formatActivityTime = (ts) => {
    if (!ts) return "";
    const diff  = Date.now() - ts;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (diff  < 60000)  return "Just now";
    if (mins  < 60)     return mins + "m ago";
    if (hours < 24)     return hours + "h ago";
    if (days  < 7)      return days + "d ago";
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  // ── PROFILE VIEW STATE ──
  const [viewingUser, setViewingUser] = useState(null);
  const [profilesMap, setProfilesMap] = useState({});
  const [followListDialog, setFollowListDialog] = useState(null);
  const [myFollowing, setMyFollowing] = useState(new Set());
  const [followLoading, setFollowLoading] = useState({});

  const fetchNotificationData = async () => {
    if (!currentUser) return;
    try {
      const [userRes, postRes, chatRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(POST_API),
        axios.get(CHAT_API)
      ]);

      const userMap = {};
      userRes.data.forEach(u => { userMap[u.userid] = u; });
      setAllUsersMap(userMap);

      const myRec = userRes.data.find(u => u.userid === currentUser.userid);
      if (myRec) {
        setFollowers(parseFollowList(myRec.followers));
        setMyFollowing(new Set(parseFollowList(myRec.following)));
      }

      // 1. Generate Activity Notifications
      const allPosts = postRes.data;
      const myPosts = allPosts.filter(p => p.userid === currentUser.userid);
      const activityFeed = [];

      // Use post.timelaps if available; otherwise fall back to id-rank fake timestamps.
      const allIds = allPosts.map(p => Number(p.id)).filter(Boolean);
      const maxId  = allIds.length ? Math.max(...allIds) : 1;
      const now    = Date.now();

      const idToFakeTs = (id) => {
        const rank = maxId - Number(id); // 0 = newest
        return now - (1 * 3600000) - (rank * 6 * 3600000);
      };

      const getPostTs = (post) => {
        return idToFakeTs(post.id);
      };

      // Load persisted notifications from localStorage
      const persistedKey = `persisted_notifications_${currentUser.userid}`;
      const persistedStr = localStorage.getItem(persistedKey);
      let persistedNotifications = persistedStr ? JSON.parse(persistedStr) : [];

      // ─── A. LIKES DETECTION (TRANSITION SENSITIVE) ───
      const knownLikesKey = `knownLikes_${currentUser.userid}`;
      const knownLikesStr = localStorage.getItem(knownLikesKey);
      let knownLikes = knownLikesStr ? JSON.parse(knownLikesStr) : {};
      let hasNewLikes = false;

      myPosts.forEach(post => {
        const parsedTitle = parsePostTitle(post.title);
        const currentLikers = parseLikes(post.likes)
          .filter(u => u && u.trim() !== "" && u !== currentUser.userid);
        
        let prevLikers = knownLikes[post.id];
        let isFirstPostLoad = false;
        if (!prevLikers) {
          isFirstPostLoad = true;
          prevLikers = currentLikers;
          knownLikes[post.id] = currentLikers;
          hasNewLikes = true;
        }

        // Detect new likes
        const newLikers = isFirstPostLoad ? [] : currentLikers.filter(u => !prevLikers.includes(u));
        newLikers.forEach(uid => {
          persistedNotifications.push({
            id: `like-${post.id}-${uid}-${Date.now()}`,
            type: "like",
            user: uid,
            post: post,
            text: `liked your post "${parsedTitle.caption.slice(0, 20)}..."`,
            timestamp: Date.now(),
            postTs: Date.now(),
          });
          hasNewLikes = true;
        });

        // Always update known likes for the post (including removing those who unliked)
        if (JSON.stringify(prevLikers) !== JSON.stringify(currentLikers)) {
          knownLikes[post.id] = currentLikers;
          hasNewLikes = true;
        }
      });

      if (hasNewLikes) {
        localStorage.setItem(knownLikesKey, JSON.stringify(knownLikes));
      }

      // ─── B. FOLLOWERS DETECTION (TRANSITION SENSITIVE) ───
      const currentFollowers = myRec ? parseFollowList(myRec.followers) : [];
      const knownFollowersStr = localStorage.getItem(`knownFollowers_${currentUser.userid}`);
      let knownFollowers = [];
      let isFirstFollowersLoad = false;

      if (knownFollowersStr) {
        knownFollowers = JSON.parse(knownFollowersStr);
      } else {
        isFirstFollowersLoad = true;
        knownFollowers = currentFollowers;
        localStorage.setItem(`knownFollowers_${currentUser.userid}`, JSON.stringify(currentFollowers));
      }

      // Detect new followers
      const newFollowers = isFirstFollowersLoad ? [] : currentFollowers
        .filter(f => f && f.trim() !== "" && !knownFollowers.includes(f) && f !== currentUser.userid);

      let hasNewFollowers = false;
      newFollowers.forEach(followerUid => {
        persistedNotifications.push({
          id: `follow-${followerUid}-${Date.now()}`,
          type: "follow",
          user: followerUid,
          text: `started following you`,
          timestamp: Date.now(),
          postTs: Date.now(),
        });
        hasNewFollowers = true;
      });

      // Always update known followers (including removing those who unfollowed)
      if (JSON.stringify(knownFollowers) !== JSON.stringify(currentFollowers)) {
        localStorage.setItem(`knownFollowers_${currentUser.userid}`, JSON.stringify(currentFollowers));
      }

      // Save persisted notifications if any updates occurred
      if (hasNewLikes || hasNewFollowers) {
        localStorage.setItem(persistedKey, JSON.stringify(persistedNotifications));
      }

      // Add persisted notifications to feed
      persistedNotifications.forEach(notif => {
        // Safe check to refresh the post object reference from current posts fetch
        if (notif.type === "like" && notif.post) {
          const freshPost = myPosts.find(p => p.id === notif.post.id);
          if (!freshPost) {
            // Post was deleted, so skip this notification!
            return;
          }
          notif.post = freshPost;
        }
        activityFeed.push(notif);
      });

      // ─── C. COMMENTS & MENTIONS (DYNAMICALLY GENERATED) ───
      myPosts.forEach(post => {
        const postTs = getPostTs(post);
        // Safety: Only show comments from OTHER users (not current user)
        const comments = parseComments(post.comment)
          .filter(c => c.user && c.user.trim() !== "" && c.user !== currentUser.userid && c.text && c.text.trim() !== "");
        comments.forEach((c, idx) => {
          if (c.user === currentUser.userid) return;
          activityFeed.push({
            id: `comment-${post.id}-${c.user}-${idx}`,
            type: "comment",
            user: c.user,
            post: post,
            text: `commented: "${c.text.slice(0, 30)}..." on your post`,
            postTs,
            timestamp: postTs + 2 + idx,
          });
        });
      });

      // Mentions - Safety: Only show mentions from OTHER users
      allPosts.forEach(post => {
        const postTs = getPostTs(post);
        const comments = parseComments(post.comment);
        comments.forEach((c, idx) => {
          if (c.user && c.user !== currentUser.userid && c.text && c.text.includes(`@${currentUser.userid}`)) {
            if (c.user === currentUser.userid) return;
            activityFeed.push({
              id: `mention-${post.id}-${c.user}-${idx}`,
              type: "mention",
              user: c.user,
              post: post,
              text: `mentioned you in a comment: "${c.text.slice(0, 30)}..."`,
              postTs,
              timestamp: postTs + 3 + idx,
            });
          }
        });
      });

      activityFeed.sort((a, b) => b.timestamp - a.timestamp);

      const deletedIds = getDeletedActivityIds();
      const filteredActivities = activityFeed.filter(a => !deletedIds.has(a.id));
      setActivities(filteredActivities);

      // 2. Load Confessions
      const confessionsRow = chatRes.data.find(c => c.receiverid === "[CONFESSIONS]");
      const receivedConfessions = [];
      if (confessionsRow && confessionsRow.message) {
        const entries = confessionsRow.message.split("||").map(s => s.trim()).filter(Boolean);
        entries.forEach(entry => {
          const firstColon = entry.indexOf(":");
          if (firstColon === -1) return;
          const recipient = entry.slice(0, firstColon).trim();
          const rest = entry.slice(firstColon + 1).trim();

          const tsIdx = rest.lastIndexOf("::");
          let text = rest;
          let timestamp = Date.now();
          if (tsIdx !== -1) {
            text = rest.slice(0, tsIdx);
            timestamp = Number(rest.slice(tsIdx + 2)) || Date.now();
          }

          if (recipient === currentUser.userid) {
            receivedConfessions.push({ text, timestamp });
          }
        });
      }
      receivedConfessions.sort((a, b) => b.timestamp - a.timestamp);

      const deletedConf = getDeletedConfessionTimestamps();
      setConfessions(receivedConfessions.filter(c => !deletedConf.has(c.timestamp)));

      // 3. Compute unread count
      const seenIds      = getSeenActivityIds();
      const deletedIds2  = getDeletedActivityIds();
      const deletedConf2 = getDeletedConfessionTimestamps();
      const lastViewedConfessions = Number(localStorage.getItem(`lastViewedConfessions_${currentUser.userid}`)) || 0;

      const unreadActivity = activityFeed.filter(a => !seenIds.has(a.id) && !deletedIds2.has(a.id)).length;
      const unreadConf     = receivedConfessions.filter(c => c.timestamp > lastViewedConfessions && !deletedConf2.has(c.timestamp)).length;
      setUnreadCount(unreadActivity + unreadConf);
    } catch (err) {
      console.log("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotificationData();
    const interval = setInterval(fetchNotificationData, 12000);
    return () => clearInterval(interval);
  }, [currentUser?.userid]);

  const handleOpen = () => {
    setOpen(true);
    setUnreadCount(0);
    if (currentUser) {
      setTimeout(() => {
        const seen = getSeenActivityIds();
        activities.forEach(a => seen.add(a.id));
        saveSeenActivityIds(seen);
        setLastViewedAt(Date.now());
      }, 1500);
      localStorage.setItem(`lastViewedConfessions_${currentUser.userid}`, String(Date.now()));
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (currentUser) {
      if (newValue === 0) localStorage.setItem(`lastViewedActivity_${currentUser.userid}`, String(Date.now()));
      else localStorage.setItem(`lastViewedConfessions_${currentUser.userid}`, String(Date.now()));
    }
  };

  // ── DELETE SINGLE ACTIVITY ──
  const deleteActivity = (id) => {
    const deleted = getDeletedActivityIds();
    deleted.add(id);
    saveDeletedActivityIds(deleted);
    setActivities(prev => prev.filter(a => a.id !== id));
    
    // Also remove from persisted_notifications
    const persistedKey = `persisted_notifications_${currentUser.userid}`;
    const persistedStr = localStorage.getItem(persistedKey);
    if (persistedStr) {
      const persisted = JSON.parse(persistedStr);
      const updated = persisted.filter(a => a.id !== id);
      localStorage.setItem(persistedKey, JSON.stringify(updated));
    }
  };

  // ── CLEAR ALL ACTIVITIES ──
  const clearAllActivities = () => {
    const allIds = activities.map(a => a.id);
    const deleted = getDeletedActivityIds();
    allIds.forEach(id => deleted.add(id));
    saveDeletedActivityIds(deleted);
    setActivities([]);

    // Clear persisted_notifications
    localStorage.removeItem(`persisted_notifications_${currentUser.userid}`);
  };

  // ── DELETE SINGLE CONFESSION ──
  const deleteConfession = (timestamp) => {
    const deleted = getDeletedConfessionTimestamps();
    deleted.add(timestamp);
    saveDeletedConfessionTimestamps(deleted);
    setConfessions(prev => prev.filter(c => c.timestamp !== timestamp));
  };

  // ── CLEAR ALL CONFESSIONS ──
  const clearAllConfessions = () => {
    const deleted = getDeletedConfessionTimestamps();
    confessions.forEach(c => deleted.add(c.timestamp));
    saveDeletedConfessionTimestamps(deleted);
    setConfessions([]);
  };

  // ── OPEN USER PROFILE ──
  const openUserProfile = useCallback(async (userid) => {
    if (!userid) return;
    setViewingUser({ loading: true, userid });
    try {
      const [userRes, profileRes, postRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API),
      ]);
      const userRec   = userRes.data.find(u => u.userid === userid) || { userid };
      const profile   = profileRes.data.find(p => p.userid === userid) || {};
      const userPosts = postRes.data.filter(p => p.userid === userid).sort((a, b) => b.id - a.id);
      const foll      = parseFollowList(userRec.followers);
      const following = parseFollowList(userRec.following);

      const userMap = {};
      userRes.data.forEach(u => { userMap[u.userid] = u; });
      setAllUsersMap(userMap);

      const profMap = {};
      profileRes.data.forEach(p => { profMap[p.userid] = p; });
      setProfilesMap(profMap);

      setViewingUser({ userRec, profile, posts: userPosts, userid, followers: foll, following });
    } catch (err) {
      console.log(err);
      setViewingUser(null);
    }
  }, []);

  // ── FOLLOW TOGGLE (same logic as Home.jsx) ──
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
      const amFollowing          = freshMyFollowing.includes(targetUserid);

      const newMyFollowing = amFollowing
        ? freshMyFollowing.filter(u => u !== targetUserid)
        : [...new Set([...freshMyFollowing, targetUserid])];
      const newTargetFollowers = amFollowing
        ? freshTargetFollowers.filter(u => u !== currentUser.userid)
        : [...new Set([...freshTargetFollowers, currentUser.userid])];

      setMyFollowing(new Set(newMyFollowing));

      const { id: myId, ...myRecBody }         = myRec;
      const { id: targetId, ...targetRecBody } = targetRec;
      await axios.put(`${USER_API}/${myId}`,     { ...myRecBody,     following: serializeFollowList(newMyFollowing) });
      await axios.put(`${USER_API}/${targetId}`, { ...targetRecBody, followers: serializeFollowList(newTargetFollowers) });

      setAllUsersMap(prev => ({
        ...prev,
        [targetUserid]:       { ...prev[targetUserid],       followers: serializeFollowList(newTargetFollowers) },
        [currentUser.userid]: { ...prev[currentUser.userid], following: serializeFollowList(newMyFollowing) },
      }));

      if (viewingUser?.userid === targetUserid) {
        setViewingUser(prev => prev ? ({
          ...prev,
          followers: newTargetFollowers,
          userRec: { ...prev.userRec, followers: serializeFollowList(newTargetFollowers) },
        }) : prev);
      }

      if (followListDialog?.ownerUid === targetUserid) {
        setFollowListDialog(prev => prev ? ({ ...prev, list: newTargetFollowers }) : null);
      }
      if (followListDialog?.ownerUid === currentUser.userid && followListDialog?.title === "Following") {
        setFollowListDialog(prev => prev ? ({ ...prev, list: newMyFollowing }) : null);
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



  // ── SEND CONFESSION ──
  const handleSendConfessionSubmit = async () => {
    if (!selectedRecipient || !confessionText.trim() || !currentUser) {
      return showToast("Please fill all fields", "error");
    }
    setSendingConfession(true);
    try {
      const chatRes = await axios.get(CHAT_API);
      let confessionsRow = chatRes.data.find(c => c.receiverid === "[CONFESSIONS]");
      const timestamp = Date.now();
      const newItem = `${selectedRecipient}:${confessionText.trim()}::${timestamp}`;

      if (confessionsRow) {
        const updatedMessage = confessionsRow.message
          ? `${confessionsRow.message}||${newItem}` : newItem;
        await axios.put(`${CHAT_API}/${confessionsRow.id}`, { ...confessionsRow, message: updatedMessage, timestamp: new Date().toISOString() });
      } else {
        await axios.post(CHAT_API, { userid: "anonymous", receiverid: "[CONFESSIONS]", message: newItem, timestamp: new Date().toISOString(), isRead: false });
      }

      showToast("Anonymous confession sent!");
      setConfessionText("");
      setSelectedRecipient("");
      setShowSendConfession(false);
      fetchNotificationData();
    } catch (err) {
      showToast("Failed to send confession", "error");
    } finally {
      setSendingConfession(false);
    }
  };

  // ── FOLLOW BUTTON INLINE ──
  const FollowBtnInline = ({ uid }) => {
    const isMe = currentUser && uid === currentUser.userid;
    if (isMe) return null;
    const isFollowing = myFollowing.has(uid);
    const loading = followLoading[uid];
    const followsMe = followers.includes(uid);
    const showFollowBack = !isFollowing && followsMe;
    return (
      <button
        className={`notif-follow-btn ${isFollowing ? "following" : showFollowBack ? "follow-back" : "not-following"}`}
        onClick={e => { e.stopPropagation(); handleFollowToggle(uid); }}
        disabled={loading}
      >
        {loading ? <CircularProgress size={11} sx={{ color: "inherit" }} /> : isFollowing ? "Following" : showFollowBack ? "Follow Back" : "Follow"}
      </button>
    );
  };

  return (
    <>
      <style>{`
        @keyframes spinRing { to { transform: rotate(360deg); } }
        @keyframes slideInLeft { from { transform: translateX(100%); opacity: 0.6; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInUp { from { transform: translateY(100%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        .notif-follow-btn {
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 11px;
          padding: 3px 12px; border-radius: 20px; border: none; cursor: pointer;
          transition: all 0.18s; letter-spacing: 0.3px; min-width: 68px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .notif-follow-btn.not-following { background: linear-gradient(135deg,#ff4081,#f50057); color: #fff; box-shadow: 0 2px 10px rgba(255,64,129,0.35); }
        .notif-follow-btn.not-following:hover { box-shadow: 0 3px 14px rgba(255,64,129,0.55); transform: translateY(-1px); }
        .notif-follow-btn.follow-back { background: linear-gradient(135deg,#7c3aed,#a855f7); color: #fff; box-shadow: 0 2px 10px rgba(124,58,237,0.30); }
        .notif-follow-btn.follow-back:hover { box-shadow: 0 3px 14px rgba(124,58,237,0.50); transform: translateY(-1px); }
        .notif-follow-btn.following { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.12) !important; }
        .notif-follow-btn.following:hover { background: rgba(255,64,64,0.1); color: #ff6b6b; border-color: rgba(255,64,64,0.25) !important; }
        .notif-follow-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

        .notif-delete-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 8px; color: rgba(255,255,255,0.25); display: flex; align-items: center; transition: color 0.18s, background 0.18s; flex-shrink: 0; }
        .notif-delete-btn:hover { color: #ff5252; background: rgba(255,82,82,0.1); }

        /* ─── PROFILE PAGE ─── */
        .notif-profile-page { position: fixed; inset: 0; z-index: 9999; background: #0a0a0f; display: flex; flex-direction: column; overflow: hidden; animation: slideInUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .notif-profile-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,15,0.92); backdrop-filter: blur(20px); flex-shrink: 0; }
        .notif-profile-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

        .uprofile-hero { background: linear-gradient(160deg,#1c0a15 0%,#2a0e22 50%,#160a1e 100%); padding: 32px 20px 24px; position: relative; overflow: hidden; text-align: center; }
        .uprofile-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% -20%,rgba(255,64,129,0.25) 0%,transparent 65%); pointer-events: none; }
        .uprofile-avatar-ring { position: relative; width: 88px; height: 88px; margin: 0 auto 14px; }
        .uprofile-avatar-ring::before { content: ''; position: absolute; inset: -3px; border-radius: 50%; background: conic-gradient(#ff4081,#ff80ab,#f50057,#ff4081); animation: spinRing 5s linear infinite; z-index: 0; }
        .uprofile-avatar-inner { position: absolute; inset: 2px; border-radius: 50%; overflow: hidden; z-index: 1; background: #1a1a24; }

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

        /* ─── POST FULL VIEW ─── */
        .notif-profile-post-view { position: fixed; inset: 0; z-index: 10000; background: #0a0a0f; display: flex; flex-direction: column; animation: slideInUp 0.22s cubic-bezier(0.22,1,0.36,1) both; }
        .notif-profile-post-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,15,0.92); backdrop-filter: blur(20px); flex-shrink: 0; }

        .comment-item { padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 8px; }
        .reply-btn { font-size: 11px; color: rgba(255,64,129,0.7); cursor: pointer; background: none; border: none; padding: 0; margin-top: 4px; font-family: 'DM Sans',sans-serif; display: inline-block; }
        .reply-btn:hover { color: #ff4081; }
        .liker-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,64,129,0.08); border: 1px solid rgba(255,64,129,0.18); border-radius: 20px; padding: 4px 10px; margin: 3px; cursor: pointer; transition: background 0.2s; }
        .liker-pill:hover { background: rgba(255,64,129,0.16); }
        .comment-input-row { display: flex; gap: 8px; align-items: flex-end; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); }
        .tab-btn { flex: 1; padding: 8px; border: none; cursor: pointer; font-family: 'Syne',sans-serif; font-weight: 700; font-size: 12px; border-radius: 10px; transition: background 0.2s, color 0.2s; }
        .tab-btn.active   { background: rgba(255,64,129,0.18); color: #ff80ab; border: 1px solid rgba(255,64,129,0.3) !important; }
        .tab-btn.inactive { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.07) !important; }

        .follow-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; border-radius: 8px; }
        .follow-list-item:last-child { border-bottom: none; }
        .follow-list-item:hover { background: rgba(255,64,129,0.04); }
        .follow-list-name { cursor: pointer; }
        .follow-list-name:hover { color: #ff80ab !important; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,64,129,0.3); border-radius: 4px; }
      `}</style>

      <IconButton onClick={handleOpen} sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#ff4081" } }}>
        <Badge badgeContent={unreadCount} color="error" sx={{ "& .MuiBadge-badge": { background: "#ff4081", fontSize: 9, fontWeight: 700 } }}>
          <NotificationsIcon sx={{ fontSize: 22 }} />
        </Badge>
      </IconButton>

      {/* ── NOTIFICATIONS DIALOG ── */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs"
        PaperProps={{ sx: { background: "#161622", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", color: "#fff", maxHeight: "82dvh" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.06)", px: 2 }}>
          <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 16 }}>Notifications</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {activeTab === 0 && activities.length > 0 && (
              <IconButton size="small" onClick={clearAllActivities} title="Clear all activity"
                sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "#ff5252", background: "rgba(255,82,82,0.1)" } }}>
                <DeleteSweepIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            {activeTab === 1 && confessions.length > 0 && !showSendConfession && (
              <IconButton size="small" onClick={clearAllConfessions} title="Clear all confessions"
                sx={{ color: "rgba(255,255,255,0.35)", "&:hover": { color: "#ff5252", background: "rgba(255,82,82,0.1)" } }}>
                <DeleteSweepIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.4)" }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth"
          sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", "& .MuiTabs-indicator": { backgroundColor: "#ff4081" } }}>
          <Tab label="Activity" sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12.5, color: "rgba(255,255,255,0.4)", "&.Mui-selected": { color: "#ff80ab" }, textTransform: "none" }} />
          <Tab label="Confessions" sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12.5, color: "rgba(255,255,255,0.4)", "&.Mui-selected": { color: "#ff80ab" }, textTransform: "none" }} />
        </Tabs>

        <DialogContent sx={{ p: 0, overflowY: "auto" }}>
          {activeTab === 0 ? (
            activities.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8, px: 3, opacity: 0.4 }}>
                <NotificationsIcon sx={{ fontSize: 48, mb: 1, color: "rgba(255,255,255,0.3)" }} />
                <Typography sx={{ fontSize: 13, fontFamily: "'DM Sans'" }}>No new activities yet.</Typography>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {activities.map((act) => (
                  <React.Fragment key={act.id}>
                    {(() => {
                      const seenIdsNow = getSeenActivityIds();
                      const isUnread = !seenIdsNow.has(act.id);
                      const timeStr = formatActivityTime(act.postTs || act.timestamp);
                      return (
                        <ListItem sx={{
                          py: 1.2, px: 2, gap: 1, alignItems: "center",
                          background: isUnread ? "rgba(255,64,129,0.07)" : "transparent",
                          borderLeft: isUnread ? "3px solid #ff4081" : "3px solid transparent",
                          transition: "background 0.2s",
                          "&:hover": { background: isUnread ? "rgba(255,64,129,0.11)" : "rgba(255,64,129,0.04)" },
                        }}>
                          <ListItemAvatar sx={{ minWidth: 44 }}>
                            <Avatar
                              onClick={() => { setOpen(false); openUserProfile(act.user); }}
                              sx={{
                                background: act.type === "like" ? "rgba(255,64,129,0.15)" : act.type === "comment" ? "rgba(76,206,172,0.15)" : act.type === "follow" ? "rgba(76,206,172,0.15)" : "rgba(33,150,243,0.15)",
                                color: act.type === "like" ? "#ff4081" : act.type === "comment" ? "#4cceac" : act.type === "follow" ? "#4cceac" : "#2196f3",
                                cursor: "pointer", width: 36, height: 36,
                                "&:hover": { opacity: 0.8 }
                              }}>
                              {act.type === "like" ? <FavoriteIcon sx={{ fontSize: 17 }} /> : act.type === "comment" ? <CommentIcon sx={{ fontSize: 15 }} /> : act.type === "follow" ? <PersonAddIcon sx={{ fontSize: 17 }} /> : <AlternateEmailIcon sx={{ fontSize: 15 }} />}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            sx={{ "& .MuiListItemText-secondary": { color: "rgba(255,255,255,0.28) !important" } }}
                            primary={
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                                <Typography sx={{ fontSize: 12.5, fontFamily: "'DM Sans'", color: "rgba(255,255,255,0.9)", lineHeight: 1.45 }}>
                                  <span
                                    style={{ fontWeight: 700, color: "#ff80ab", cursor: "pointer" }}
                                    onClick={() => { setOpen(false); openUserProfile(act.user); }}
                                  >
                                    @{act.user}
                                  </span>{" "}{act.text}
                                </Typography>
                                {isUnread && (
                                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4081", flexShrink: 0, boxShadow: "0 0 6px #ff4081" }} />
                                )}
                              </Box>
                            }
                            secondary={
                              timeStr ? (
                                <Typography sx={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", fontFamily: "'DM Sans'", mt: 0.3 }}>
                                  🕐 {timeStr}
                                </Typography>
                              ) : null
                            }
                          />
                          <button className="notif-delete-btn" onClick={() => deleteActivity(act.id)} title="Delete">
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </button>
                        </ListItem>
                      );
                    })()}
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.04)" }} />
                  </React.Fragment>
                ))}
              </List>
            )
          ) : (
            /* ── CONFESSIONS TAB ── */
            <Box sx={{ p: 2.5 }}>
              {!showSendConfession ? (
                <>
                  <Button fullWidth onClick={() => setShowSendConfession(true)} variant="contained"
                    startIcon={<LockIcon sx={{ fontSize: 14 }} />}
                    sx={{ background: "linear-gradient(135deg,#ff4081,#f50057)", textTransform: "none", fontFamily: "'Syne'", fontWeight: 700, borderRadius: "12px", py: 1.2, mb: 2.5, boxShadow: "0 4px 12px rgba(255,64,129,0.25)" }}>
                    Send Secret Confession
                  </Button>

                  <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", mb: 1.5 }}>
                    Inbox (Anonymous Secret Messages)
                  </Typography>

                  {confessions.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 5, opacity: 0.35 }}>
                      <Typography sx={{ fontSize: 32, mb: 1 }}>🤫</Typography>
                      <Typography sx={{ fontSize: 12.5, fontStyle: "italic", fontFamily: "'DM Sans'" }}>Your confession inbox is empty.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {confessions.map((conf, idx) => (
                        <Box key={idx} sx={{ p: 2, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", animation: "fadeUp 0.3s ease both", position: "relative" }}>
                          <button
                            className="notif-delete-btn"
                            onClick={() => deleteConfession(conf.timestamp)}
                            title="Delete"
                            style={{ position: "absolute", top: 8, right: 8 }}
                          >
                            <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                          </button>
                          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans'", lineHeight: 1.55, pr: 3 }}>
                            "{conf.text}"
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'", mt: 1.2, display: "block", textAlign: "right" }}>
                            🕰️ Received {new Date(conf.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, animation: "fadeUp 0.25s ease both" }}>
                  <Typography variant="h6" sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 15, color: "#fff", display: "flex", alignItems: "center", gap: 1 }}>
                    🤫 New Confession
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Sans'", lineHeight: 1.5 }}>
                    Send a secret, completely anonymous message. Only people in your followers list can be selected.
                  </Typography>

                  <FormControl fullWidth margin="dense" sx={{
                    "& .MuiOutlinedInput-root": { color: "#fff", background: "rgba(255,255,255,0.04)", borderRadius: "12px" },
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
                    "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.45)" },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#ff4081" }
                  }}>
                    <InputLabel id="recipient-label">Select Recipient</InputLabel>
                    <Select labelId="recipient-label" value={selectedRecipient} label="Select Recipient" onChange={e => setSelectedRecipient(e.target.value)}>
                      {followers.length === 0 ? (
                        <MenuItem disabled value=""><Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>No followers available</Typography></MenuItem>
                      ) : (
                        followers.map(uid => <MenuItem key={uid} value={uid}>@{uid}</MenuItem>)
                      )}
                    </Select>
                  </FormControl>

                  <TextField fullWidth multiline rows={4} label="Secret Message"
                    placeholder="Type your anonymous confession here..."
                    value={confessionText} onChange={e => setConfessionText(e.target.value)}
                    sx={{
                      "& .MuiOutlinedInput-root": { color: "#fff", background: "rgba(255,255,255,0.04)", borderRadius: "12px" },
                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
                      "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.45)" },
                      "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#ff4081" }
                    }}
                  />

                  <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
                    <Button fullWidth onClick={() => { setShowSendConfession(false); setConfessionText(""); setSelectedRecipient(""); }} variant="outlined"
                      sx={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", borderRadius: "10px", textTransform: "none", fontFamily: "'Syne'" }}>
                      Cancel
                    </Button>
                    <Button fullWidth onClick={handleSendConfessionSubmit}
                      disabled={!selectedRecipient || !confessionText.trim() || sendingConfession}
                      variant="contained"
                      endIcon={sendingConfession ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <SendIcon sx={{ fontSize: 13 }} />}
                      sx={{ background: "linear-gradient(135deg,#ff4081,#f50057)", borderRadius: "10px", textTransform: "none", fontFamily: "'Syne'", fontWeight: 700 }}>
                      Send Anonymously
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast({ ...toast, open: false })} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast({ ...toast, open: false })} sx={{ width: "100%", borderRadius: "10px" }}>
          {toast.msg}
        </Alert>
      </Snackbar>

      {/* ── FULL-PAGE USER PROFILE ── */}
      {viewingUser && createPortal(
        <ProfileView
          viewingUser={viewingUser}
          currentUser={currentUser}
          myFollowing={myFollowing}
          myFollowers={new Set(followers)}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          onClose={() => setViewingUser(null)}
          onOpenProfile={openUserProfile}
          usersMap={allUsersMap}
          profilesMap={profilesMap}
          onProfileUpdate={(updatedPost) => {
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