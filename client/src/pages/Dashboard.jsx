import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Avatar, CircularProgress, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Divider,
  Slider, Stack, Chip, IconButton, Snackbar, Alert, Menu, MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteIcon from "@mui/icons-material/Delete";
import EditNoteIcon from "@mui/icons-material/EditNote";
import GridOnIcon from "@mui/icons-material/GridOn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAuth } from "../context/AuthContext";
import FollowBtn from "../components/FollowBtn";
import Notifications from "../components/Notification";
import { FollowListDialog, ProfileView } from "../components/profile";
import { PostDetailModal } from "../components/posts";
import {
  parseLikes,
  parseComments,
  serializeComments,
  parseFollowList,
  serializeFollowList,
  parsePostTitle,
  getMediaUrl,
  getMediaLabel
} from "../utils/helpers";
import { Brand, MetaPill, InterestChip } from "../components/ui";
import SettingsDialog from "../components/settings/SettingsDialog";
import { ENDPOINTS, IMGBB_API_KEY } from "../config/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser, logout, updatePassword, refreshUser } = useAuth();

  const [user, setUser]       = useState(currentUser);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPic, setUploadingPic] = useState(false);

  const [usersMap, setUsersMap]       = useState({});
  const [profilesMap, setProfilesMap] = useState({});

  const [myFollowers, setMyFollowers] = useState([]);
  const [myFollowing, setMyFollowing] = useState([]);

  const [followListDialog, setFollowListDialog] = useState(null);
  const [actionLoading, setActionLoading]       = useState({});
  const [followLoading, setFollowLoading] = useState({});

  const [open, setOpen]         = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [newUserid, setNewUserid]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const picInputRef = useRef(null);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  // ── SETTINGS AND PASSWORD STATES ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showSnack = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  const [posts, setPosts]                   = useState([]);
  const [postOpen, setPostOpen]             = useState(false);
  const [postTitle, setPostTitle]           = useState("");
  const [postImageFile, setPostImageFile]   = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);
  const [uploadingPost, setUploadingPost]   = useState(false);
  const postImageRef = useRef(null);
  const [postTags, setPostTags]             = useState([]);
  const [tagInput, setTagInput]             = useState("");

  const [viewPost, setViewPost]         = useState(null);
  const [viewLikers, setViewLikers]     = useState([]);
  const [viewComments, setViewComments] = useState([]);
  const [togglingLike, setTogglingLike] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [postMenuAnchor, setPostMenuAnchor] = useState(null);
  const [postMenuTarget, setPostMenuTarget] = useState(null);

  const [editCaptionOpen, setEditCaptionOpen] = useState(false);
  const [editCaptionText, setEditCaptionText] = useState("");
  const [savingCaption, setSavingCaption]     = useState(false);

  const [deletePostConfirm, setDeletePostConfirm] = useState(false);
  const [deletingPost, setDeletingPost]           = useState(false);

  // ── FULL-PAGE PROFILE STACK ──
  const [profileStack, setProfileStack] = useState([]);

  const USER_API    = ENDPOINTS.USERS;
  const PROFILE_API = ENDPOINTS.PROFILES;
  const POST_API    = ENDPOINTS.POSTS;
  const IMGBB_KEY   = IMGBB_API_KEY;

  const [form, setForm] = useState({
    username: "", age: 18, gender: "", relationshipstatus: "",
    city: "", interests: "", othermedia: "", profession: "", bio: "",
  });

  const replaceUseridInFollowList = (raw, oldUid, newUid) =>
    parseFollowList(raw).map(uid => uid === oldUid ? newUid : uid);

  const refreshUsersMap = async () => {
    const userRes = await axios.get(USER_API);
    const uMap = {};
    userRes.data.forEach(u => { uMap[u.userid] = u; });
    setUsersMap(uMap);
    if (currentUser) {
      const myRec = userRes.data.find(u => u.userid === currentUser.userid);
      if (myRec) {
        setMyFollowers(parseFollowList(myRec.followers));
        setMyFollowing(parseFollowList(myRec.following));
      }
    }
  };

  const fetchPosts = async (userid) => {
    try {
      const res = await axios.get(POST_API);
      setPosts(res.data.filter(p => p.userid === userid));
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    setUser(currentUser);
    const fetchData = async () => {
      try {
        const [profileRes, userRes] = await Promise.all([
          axios.get(PROFILE_API),
          axios.get(USER_API),
        ]);

        const uMap = {};
        userRes.data.forEach(u => { uMap[u.userid] = u; });
        setUsersMap(uMap);

        const pMap = {};
        profileRes.data.forEach(p => { pMap[p.userid] = p; });
        setProfilesMap(pMap);

        const myRec = uMap[currentUser.userid];
        if (myRec) {
          setMyFollowers(parseFollowList(myRec.followers));
          setMyFollowing(parseFollowList(myRec.following));
        }

        const existing = pMap[currentUser.userid];
        if (existing) {
          setProfile(existing);
          const { id, ...clean } = existing;
          setForm({ ...clean, age: Number(clean.age) || 18 });
        } else {
          setForm(prev => ({ ...prev, username: currentUser.userid }));
        }

        await fetchPosts(currentUser.userid);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);



  // ── OPEN EXTERNAL PROFILE (stack) ──
  const openUserProfile = async (userid) => {
    if (!userid || userid === user?.userid) return;
    setProfileStack(prev => [...prev, { loading: true, userid }]);
    try {
      const [userRes, profileRes, postRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API),
      ]);
      const uMap = {};
      userRes.data.forEach(u => { uMap[u.userid] = u; });
      const pMap = {};
      profileRes.data.forEach(p => { pMap[p.userid] = p; });
      setUsersMap(uMap);
      setProfilesMap(pMap);

      const userRec   = uMap[userid] || { userid };
      const profRec   = pMap[userid] || {};
      const userPosts = postRes.data.filter(p => p.userid === userid).sort((a, b) => b.id - a.id);

      setProfileStack(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          userRec, profile: profRec, posts: userPosts, userid,
          followers: parseFollowList(userRec.followers),
          following: parseFollowList(userRec.following),
        };
        return next;
      });
    } catch (err) {
      console.log(err);
      setProfileStack(prev => prev.slice(0, -1));
    }
  };

  // ── FOLLOW / UNFOLLOW (Dashboard) ──
  const handleFollowToggle = async (targetUserid) => {
    if (!currentUser || followLoading[targetUserid]) return;
    setFollowLoading(prev => ({ ...prev, [targetUserid]: true }));
    try {
      const userRes = await axios.get(USER_API);
      const allUsers = userRes.data;
      const myRec = allUsers.find(u => u.userid === currentUser.userid);
      const targetRec = allUsers.find(u => u.userid === targetUserid);
      if (!myRec || !targetRec) throw new Error('User not found');

      const freshMyFollowing = parseFollowList(myRec.following);
      const freshTargetFollowers = parseFollowList(targetRec.followers);
      const amFollowingFresh = freshMyFollowing.includes(targetUserid);

      const newMyFollowing = amFollowingFresh
        ? freshMyFollowing.filter(u => u !== targetUserid)
        : [...new Set([...freshMyFollowing, targetUserid])];

      const newTargetFollowers = amFollowingFresh
        ? freshTargetFollowers.filter(u => u !== currentUser.userid)
        : [...new Set([...freshTargetFollowers, currentUser.userid])];

      // Optimistic local update
      setMyFollowing(newMyFollowing);

      const { id: myId, ...myRecBody } = myRec;
      const { id: targetId, ...targetRecBody } = targetRec;
      await axios.put(`${USER_API}/${myId}`, { ...myRecBody, following: serializeFollowList(newMyFollowing) });
      await axios.put(`${USER_API}/${targetId}`, { ...targetRecBody, followers: serializeFollowList(newTargetFollowers) });

      // Update local maps and profile stack
      setUsersMap(prev => ({
        ...prev,
        [targetUserid]: { ...prev[targetUserid], followers: serializeFollowList(newTargetFollowers) },
        [currentUser.userid]: { ...prev[currentUser.userid], following: serializeFollowList(newMyFollowing) },
      }));

      setProfileStack(prev => prev.map(p => p.userid === targetUserid ? ({ ...p, followers: newTargetFollowers }) : p));
      setFollowListDialog(prev => prev && prev.ownerUid === targetUserid && prev.title === 'Followers' ? ({ ...prev, list: newTargetFollowers }) : prev);
    } catch (err) {
      console.log('Dashboard follow toggle error:', err);
      try { await refreshUsersMap(); } catch (_) {}
    } finally {
      setFollowLoading(prev => ({ ...prev, [targetUserid]: false }));
    }
  };

  const closeTopProfile = () => {
    setProfileStack(prev => prev.slice(0, -1));
  };

  // ── REMOVE FOLLOWER ──
  const handleRemoveFollower = async (followerUid) => {
    if (actionLoading[followerUid]) return;
    setActionLoading(prev => ({ ...prev, [followerUid]: true }));
    try {
      const userRes  = await axios.get(USER_API);
      const allUsers = userRes.data;
      const myRec       = allUsers.find(u => u.userid === currentUser.userid);
      const followerRec = allUsers.find(u => u.userid === followerUid);
      if (!myRec) throw new Error("My record not found");

      const freshMyFollowers = parseFollowList(myRec.followers).filter(u => u !== followerUid);

      const { id: myId, ...myRecBody } = myRec;
      await axios.put(`${USER_API}/${myId}`, { ...myRecBody, followers: serializeFollowList(freshMyFollowers) });
      if (followerRec) {
        const freshTheirFollowing = parseFollowList(followerRec.following).filter(u => u !== currentUser.userid);
        const { id: theirId, ...theirRecBody } = followerRec;
        await axios.put(`${USER_API}/${theirId}`, { ...theirRecBody, following: serializeFollowList(freshTheirFollowing) });
      }
      await refreshUsersMap();

      setMyFollowers(freshMyFollowers);
      setFollowListDialog(prev => prev?.title === "Followers" ? { ...prev, list: freshMyFollowers } : prev);
      showSnack(`@${followerUid} removed from followers`);
    } catch (err) {
      console.log(err);
      try { await refreshUsersMap(); } catch (_) {}
      showSnack("Failed to remove follower", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [followerUid]: false }));
    }
  };

  const handleUnfollowFromList = async (targetUid) => {
    if (actionLoading[targetUid]) return;
    setActionLoading(prev => ({ ...prev, [targetUid]: true }));
    try {
      const userRes  = await axios.get(USER_API);
      const allUsers = userRes.data;
      const myRec     = allUsers.find(u => u.userid === currentUser.userid);
      const targetRec = allUsers.find(u => u.userid === targetUid);
      if (!myRec || !targetRec) throw new Error("User not found");

      const freshMyFollowing     = parseFollowList(myRec.following).filter(u => u !== targetUid);
      const freshTargetFollowers = parseFollowList(targetRec.followers).filter(u => u !== currentUser.userid);

      const { id: myId, ...myRecBody } = myRec;
      const { id: targetId, ...targetRecBody } = targetRec;
      await axios.put(`${USER_API}/${myId}`, { ...myRecBody, following: serializeFollowList(freshMyFollowing) });
      await axios.put(`${USER_API}/${targetId}`, { ...targetRecBody, followers: serializeFollowList(freshTargetFollowers) });

      await refreshUsersMap();
      setMyFollowing(freshMyFollowing);
      setFollowListDialog(prev => prev?.title === "Following" ? { ...prev, list: freshMyFollowing } : prev);
      showSnack(`Unfollowed @${targetUid}`);
    } catch (err) {
      console.log(err);
      try { await refreshUsersMap(); } catch (_) {}
      showSnack("Failed to unfollow", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUid]: false }));
    }
  };

  const handleUpdateUserid = async () => {
    try {
      if (!newUserid || !confirmPassword) return showSnack("Fill all fields", "error");
      const oldUserid = user.userid;
      const [userRes, profileRes, postRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API),
      ]);
      const users = userRes.data;
      const currentUserRec = users.find(u => u.userid === oldUserid);
      if (!currentUserRec) return showSnack("User not found", "error");
      const alreadyExists = users.find(u => u.userid === newUserid && u.id !== currentUserRec.id);
      if (alreadyExists) return showSnack("UserID already exists", "error");
      if (currentUserRec.password !== confirmPassword) return showSnack("Wrong password", "error");

      const userUpdates = [];
      users.forEach(u => {
        if (u.userid === oldUserid) return;
        const updatedFollowers = replaceUseridInFollowList(u.followers, oldUserid, newUserid);
        const updatedFollowing = replaceUseridInFollowList(u.following, oldUserid, newUserid);
        const origF = parseFollowList(u.followers);
        const origFg = parseFollowList(u.following);
        if (JSON.stringify(origF) !== JSON.stringify(updatedFollowers) || JSON.stringify(origFg) !== JSON.stringify(updatedFollowing)) {
          userUpdates.push(axios.put(`${USER_API}/${u.id}`, { ...u, followers: serializeFollowList(updatedFollowers), following: serializeFollowList(updatedFollowing) }));
        }
      });

      const postUpdates = postRes.data.filter(p => p.userid === oldUserid).map(p => axios.put(`${POST_API}/${p.id}`, { ...p, userid: newUserid }));
      const profileRecord = profileRes.data.find(p => p.userid === oldUserid);
      const requests = [
        axios.put(`${USER_API}/${currentUserRec.id}`, { ...currentUserRec, userid: newUserid }),
        ...userUpdates, ...postUpdates,
      ];
      if (profileRecord) requests.push(axios.put(`${PROFILE_API}/${profileRecord.id}`, { ...profileRecord, userid: newUserid }));

      await Promise.all(requests);
      await refreshUsersMap();

      const updatedUser = { ...user, userid: newUserid };
      setUser(updatedUser);
      refreshUser(updatedUser);
      setPosts(prev => prev.map(p => p.userid === oldUserid ? { ...p, userid: newUserid } : p));
      setEditOpen(false);
      setConfirmPassword("");
      showSnack("Username updated successfully");
    } catch (err) {
      console.log(err);
      showSnack("Update failed", "error");
    }
  };

  const handleProfilePicChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, formData);
      const url = res.data?.data?.url;
      if (!url) throw new Error("No URL returned");
      const userRes = await axios.get(USER_API);
      const currentUserRec = userRes.data.find(u => u.userid === user.userid);
      if (currentUserRec) await axios.put(`${USER_API}/${currentUserRec.id}`, { ...currentUserRec, profilepic: url });
      const updatedUser = { ...user, profilepic: url };
      setUser(updatedUser);
      refreshUser(updatedUser);
      showSnack("Profile picture updated!");
    } catch (err) {
      console.log(err);
      showSnack("Failed to upload image", "error");
    } finally {
      setUploadingPic(false);
      e.target.value = "";
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    try {
      const payload = { ...form, age: Number(form.age), userid: user.userid };
      if (profile) {
        await axios.put(`${PROFILE_API}/${profile.id}`, payload);
      } else {
        const res = await axios.post(PROFILE_API, payload);
        setProfile(res.data);
      }
      setOpen(false);
      showSnack("Profile saved");
    } catch (err) {
      console.log(err);
      showSnack("Error saving profile", "error");
    }
  };

  const handlePostImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostImageFile(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const handleCreatePost = async () => {
    if (!postImageFile) return showSnack("Please select an image", "error");
    if (!postTitle.trim()) return showSnack("Caption is required", "error");
    setUploadingPost(true);
    try {
      const formData = new FormData();
      formData.append("image", postImageFile);
      const imgRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, formData);
      const url = imgRes.data?.data?.url;
      if (!url) throw new Error("No URL");
      const titleWithTags = postTitle.trim() + (postTags.length ? " || tags:" + postTags.join(",") : "");
      await axios.post(POST_API, { post: url, userid: user.userid, likes: "", title: titleWithTags, comment: "" });
      showSnack("Post created!");
      setPostOpen(false);
      setPostTitle("");
      setPostTags([]);
      setTagInput("");
      setPostImageFile(null);
      setPostImagePreview(null);
      await fetchPosts(user.userid);
    } catch (err) {
      console.log(err);
      showSnack("Failed to create post", "error");
    } finally {
      setUploadingPost(false);
      if (postImageRef.current) postImageRef.current.value = "";
    }
  };

  const handleDeletePost = async () => {
    if (!postMenuTarget) return;
    setDeletingPost(true);
    try {
      await axios.delete(`${POST_API}/${postMenuTarget.id}`);
      setPosts(prev => prev.filter(p => p.id !== postMenuTarget.id));
      if (viewPost?.id === postMenuTarget.id) setViewPost(null);
      setDeletePostConfirm(false);
      setPostMenuTarget(null);
      showSnack("Post deleted");
    } catch (err) {
      console.log(err);
      showSnack("Failed to delete post", "error");
    } finally {
      setDeletingPost(false);
    }
  };

  const handleSaveCaption = async () => {
    if (!postMenuTarget) return;
    if (!editCaptionText.trim()) return showSnack("Caption cannot be empty", "error");
    setSavingCaption(true);
    try {
      const { tags } = parsePostTitle(postMenuTarget.title);
      const titleWithTags = editCaptionText.trim() + (tags.length ? " || tags:" + tags.join(",") : "");
      const updated = { ...postMenuTarget, title: titleWithTags };
      await axios.put(`${POST_API}/${postMenuTarget.id}`, updated);
      setPosts(prev => prev.map(p => p.id === postMenuTarget.id ? updated : p));
      if (viewPost?.id === postMenuTarget.id) setViewPost(updated);
      setEditCaptionOpen(false);
      setPostMenuTarget(null);
      showSnack("Caption updated");
    } catch (err) {
      console.log(err);
      showSnack("Failed to update caption", "error");
    } finally {
      setSavingCaption(false);
    }
  };

  const handleDeleteComment = async (post, idx) => {
    const current = parseComments(post.comment);
    const targetComment = current[idx];
    if (targetComment?.user !== user?.userid && post?.userid !== user?.userid) return;
    try {
      const updated    = current.filter((_, i) => i !== idx);
      const serialized = serializeComments(updated);
      await axios.put(`${POST_API}/${post.id}`, { ...post, comment: serialized });
      const updatedPost = { ...post, comment: serialized };
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      showSnack("Comment deleted");
    } catch (err) {
      console.log(err);
      showSnack("Failed to delete comment", "error");
    }
  };

  const openViewPost = (post) => {
    setViewPost(post);
  };

  const handleToggleLike = async (post) => {
    if (togglingLike) return;
    setTogglingLike(true);
    try {
      const currentLikers = parseLikes(post.likes);
      const updatedLikers = currentLikers.includes(user.userid)
        ? currentLikers.filter(u => u !== user.userid)
        : [...currentLikers, user.userid];
      const newLikesStr = updatedLikers.join(",");
      const updatedPost = { ...post, likes: newLikesStr };
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log(err);
      showSnack("Failed to update like", "error");
    } finally {
      setTogglingLike(false);
    }
  };

  const handleAddComment = async (post, commentText, replyToUser) => {
    if (submittingComment) return;
    setSubmittingComment(true);
    try {
      const currentComments = parseComments(post.comment);
      const text       = replyToUser ? `@${replyToUser} ${commentText.trim()}` : commentText.trim();
      const updated    = [...currentComments, { user: user.userid, text }];
      const serialized = serializeComments(updated);
      const updatedPost = { ...post, comment: serialized };
      setViewPost(updatedPost);
      setPosts(prev => prev.map(p => p.id === post.id ? updatedPost : p));
      await axios.put(`${POST_API}/${post.id}`, updatedPost);
    } catch (err) {
      console.log(err);
      showSnack("Failed to add comment", "error");
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "#0f0f13", zIndex: 50 }}>
        <CircularProgress sx={{ color: "#ff4081" }} />
      </Box>
    );
  }

  const interests = form.interests?.split(",").map(i => i.trim()).filter(Boolean) || [];
  const mediaUrl  = getMediaUrl(form.othermedia);

  const chipSx = (active) => ({
    background: active ? "#ff4081" : "rgba(255,255,255,0.08)",
    color: active ? "#fff" : "rgba(255,255,255,0.6)",
    border: "1px solid",
    borderColor: active ? "#ff4081" : "rgba(255,255,255,0.12)",
    fontFamily: "'DM Sans'",
    "&:hover": { background: active ? "#e91e63" : "rgba(255,255,255,0.12)" },
  });

  const saveBtnSx = {
    background: "#ff4081",
    "&:hover": { background: "#e91e63" },
    borderRadius: 2,
    fontFamily: "'Syne'",
    fontWeight: 700,
    textTransform: "none",
  };

  const [customInterest, setCustomInterest] = useState("");

  const handleAddCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (!trimmed) return;
    const current = form.interests ? form.interests.split(",").map(s => s.trim()).filter(Boolean) : [];
    const exists = current.some(t => t.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const updated = [...current, trimmed];
      setForm({ ...form, interests: updated.join(", ") });
    }
    setCustomInterest("");
  };

  const interestPresets = [
    "Music","Art","Travel","Gaming","Fitness","Photography",
    "Movies","Books","Food","Tech","Fashion","Sports",
    "Dance","Nature","Cooking","Anime","Pets","Comedy",
  ];
  const toggleInterest = (tag) => {
    const current = form.interests ? form.interests.split(",").map(s => s.trim()).filter(Boolean) : [];
    const exists  = current.includes(tag);
    const updated = exists ? current.filter(t => t !== tag) : [...current, tag];
    setForm({ ...form, interests: updated.join(", ") });
  };

  const tagStyle = {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.5)"
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #0f0f13; font-family: 'DM Sans', sans-serif; min-height: 100dvh; }

        .dashboard-page { position: fixed; inset: 0; z-index: 50; background: #0f0f13; overflow-y: auto; -webkit-overflow-scrolling: touch; }

        .profile-card { background: linear-gradient(160deg, #1c1c28 0%, #141420 100%); border: 1px solid rgba(255,255,255,0.07); border-radius: 28px; overflow: hidden; position: relative; }
        .hero-strip { background: linear-gradient(145deg, #200a1a 0%, #2e0e26 45%, #1a0f22 100%); padding: 36px 24px 0; position: relative; overflow: hidden; }
        .hero-strip::before { content: ''; position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M26 1l3.5 6h7L32 11.5l2.5 6.5-8.5-3-8.5 3L20 11.5 15.5 7h7z' fill='%23ff4081' fill-opacity='0.04'/%3E%3C/svg%3E"); opacity: 0.6; pointer-events: none; }
        .hero-glow { position: absolute; top: -60px; left: 50%; transform: translateX(-50%); width: 240px; height: 240px; background: radial-gradient(circle, rgba(255,64,129,0.22) 0%, transparent 70%); pointer-events: none; }
        .avatar-ring { position: relative; width: 96px; height: 96px; margin: 0 auto 14px; }
        .avatar-ring::before { content: ''; position: absolute; inset: -3px; border-radius: 50%; background: conic-gradient(#ff4081, #ff80ab, #f50057, #ff4081); animation: spinRing 5s linear infinite; z-index: 0; }
        @keyframes spinRing { to { transform: rotate(360deg); } }
        .avatar-inner { position: absolute; inset: 2px; border-radius: 50%; overflow: hidden; z-index: 1; background: #1a1a24; }
        .camera-btn { position: absolute !important; bottom: 0; right: 0; z-index: 2; width: 28px !important; height: 28px !important; background: #ff4081 !important; border: 2px solid #1a0f22 !important; color: #fff !important; border-radius: 50% !important; }
        .section-label { font-family: 'Syne', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
        .stat-tile { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 11px 8px; text-align: center; transition: background 0.2s, border-color 0.2s; }
        .stat-tile:hover { background: rgba(255,64,129,0.08); border-color: rgba(255,64,129,0.2); }
        .hero-stats-row { display: flex; border-top: 1px solid rgba(255,255,255,0.07); margin-top: 20px; }
        .hero-stat-block { flex: 1; text-align: center; padding: 12px 4px; border-right: 1px solid rgba(255,255,255,0.07); cursor: pointer; transition: background 0.18s; }
        .hero-stat-block:last-child { border-right: none; }
        .hero-stat-block:hover { background: rgba(255,64,129,0.07); }
        .hero-stat-block.no-click { cursor: default; }
        .hero-stat-block.no-click:hover { background: transparent; }
        .interest-chip { background: rgba(255,64,129,0.1) !important; color: #ff80ab !important; border: 1px solid rgba(255,64,129,0.22) !important; font-family: 'DM Sans', sans-serif !important; font-size: 11.5px !important; font-weight: 500 !important; border-radius: 20px !important; transition: background 0.2s !important; }
        .interest-chip:hover { background: rgba(255,64,129,0.2) !important; }
        .bio-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 13px 15px; }
        .media-row { display: flex; align-items: center; gap: 10px; background: rgba(255,64,129,0.08); border: 1px solid rgba(255,64,129,0.2); border-radius: 14px; padding: 11px 14px; cursor: pointer; text-decoration: none; transition: background 0.2s, border-color 0.2s; }
        .media-row:hover { background: rgba(255,64,129,0.16); border-color: rgba(255,64,129,0.4); }
        .edit-btn { background: linear-gradient(135deg, #ff4081, #f50057) !important; border-radius: 14px !important; font-family: 'Syne', sans-serif !important; font-weight: 700 !important; font-size: 15px !important; letter-spacing: 0.5px !important; text-transform: none !important; padding: 12px !important; box-shadow: 0 4px 20px rgba(255,64,129,0.35) !important; transition: box-shadow 0.2s, transform 0.15s !important; }
        .edit-btn:hover { box-shadow: 0 6px 28px rgba(255,64,129,0.52) !important; transform: translateY(-1px); }

        .dialog-dark .MuiDialog-paper { background: #1a1a24 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 20px !important; color: #fff !important; }
        .dialog-dark .MuiInputBase-root { color: #fff !important; }
        .dialog-dark .MuiOutlinedInput-notchedOutline { border-color: rgba(255,255,255,0.15) !important; }
        .dialog-dark .MuiInputLabel-root { color: rgba(255,255,255,0.5) !important; }
        .dialog-dark .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline { border-color: rgba(255,64,129,0.5) !important; }
        .dialog-dark .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline { border-color: #ff4081 !important; }

        .profile-grid-posts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 3px; }
        .profile-post-item { aspect-ratio: 1; overflow: hidden; background: #1a1a24; position: relative; cursor: pointer; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .profile-post-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s; }
        .profile-post-item:hover img { transform: scale(1.04); }
        .profile-post-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; gap: 12px; opacity: 0; transition: opacity 0.2s; }
        .profile-post-item:hover .profile-post-hover { opacity: 1; }

        .tab-btn { flex: 1; padding: 8px; border: none; cursor: pointer; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; border-radius: 10px; transition: background 0.2s, color 0.2s; }
        .tab-btn.active   { background: rgba(255,64,129,0.18); color: #ff80ab; border: 1px solid rgba(255,64,129,0.3) !important; }
        .tab-btn.inactive { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.07) !important; }

        .fl-action-btn { border: none; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 11px; padding: 4px 12px; border-radius: 16px; cursor: pointer; transition: all 0.2s; }
        .fl-action-btn.remove { background: rgba(255,82,82,0.1); color: #ff5252; border: 1px solid rgba(255,82,82,0.25); }
        .fl-action-btn.remove:hover { background: rgba(255,82,82,0.2); }
        .fl-action-btn.unfollow { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.15); }
        .fl-action-btn.unfollow:hover { background: rgba(255,64,64,0.1); color: #ff6b6b; border-color: rgba(255,64,64,0.25); }

        .follow-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; border-radius: 8px; }
        .follow-list-item:last-child { border-bottom: none; }
        .follow-list-item:hover { background: rgba(255,64,129,0.04); }

        .comment-item { padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 8px; }
        .reply-btn { font-size: 11px; color: rgba(255,64,129,0.7); cursor: pointer; background: none; border: none; padding: 0; margin-top: 4px; font-family: 'DM Sans', sans-serif; display: inline-block; }
        .reply-btn:hover { color: #ff4081; }
        .liker-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,64,129,0.08); border: 1px solid rgba(255,64,129,0.18); border-radius: 20px; padding: 4px 10px; margin: 3px; cursor: pointer; transition: background 0.2s; }
        .liker-pill:hover { background: rgba(255,64,129,0.16); }
        .comment-input-row { display: flex; gap: 8px; align-items: flex-end; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); }
      `}</style>

      <div className="dashboard-page">
        <Box sx={{ maxWidth: 500, mx: "auto", px: 2, pt: 3, pb: "96px" }}>
          {/* Header */}
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
            <Brand variant="small" />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Notifications />
              <IconButton
                onClick={() => {
                  setSettingsOpen(true);
                }}
                sx={{
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  p: 1,
                  "&:hover": { background: "rgba(255,64,129,0.04)", color: "#ff80ab" }
                }}
              >
                <SettingsIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Profile Card */}
          <div className="profile-card">
            <div className="hero-strip">
              <div className="hero-glow" />
              <div className="avatar-ring">
                <div className="avatar-inner">
                  <Avatar src={user?.profilepic} sx={{ width: "100%", height: "100%", borderRadius: 0 }}>
                    {user?.userid?.[0]?.toUpperCase()}
                  </Avatar>
                </div>
                <IconButton className="camera-btn" size="small" onClick={() => picInputRef.current?.click()} disabled={uploadingPic}>
                  {uploadingPic ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : <CameraAltIcon sx={{ fontSize: 13 }} />}
                </IconButton>
                <input type="file" ref={picInputRef} accept="image/*" hidden onChange={handleProfilePicChange} />
              </div>

              <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 22, color: "#fff", textAlign: "center", letterSpacing: "-0.3px", mb: 0.5 }}>
                @{user?.userid}
              </Typography>

              {profile?.profession && (
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                  <Box sx={{ px: 1.4, py: 0.4, borderRadius: "20px", background: "rgba(255,64,129,0.15)", border: "1px solid rgba(255,64,129,0.3)" }}>
                    <Typography sx={{ fontSize: 11, color: "#ff80ab", fontFamily: "'DM Sans'", fontWeight: 500 }}>
                      {profile.profession}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Stats Row */}
              <div className="hero-stats-row">
                <div className="hero-stat-block no-click">
                  <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 19, color: "#fff", lineHeight: 1 }}>{posts.length}</Typography>
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 10.5, color: "rgba(255,255,255,0.45)", mt: 0.4, fontWeight: 600 }}>Posts</Typography>
                </div>
                <div className="hero-stat-block" onClick={() => setFollowListDialog({ title: "Followers", list: myFollowers, ownerUid: currentUser?.userid })}>
                  <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 19, color: "#fff", lineHeight: 1 }}>{myFollowers.length}</Typography>
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 10.5, color: "rgba(255,255,255,0.45)", mt: 0.4, fontWeight: 600 }}>Followers</Typography>
                </div>
                <div className="hero-stat-block" onClick={() => setFollowListDialog({ title: "Following", list: myFollowing, ownerUid: currentUser?.userid })}>
                  <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 19, color: "#fff", lineHeight: 1 }}>{myFollowing.length}</Typography>
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 10.5, color: "rgba(255,255,255,0.45)", mt: 0.4, fontWeight: 600 }}>Following</Typography>
                </div>
              </div>
            </div>

            {/* Profile Info Details */}
            <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3.5 }}>
              {/* Bio */}
              <Box>
                <div className="section-label">Biography</div>
                <div className="bio-box">
                  <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans'", lineHeight: 1.6, fontStyle: profile?.bio ? "normal" : "italic" }}>
                    {profile?.bio ? `"${profile.bio}"` : "No bio added yet. Tell people about yourself!"}
                  </Typography>
                </div>
              </Box>

              {/* Attributes Pills */}
              <Box>
                <div className="section-label">Details</div>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                  {profile?.age && <MetaPill>🎂 {profile.age} years old</MetaPill>}
                  {profile?.gender && <MetaPill>⚧ {profile.gender}</MetaPill>}
                  {profile?.city && <MetaPill>📍 Lives in {profile.city}</MetaPill>}
                  {profile?.relationshipstatus && <MetaPill>💞 {profile.relationshipstatus}</MetaPill>}
                </Box>
              </Box>

              {/* Interests */}
              <Box>
                <div className="section-label">Interests</div>
                {interests.length > 0 ? (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8 }}>
                    {interests.map((tag, idx) => (
                      <InterestChip key={idx} label={tag} />
                    ))}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 12.5, color: "rgba(255,255,255,0.3)", fontStyle: "italic", fontFamily: "'DM Sans'" }}>
                    No interests selected
                  </Typography>
                )}
              </Box>

              {/* Other Media Link */}
              {profile?.othermedia?.trim() && mediaUrl && (
                <Box>
                  <div className="section-label">External Links</div>
                  <a href={mediaUrl} target="_blank" rel="noreferrer" className="media-row">
                    <LinkIcon sx={{ fontSize: 16, color: "#ff80ab" }} />
                    <Typography sx={{ flex: 1, fontSize: 13, color: "#ff80ab", fontFamily: "'DM Sans'", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getMediaLabel(profile.othermedia)}
                    </Typography>
                    <OpenInNewIcon sx={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }} />
                  </a>
                </Box>
              )}

              {/* Edit Buttons */}
              <Stack direction="row" spacing={1.5}>
                <Button fullWidth variant="contained" className="edit-btn" startIcon={<EditIcon sx={{ fontSize: 16 }} />} onClick={() => setOpen(true)}>
                  Edit Details
                </Button>
                <Button fullWidth variant="outlined" startIcon={<EditNoteIcon />} onClick={() => { setNewUserid(user.userid); setEditOpen(true); }}
                  sx={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", borderRadius: "14px", textTransform: "none", fontFamily: "'Syne'", fontSize: 14.5, fontWeight: 600, "&:hover": { borderColor: "#ff4081", background: "rgba(255,64,129,0.04)" } }}>
                  Change Username
                </Button>
              </Stack>
            </Box>
          </div>

          {/* Posts Section */}
          <Box sx={{ mt: 5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <GridOnIcon sx={{ fontSize: 15, color: "rgba(255,255,255,0.4)" }} />
                <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "1.5px", textTransform: "uppercase" }}>My Posts</Typography>
              </Box>
              <Button size="small" onClick={() => setPostOpen(true)} sx={{ textTransform: "none", fontFamily: "'Syne'", fontWeight: 700, color: "#ff4081" }}>
                + Add Post
              </Button>
            </Box>

            {posts.length > 0 ? (
              <div className="profile-grid-posts">
                {posts.map(post => {
                  const likers   = parseLikes(post.likes);
                  const comments = parseComments(post.comment);
                  return (
                    <div className="profile-post-item" key={post.id} onClick={() => openViewPost(post)}>
                      <img src={post.post} alt="User post" onError={e => { e.target.style.display = "none"; }} />
                      <div className="profile-post-hover">
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                          <FavoriteIcon sx={{ fontSize: 13, color: "#fff" }} />
                          <Typography sx={{ fontSize: 11, color: "#fff", fontFamily: "'Syne'", fontWeight: 700 }}>{likers.length}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
                          <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 12, color: "#fff" }} />
                          <Typography sx={{ fontSize: 11, color: "#fff", fontFamily: "'Syne'", fontWeight: 700 }}>{comments.length}</Typography>
                        </Box>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Box sx={{ textAlign: "center", py: 6, background: "rgba(255,255,255,0.02)", borderRadius: 4, border: "1px dashed rgba(255,255,255,0.07)" }}>
                <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontStyle: "italic", fontFamily: "'DM Sans'" }}>No posts uploaded yet</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </div>

      {/* ── CREATE POST DIALOG ── */}
      <Dialog open={postOpen} onClose={() => setPostOpen(false)} fullWidth maxWidth="xs" className="dialog-dark">
        <DialogTitle sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", py: 1.5 }}>Create Post</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <TextField fullWidth multiline rows={3} label="Caption" value={postTitle} onChange={e => setPostTitle(e.target.value)} margin="dense" />
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1.5, mb: 2.5 }}>
            <TextField size="small" label="Add Tags" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { setPostTags([...new Set([...postTags, tagInput.trim().replace(/^#/, "")])]); setTagInput(""); } }} />
            <Button variant="outlined" onClick={() => { if (tagInput.trim()) { setPostTags([...new Set([...postTags, tagInput.trim().replace(/^#/, "")])]); setTagInput(""); } }} sx={{ textTransform: "none", borderColor: "rgba(255,255,255,0.12)", color: "#fff", height: 38 }}>Add</Button>
          </Box>
          {postTags.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, mb: 3 }}>
              {postTags.map(t => <Chip key={t} label={`#${t}`} size="small" onDelete={() => setPostTags(postTags.filter(x => x !== t))} sx={{ background: "rgba(255,64,129,0.1)", color: "#ff80ab" }} />)}
            </Box>
          )}
          {postImagePreview && (
            <Box sx={{ position: "relative", borderRadius: 3, overflow: "hidden", mb: 2, border: "1px solid rgba(255,255,255,0.1)" }}>
              <img src={postImagePreview} alt="Preview" style={{ width: "100%", display: "block" }} />
              <IconButton onClick={() => { setPostImageFile(null); setPostImagePreview(null); }} sx={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff" }} size="small"><CloseIcon /></IconButton>
            </Box>
          )}
          <Button variant="outlined" component="label" fullWidth startIcon={<AddPhotoAlternateIcon />} sx={{ py: 1.2, textTransform: "none", color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.12)", "&:hover": { borderColor: "#ff4081" } }}>
            Upload Image
            <input type="file" ref={postImageRef} accept="image/*" hidden onChange={handlePostImageSelect} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Button onClick={() => setPostOpen(false)} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreatePost} disabled={uploadingPost || !postImageFile || !postTitle.trim()} sx={saveBtnSx}>
            {uploadingPost ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Post"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── EDIT PROFILE DIALOG ── */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth className="dialog-dark">
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <TextField name="profession" label="Profession" fullWidth margin="dense" value={form.profession} onChange={handleChange} />
          <TextField name="city" label="City" fullWidth margin="dense" value={form.city} onChange={handleChange} />
          <TextField name="bio" label="Bio" fullWidth margin="dense" multiline rows={2} value={form.bio} onChange={handleChange} />
          <TextField name="othermedia" label="External Link (Other Media)" fullWidth margin="dense" value={form.othermedia} onChange={handleChange} />
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: 13 }}>Age: <b style={{ color: "#ff4081" }}>{form.age}</b></Typography>
          <Slider value={Number(form.age) || 18} min={18} max={80} onChange={(e, val) => setForm({ ...form, age: Array.isArray(val) ? val[0] : Number(val) })} />
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontWeight: 600, fontFamily: "'Syne'", mb: 1 }}>Gender</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {["Male","Female","Non-binary"].map(g => <Chip key={g} label={g} clickable onClick={() => setForm({ ...form, gender: g })} sx={chipSx(form.gender === g)} />)}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontWeight: 600, fontFamily: "'Syne'", mb: 1 }}>Relationship Status</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {["Single","In a relationship","Married","Complicated"].map(s => <Chip key={s} label={s} clickable onClick={() => setForm({ ...form, relationshipstatus: s })} sx={chipSx(form.relationshipstatus === s)} />)}
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontWeight: 600, fontFamily: "'Syne'", mb: 1, fontSize: 13.5 }}>Selected Interests</Typography>
          {interests.length > 0 ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1.5 }}>
              {interests.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  onDelete={() => toggleInterest(tag)}
                  sx={{
                    background: "rgba(255,64,129,0.12)",
                    color: "#ff80ab",
                    border: "1px solid rgba(255,64,129,0.22)",
                    fontFamily: "'DM Sans'",
                    fontSize: 12,
                    "& .MuiChip-deleteIcon": { color: "#ff80ab", "&:hover": { color: "#ff4081" } }
                  }}
                />
              ))}
            </Stack>
          ) : (
            <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.4)", mb: 1.5, fontStyle: "italic" }}>
              No interests added yet. Click presets below or add a custom one!
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 1, mt: 1, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Add custom interest..."
              value={customInterest}
              onChange={e => setCustomInterest(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomInterest();
                }
              }}
              sx={{
                flex: 1,
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "10px",
                  fontSize: "12.5px",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                  "&.Mui-focused fieldset": { borderColor: "#ff4081" }
                }
              }}
            />
            <Button
              variant="contained"
              onClick={handleAddCustomInterest}
              sx={{
                background: "linear-gradient(135deg,#ff4081,#f50057)",
                borderRadius: "10px",
                textTransform: "none",
                fontFamily: "'Syne'",
                fontWeight: 700,
                fontSize: 12.5,
                px: 2
              }}
            >
              Add
            </Button>
          </Box>

          <Typography sx={{ fontWeight: 600, fontFamily: "'Syne'", mb: 1, fontSize: 13.5 }}>Preset Suggestions</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {interestPresets.map(tag => {
              const active = interests.includes(tag);
              return <Chip key={tag} label={tag} clickable onClick={() => toggleInterest(tag)} sx={chipSx(active)} />;
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} sx={saveBtnSx}>Save Changes</Button>
        </DialogActions>
      </Dialog>

      {/* ── EDIT USERNAME DIALOG ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs" className="dialog-dark">
        <DialogTitle>Change Username</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="New Username" value={newUserid} onChange={e => setNewUserid(e.target.value.toLowerCase().replace(/\s/g, ""))} margin="dense" />
          <TextField fullWidth type="password" label="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} margin="dense" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateUserid} sx={saveBtnSx}>Update Username</Button>
        </DialogActions>
      </Dialog>

      {/* ── DETAILED POST MODAL ── */}
      <PostDetailModal
        open={!!viewPost}
        onClose={() => setViewPost(null)}
        post={viewPost}
        usersMap={usersMap}
        currentUser={currentUser}
        onLike={handleToggleLike}
        onCommentSubmit={handleAddComment}
        onCommentDelete={handleDeleteComment}
        onOpenProfile={openUserProfile}
        headerAction={
          viewPost?.userid === currentUser?.userid && (
            <IconButton size="small" onClick={e => { setPostMenuAnchor(e.currentTarget); setPostMenuTarget(viewPost); }} sx={{ color: "rgba(255,255,255,0.4)", "&:hover": { color: "#ff80ab" } }}>
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )
        }
      />

      {/* ── FOLLOWERS / FOLLOWING LIST POPUP DIALOG ── */}
      {followListDialog && (
        <FollowListDialog
          open={!!followListDialog}
          onClose={() => setFollowListDialog(null)}
          title={followListDialog.title}
          list={followListDialog.list}
          ownerUid={followListDialog.ownerUid}
          usersMap={usersMap}
          profilesMap={profilesMap}
          currentUser={currentUser}
          myFollowing={new Set(myFollowing)}
          myFollowers={new Set(myFollowers)}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          onOpenProfile={openUserProfile}
          onRemoveFollower={handleRemoveFollower}
          onUnfollowFromList={handleUnfollowFromList}
          actionLoading={actionLoading}
        />
      )}

      {/* ── PROFILE STACK OVERLAY ── */}
      {profileStack.length > 0 && (
        <ProfileView
          profileStack={profileStack}
          currentUser={currentUser}
          myFollowing={new Set(myFollowing)}
          myFollowers={new Set(myFollowers)}
          followLoading={followLoading}
          onFollowToggle={handleFollowToggle}
          onClose={closeTopProfile}
          onOpenProfile={openUserProfile}
          usersMap={usersMap}
          profilesMap={profilesMap}
          onProfileUpdate={(updatedPost) => {
            // Update the post inside the active profile stack
            setProfileStack(prev => prev.map(p =>
              p.userid === updatedPost.userid
                ? { ...p, posts: p.posts?.map(pp => pp.id === updatedPost.id ? updatedPost : pp) }
                : p
            ));
          }}
        />
      )}

      {/* ── POST ACTIONS MENU (Edit/Delete own posts) ── */}
      <Menu anchorEl={postMenuAnchor} open={!!postMenuAnchor} onClose={() => { setPostMenuAnchor(null); setPostMenuTarget(null); }}
        PaperProps={{ sx: { background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", borderRadius: 3 } }}>
        <MenuItem onClick={() => { setEditCaptionText(parsePostTitle(postMenuTarget?.title).caption); setEditCaptionOpen(true); setPostMenuAnchor(null); }} sx={{ gap: 1, fontSize: 13.5, fontFamily: "'DM Sans'" }}>
          <EditIcon sx={{ fontSize: 16, color: "#ff80ab" }} /> Edit Caption
        </MenuItem>
        <MenuItem onClick={() => { setDeletePostConfirm(true); setPostMenuAnchor(null); }} sx={{ gap: 1, fontSize: 13.5, color: "#ff5252", fontFamily: "'DM Sans'" }}>
          <DeleteIcon sx={{ fontSize: 16 }} /> Delete Post
        </MenuItem>
      </Menu>

      {/* ── EDIT CAPTION DIALOG ── */}
      <Dialog open={editCaptionOpen} onClose={() => { setEditCaptionOpen(false); setPostMenuTarget(null); }} fullWidth maxWidth="xs" className="dialog-dark">
        <DialogTitle>Edit Caption</DialogTitle>
        <DialogContent>
          <TextField fullWidth multiline rows={3} label="Caption" value={editCaptionText} onChange={e => setEditCaptionText(e.target.value)} margin="dense" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setEditCaptionOpen(false); setPostMenuTarget(null); }} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCaption} disabled={savingCaption} sx={saveBtnSx}>
            {savingCaption ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── DELETE POST CONFIRM DIALOG ── */}
      <Dialog open={deletePostConfirm} onClose={() => { setDeletePostConfirm(false); setPostMenuTarget(null); }} fullWidth maxWidth="xs" className="dialog-dark">
        <DialogTitle sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", py: 1.5 }}>Delete Post</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 14.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
            Are you sure you want to delete this post? This action is permanent and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Button onClick={() => { setDeletePostConfirm(false); setPostMenuTarget(null); }} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleDeletePost} disabled={deletingPost} sx={{ background: "#ff5252", "&:hover": { background: "#e53935" }, borderRadius: 2, fontFamily: "'Syne'", fontWeight: 700, textTransform: "none" }}>
            {deletingPost ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── SETTINGS DIALOG POPUP ── */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentUser={currentUser}
        updatePassword={updatePassword}
        logout={logout}
        showSnack={showSnack}
        navigate={navigate}
      />

      {/* Snackbar alerts */}
      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} sx={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
