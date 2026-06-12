import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import Notifications from "../components/Notification";
import { MatchingCard } from "../components/matching";
import { ProfileView } from "../components/profile";
import { Brand } from "../components/ui";
import { ENDPOINTS } from "../config/api";
import {
  parseLikes,
  parseComments,
  parseFollowList,
  serializeFollowList
} from "../utils/helpers";

const USER_API    = ENDPOINTS.USERS;
const PROFILE_API = ENDPOINTS.PROFILES;
const POST_API    = ENDPOINTS.POSTS;

export default function Matches() {
  const { currentUser } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Users Map
  const [allUsersMap, setAllUsersMap] = useState({});
  const [profilesMap, setProfilesMap] = useState({});

  // Follow states
  const [myFollowing, setMyFollowing]   = useState(new Set());
  const [myFollowers, setMyFollowers]   = useState(new Set());
  const [followLoading, setFollowLoading] = useState({});

  // Drag states
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const cardRef = useRef(null);

  // Transition animations
  const [swipeDir, setSwipeDir]       = useState(null);
  const [animatingOut, setAnimatingOut] = useState(false);
  const [recentAction, setRecentAction] = useState(null);

  // Profile overlay state
  const [viewingUser, setViewingUser] = useState(null);

  const fetchProfiles = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [uR, pR, poR] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API),
      ]);

      const myUser = uR.data.find(u => u.userid === currentUser.userid);
      const myProfile = pR.data.find(p => p.userid === currentUser.userid);

      if (myUser) {
        setMyFollowing(new Set(parseFollowList(myUser.following)));
        setMyFollowers(new Set(parseFollowList(myUser.followers)));
      }

      const usersMap = {};
      uR.data.forEach(u => { usersMap[u.userid] = u; });
      setAllUsersMap(usersMap);

      const profMap = {};
      pR.data.forEach(p => { profMap[p.userid] = p; });
      setProfilesMap(profMap);

      if (!myProfile) {
        setProfiles([]);
        return;
      }

      const myInterests = myProfile.interests ? myProfile.interests.split(",").map(i => i.trim().toLowerCase()).filter(Boolean) : [];

      const list = [];
      pR.data.forEach(p => {
        if (p.userid === currentUser.userid) return;
        const otherUser = usersMap[p.userid];
        if (!otherUser) return;

        const otherInterests = p.interests ? p.interests.split(",").map(i => i.trim().toLowerCase()).filter(Boolean) : [];
        const matches = myInterests.filter(i => otherInterests.includes(i));

        const interestScore = myInterests.length > 0 ? (matches.length / myInterests.length) * 100 : 0;
        let score = Math.round(interestScore);
        if (p.city?.toLowerCase() === myProfile.city?.toLowerCase()) {
          score = Math.min(100, score + 15);
        }

        const followsMe = otherUser.following ? parseFollowList(otherUser.following).includes(currentUser.userid) : false;

        list.push({
          userid: p.userid,
          profile: p,
          userRec: otherUser,
          score,
          interests: p.interests ? p.interests.split(",").map(i => i.trim()) : [],
          matchedTags: matches.map(m => m.charAt(0).toUpperCase() + m.slice(1)),
          followsMe
        });
      });

      // Sort by match score descending
      list.sort((a, b) => b.score - a.score);

      setProfiles(list);
      setCurrentIndex(0);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [currentUser]);

  // Swipe gesture triggers
  const triggerSwipe = (dir) => {
    if (animatingOut) return;
    const current = currentIndex < profiles.length ? profiles[currentIndex] : null;
    if (!current) return;

    setSwipeDir(dir);
    setAnimatingOut(true);

    setTimeout(() => {
      handleAction(dir, current);
      setCurrentIndex(prev => prev + 1);
      setDragOffset({ x: 0, y: 0 });
      setSwipeDir(null);
      setAnimatingOut(false);
    }, 350);
  };

  const handleAction = async (action, profileObj) => {
    const name = profileObj.userid;
    setRecentAction({ type: action === "right" ? "follow" : "pass", name });

    if (action === "right") {
      await handleFollowToggle(name, true);
    }
  };

  // Pointer event gesture handlers
  const handlePointerDown = (e) => {
    if (animatingOut || viewingUser) return;

    // Prevent dragging when clicking interactive elements (buttons, links, etc.)
    const target = e.target;
    if (
      target.closest("button") ||
      target.closest(".m-actions") ||
      target.closest(".MuiButtonBase-root") ||
      window.getComputedStyle(target).cursor === "pointer"
    ) {
      return;
    }

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    cardRef.current?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setDragOffset({ x: dx, y: dy });

    if (dx > 40)       setSwipeDir("right");
    else if (dx < -40) setSwipeDir("left");
    else               setSwipeDir(null);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.target.releasePointerCapture?.(e.pointerId);
    if (dragOffset.x > 120)       triggerSwipe("right");
    else if (dragOffset.x < -120) triggerSwipe("left");
    else { setDragOffset({ x: 0, y: 0 }); setSwipeDir(null); }
  };

  // ── PROFILE VIEWER ──
  const openUserProfile = useCallback(async (userid) => {
    if (!userid) return;
    setViewingUser({ loading: true, userid });
    try {
      const [uR, pR, poR] = await Promise.all([
        axios.get(USER_API),
        axios.get(PROFILE_API),
        axios.get(POST_API)
      ]);
      const userRec = uR.data.find(u => u.userid === userid) || { userid };
      const profile = pR.data.find(p => p.userid === userid) || {};
      const posts   = poR.data.filter(p => p.userid === userid).sort((a, b) => b.id - a.id);
      const uMap = {};
      uR.data.forEach(u => { uMap[u.userid] = u; });
      setAllUsersMap(uMap);
      setViewingUser({ userRec, profile, posts, userid, followers: parseFollowList(userRec.followers), following: parseFollowList(userRec.following) });
    } catch (err) {
      console.log(err);
      setViewingUser(null);
    }
  }, []);

  const handleFollowToggle = async (targetUserid, forceFollow = false) => {
    if (!currentUser || followLoading[targetUserid]) return;
    setFollowLoading(p => ({ ...p, [targetUserid]: true }));
    try {
      const r = await axios.get(USER_API);
      const myRec = r.data.find(u => u.userid === currentUser.userid);
      const tRec  = r.data.find(u => u.userid === targetUserid);
      if (!myRec || !tRec) throw new Error();

      const freshMy = parseFollowList(myRec.following);
      const freshT  = parseFollowList(tRec.followers);
      const amF = freshMy.includes(targetUserid);

      // If forceFollow is true (like on swiping right), force adding follower
      const nextFollowState = forceFollow ? true : !amF;

      const newMy = !nextFollowState 
        ? freshMy.filter(u => u !== targetUserid) 
        : [...new Set([...freshMy, targetUserid])];
      const newT  = !nextFollowState 
        ? freshT.filter(u => u !== currentUser.userid) 
        : [...new Set([...freshT, currentUser.userid])];

      setMyFollowing(new Set(newMy));

      const { id: myId, ...myBody } = myRec;
      const { id: tId,  ...tBody  } = tRec;
      await axios.put(`${USER_API}/${myId}`, { ...myBody, following: serializeFollowList(newMy) });
      await axios.put(`${USER_API}/${tId}`,  { ...tBody,  followers: serializeFollowList(newT) });

      setAllUsersMap(p => ({
        ...p,
        [targetUserid]: { ...p[targetUserid], followers: serializeFollowList(newT) },
        [currentUser.userid]: { ...p[currentUser.userid], following: serializeFollowList(newMy) }
      }));

      if (viewingUser?.userid === targetUserid) {
        setViewingUser(p => p ? ({ ...p, followers: newT, userRec: { ...p.userRec, followers: serializeFollowList(newT) } }) : p);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setFollowLoading(p => ({ ...p, [targetUserid]: false }));
    }
  };

  if (loading) return (
    <Box sx={{ position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "#090b14", zIndex: 50 }}>
      <Box sx={{ textAlign: "center" }}>
        <CircularProgress sx={{ color: "#ff4081" }} />
        <Typography sx={{ mt: 2, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'", fontSize: 13 }}>Calculating matches…</Typography>
      </Box>
    </Box>
  );

  const currentProfile = currentIndex < profiles.length ? profiles[currentIndex] : null;
  const nextProfile    = currentIndex + 1 < profiles.length ? profiles[currentIndex + 1] : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #090b14; font-family: 'DM Sans', sans-serif; }

        /* ── page shell ── */
        .m-page { position: fixed; inset: 0; background: #090b14; display: flex; flex-direction: column; overflow: hidden; z-index: 50; font-family: 'DM Sans', sans-serif; }

        /* ── header ── */
        .m-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px 11px;
          background: rgba(9,11,20,0.92); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0; z-index: 10;
        }

        /* ── deck area — centers the stage on desktop ── */
        .m-deck { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px 16px 16px; min-height: 0; overflow: hidden; }

        /* ── stage — max 400×640, centered ── */
        .m-stage { position: relative; width: 100%; max-width: 400px; height: 100%; max-height: 640px; flex-shrink: 0; }

        /* ── background card (next) ── */
        .m-card-bg {
          position: absolute; inset: 16px 16px 88px;
          border-radius: 28px;
          background: linear-gradient(160deg,#1a1528,#110e1c);
          border: 1px solid rgba(255,255,255,0.06);
          transform: scale(0.93) translateY(14px);
          transition: transform 0.35s cubic-bezier(0.22,1,0.36,1);
          will-change: transform; overflow: hidden;
        }
        .m-card-bg.peek { transform: scale(0.96) translateY(7px); }

        /* ── main card ── */
        .m-card {
          position: absolute; inset: 8px 8px 84px;
          border-radius: 28px;
          background: linear-gradient(160deg,#1f1530,#130f20);
          border: 1px solid rgba(255,64,129,0.15);
          box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
          display: flex; flex-direction: column;
          overflow: hidden; touch-action: none; user-select: none; cursor: grab;
          will-change: transform; transition: box-shadow 0.2s;
        }
        .m-card:active { cursor: grabbing; }
        .m-card.swiping-right { box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 32px rgba(76,206,172,0.2); }
        .m-card.swiping-left  { box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 32px rgba(255,82,82,0.2); }

        /* ── card photo top ── */
        .m-photo {
          position: relative; width: 100%; flex-shrink: 0;
          height: 46%; background: #0d0a18; overflow: hidden;
        }
        .m-photo img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .m-photo-grad {
          position: absolute; bottom: 0; left: 0; right: 0; height: 70%;
          background: linear-gradient(to top, rgba(19,15,32,1) 0%, rgba(19,15,32,0.5) 40%, transparent 100%);
        }

        /* ── name overlay on photo ── */
        .m-photo-namerow {
          position: absolute; bottom: 14px; left: 18px; right: 70px;
          display: flex; flex-direction: column; gap: 4px;
        }

        /* ── score ring (absolute top-right of photo) ── */
        .m-score-wrap {
          position: absolute; bottom: 10px; right: 14px;
          width: 56px; height: 56px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .m-score-wrap svg { position: absolute; inset: 0; transform: rotate(-90deg); }
        .m-score-num {
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 15px; color: #fff;
          position: relative; z-index: 1; line-height: 1;
        }
        .m-score-label {
          font-family: 'DM Sans', sans-serif; font-size: 8px; font-weight: 600;
          color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.5px;
          position: relative; z-index: 1;
        }

        /* ── stamp overlays ── */
        .m-stamp {
          position: absolute; z-index: 20; top: 24px;
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 20px;
          text-transform: uppercase; letter-spacing: 3px;
          padding: 6px 14px; border-radius: 10px; border-width: 3px; border-style: solid;
          pointer-events: none; transition: opacity 0.1s;
        }
        .m-stamp.pass   { left: 20px;  color: #ff5252; border-color: #ff5252; transform: rotate(-12deg); background: rgba(255,82,82,0.08); }
        .m-stamp.follow { right: 20px; color: #4cceac; border-color: #4cceac; transform: rotate(12deg);  background: rgba(76,206,172,0.08); }

        /* ── card info area ── */
        .m-info {
          flex: 1; overflow-y: auto; padding: 14px 18px 12px;
          display: flex; flex-direction: column; gap: 10px;
          -webkit-overflow-scrolling: touch;
        }
        .m-info::-webkit-scrollbar { width: 3px; }
        .m-info::-webkit-scrollbar-thumb { background: rgba(255,64,129,0.2); border-radius: 4px; }

        /* ── meta pills row ── */
        .m-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .m-meta-pill {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
          border-radius: 20px; padding: 3px 9px;
          font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.5);
        }
        .m-meta-pill.accent { background: rgba(255,64,129,0.1); border-color: rgba(255,64,129,0.25); color: #ff80ab; }
        .m-meta-pill.green  { background: rgba(76,206,172,0.1); border-color: rgba(76,206,172,0.25); color: #4cceac; }

        /* ── section label ── */
        .m-section-label {
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 9px;
          text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.25);
          margin-bottom: 5px;
        }
        .m-section-label.hot { color: rgba(255,64,129,0.7); }

        /* ── action bar ── */
        .m-actions {
          position: absolute; bottom: 0; left: 0; right: 0; height: 84px;
          display: flex; align-items: center; justify-content: center;
          gap: 12px; z-index: 5;
          background: linear-gradient(to top, #090b14 40%, transparent);
          padding-bottom: 8px; flex-wrap: wrap;
        }
        .m-btn {
          border: none; cursor: pointer; border-radius: 20px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: transform 0.2s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.2s, background 0.2s;
          flex-shrink: 0; padding: 8px 14px; font-family: 'DM Sans'; font-size: 12px; font-weight: 600; white-space: nowrap;
        }
        .m-btn.pass {
          background: rgba(255,82,82,0.1); border: 1.5px solid rgba(255,82,82,0.35);
          color: #ff5252;
        }
        .m-btn.pass:hover  { background: rgba(255,82,82,0.2); transform: scale(1.05); box-shadow: 0 0 20px rgba(255,82,82,0.3); }
        .m-btn.pass:active { transform: scale(0.95); }
        .m-btn.follow {
          background: linear-gradient(135deg,rgba(76,206,172,0.18),rgba(76,206,172,0.08));
          border: 1.5px solid rgba(76,206,172,0.4); color: #4cceac;
        }
        .m-btn.follow:hover  { background: rgba(76,206,172,0.28); transform: scale(1.05); box-shadow: 0 0 24px rgba(76,206,172,0.3); }
        .m-btn.follow:active { transform: scale(0.95); }
        .m-btn.info {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
        }
        .m-btn.info:hover  { background: rgba(255,255,255,0.1); transform: scale(1.05); }
        .m-btn.info:active { transform: scale(0.95); }

        /* ── progress dots ── */
        .m-progress { display: flex; gap: 4px; align-items: center; justify-content: center; padding: 6px 0 2px; flex-shrink: 0; }
        .m-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.12); transition: all 0.25s; flex-shrink: 0; }
        .m-dot.active { width: 18px; border-radius: 3px; background: #ff4081; }
        .m-dot.seen   { background: rgba(255,64,129,0.25); }

        /* ── toast ── */
        .m-toast {
          position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
          border-radius: 24px; padding: 9px 18px; display: flex; align-items: center; gap: 8px;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          opacity: 0; pointer-events: none; z-index: 200;
          animation: toastIn 0.28s cubic-bezier(0.22,1,0.36,1) forwards, toastOut 0.25s ease 1.2s forwards;
        }
        .m-toast.follow { background: rgba(76,206,172,0.18); border: 1px solid rgba(76,206,172,0.4); color: #4cceac; }
        .m-toast.pass   { background: rgba(255,82,82,0.12);  border: 1px solid rgba(255,82,82,0.3);  color: #ff5252; }

        /* ── no more screen ── */
        .m-empty {
          position: absolute; inset: 8px 8px 84px;
          border-radius: 28px;
          background: linear-gradient(160deg,#1a1528,#110e1c);
          border: 1px solid rgba(255,255,255,0.07);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 10px; padding: 28px;
        }

        .follow-list-item { display: flex; align-items: center; gap: 10px; padding: 10px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s; border-radius: 8px; }
        .follow-list-item:last-child { border-bottom: none; }
        .follow-list-item:hover { background: rgba(255,64,129,0.04); }

        .comment-item { padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 8px; }
        .reply-btn { font-size: 11px; color: rgba(255,64,129,0.7); cursor: pointer; background: none; border: none; padding: 0; margin-top: 4px; font-family: 'DM Sans',sans-serif; }
        .reply-btn:hover { color: #ff4081; }
        .liker-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,64,129,0.08); border: 1px solid rgba(255,64,129,0.18); border-radius: 20px; padding: 4px 10px; margin: 3px; cursor: pointer; transition: background 0.2s; }
        .liker-pill:hover { background: rgba(255,64,129,0.16); }
        .comment-input-row { display: flex; gap: 8px; align-items: flex-end; padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); }
        .tab-btn { flex: 1; padding: 8px; border: none; cursor: pointer; font-family: 'Syne',sans-serif; font-weight: 700; font-size: 12px; border-radius: 10px; transition: background 0.2s,color 0.2s; }
        .tab-btn.active   { background: rgba(255,64,129,0.18); color: #ff80ab; border: 1px solid rgba(255,64,129,0.3) !important; }
        .tab-btn.inactive { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.07) !important; }

        @keyframes toastIn   { to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes toastOut  { to { opacity: 0; transform: translateX(-50%) translateY(12px); } }
      `}</style>

      <div className="m-page">
        {/* ── HEADER ── */}
        <div className="m-header">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Brand variant="small" />
            {currentProfile && (
              <Box sx={{ px: 0.8, py: 0.1, borderRadius: "4px", background: "rgba(255,64,129,0.1)", border: "1px solid rgba(255,64,129,0.2)" }}>
                <Typography sx={{ fontSize: 8, color: "#ff80ab", fontFamily: "'Syne'", fontWeight: 700 }}>
                  {profiles.length - currentIndex} left
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
              ← pass &nbsp;·&nbsp; follow →
            </Typography>
            <Notifications />
          </Box>
        </div>

        {/* ── PROGRESS DOTS ── */}
        <div className="m-progress">
          {profiles.slice(Math.max(0, currentIndex - 2), currentIndex + 8).map((_, i) => {
            const absIdx = Math.max(0, currentIndex - 2) + i;
            return (
              <div key={absIdx} className={`m-dot ${absIdx === currentIndex ? "active" : absIdx < currentIndex ? "seen" : ""}`} />
            );
          })}
        </div>

        {/* ── DECK ── */}
        <div className="m-deck">
          <div className="m-stage">
            {currentProfile ? (
              <MatchingCard
                currentProfile={currentProfile}
                nextProfile={nextProfile}
                dragOffset={dragOffset}
                swipeDir={swipeDir}
                isDragging={isDragging}
                animatingOut={animatingOut}
                cardRef={cardRef}
                handlePointerDown={handlePointerDown}
                handlePointerMove={handlePointerMove}
                handlePointerUp={handlePointerUp}
                onInfoClick={() => openUserProfile(currentProfile.userRec.userid)}
                onSwipe={triggerSwipe}
              />
            ) : (
              <div className="m-empty">
                <Typography sx={{ fontSize: 52 }}>🔭</Typography>
                <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 22, color: "#fff", letterSpacing: "-0.4px" }}>All caught up</Typography>
                <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 260, lineHeight: 1.6, fontWeight: 300 }}>
                  You've seen everyone. Update your interests or come back later.
                </Typography>
                <IconButton onClick={fetchProfiles} sx={{ color: "#ff4081", border: "1.5px solid rgba(255,64,129,0.3)", p: 1.5, mt: 1, "&:hover": { background: "rgba(255,64,129,0.08)", borderColor: "#ff4081" } }}>
                  <ReplayIcon sx={{ fontSize: 26 }} />
                </IconButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {recentAction && (
        <div className={`m-toast ${recentAction.type}`}>
          {recentAction.type === "follow" ? <CheckIcon sx={{ fontSize: 16 }} /> : <CloseIcon sx={{ fontSize: 16 }} />}
          {recentAction.type === "follow" ? `Following @${recentAction.name}` : `Passed @${recentAction.name}`}
        </div>
      )}

      {/* ── PROFILE OVERLAY ── */}
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
          usersMap={allUsersMap}
          profilesMap={profilesMap}
          onProfileUpdate={(updatedPost) => {
            // Update local users map or profile post list if needed
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