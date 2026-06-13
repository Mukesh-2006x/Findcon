import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "@mui/material";
import axios from "axios";
import { ENDPOINTS } from "../config/api";


const HomeIcon = ({ filled }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
    <polyline points="9 21 9 12 15 12 15 21" />
  </svg>
);

const SearchIcon = ({ filled }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const MessagesIcon = ({ filled }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const MatchingIcon = ({ filled }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const parseChatMessages = (raw) => {
  if (raw == null || raw === "") return { messages: [] };
  const messages = [];
  const entries = String(raw).split("||").map(s => s.trim()).filter(Boolean);
  entries.forEach(entry => {
    if (entry.startsWith("[groupmeta]") || entry.startsWith("[setting]")) return;
    let contentPart = entry;
    const tsIdx = entry.lastIndexOf("::");
    if (tsIdx !== -1) contentPart = entry.slice(0, tsIdx);
    const colonIdx = contentPart.indexOf(":");
    if (colonIdx === -1) {
      messages.push({ sender: "unknown", text: contentPart });
    } else {
      messages.push({
        sender: contentPart.slice(0, colonIdx).trim(),
        text: contentPart.slice(colonIdx + 1).trim()
      });
    }
  });
  return { messages };
};

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const isHome     = location.pathname === "/home";
  const isDiscover = location.pathname === "/discover";
  const isMessages = location.pathname === "/messages";
  const isProfile  = location.pathname === "/dashboard";
  const isMatching = location.pathname === "/matching";

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // ── Hide nav bar when a chat is open inside /messages on mobile ──
  // Messages.jsx adds "chat-open" to <body> when activeUser or activeGroup is set.
  // We read that class to decide whether to hide ourselves.
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setChatOpen(document.body.classList.contains("chat-open"));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // Sync immediately on mount
    setChatOpen(document.body.classList.contains("chat-open"));
    return () => observer.disconnect();
  }, []);

  // Also add/remove the class when the route changes away from messages
  useEffect(() => {
    if (!isMessages) {
      document.body.classList.remove("chat-open");
      setChatOpen(false);
    }
  }, [isMessages]);

  useEffect(() => {
    if (!currentUser) return;
    const checkUnread = async () => {
      try {
        const res = await axios.get(ENDPOINTS.MESSAGES);
        const allChats = res.data;
        let unreadCount = 0;
        allChats.forEach(c => {
          if (c.receiverid === "[GROUP]") {
            const parsed = parseChatMessages(c.message);
            if (c.message && c.message.includes("[groupmeta]")) {
              const entry = c.message.split("||").find(s => s.startsWith("[groupmeta]"));
              if (entry) {
                const parts = entry.replace("[groupmeta]", "").split("::");
                const mPart = parts.find(p => p.startsWith("members:"));
                if (mPart) {
                  const members = mPart.replace("members:", "").split(",").map(s => s.trim()).filter(Boolean);
                  if (members.includes(currentUser.userid)) {
                    if (parsed.messages.length > 0) {
                      const last = parsed.messages[parsed.messages.length - 1];
                      if (last.sender !== currentUser.userid && (c.isRead === false || c.isRead === "false")) {
                        unreadCount++;
                      }
                    }
                  }
                }
              }
            }
          } else if (c.userid === currentUser.userid || c.receiverid === currentUser.userid) {
            const parsed = parseChatMessages(c.message);
            if (parsed.messages.length > 0) {
              const last = parsed.messages[parsed.messages.length - 1];
              if (last.sender !== currentUser.userid && (c.isRead === false || c.isRead === "false")) {
                unreadCount++;
              }
            }
          }
        });
        setUnreadChatCount(unreadCount);
      } catch (err) {
        console.log("Error checking unread in BottomNav:", err);
      }
    };
    checkUnread();
    const timer = setInterval(checkUnread, 8000);
    return () => clearInterval(timer);
  }, [currentUser]);

  // On mobile, hide completely when a chat panel is open so it doesn't overlap
  if (chatOpen) return null;

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 8px 12px 10px;
          background: rgba(12, 12, 18, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.07);
          transition: transform 0.3s ease, opacity 0.3s ease;
          opacity: 1;
          transform: translateY(0);
        }

        /* Mobile */
        @media (max-width: 640px) {
          .bottom-nav {
            padding: 8px 8px 12px;
            gap: 4px;
          }
        }

        /* Tablet */
        @media (min-width: 641px) and (max-width: 900px) {
          .bottom-nav {
            padding: 10px 16px 14px;
          }
        }

        /* Desktop - centered navbar */
        @media (min-width: 901px) {
          .bottom-nav {
            max-width: 600px;
            left: 50%;
            transform: translateX(-50%);
            border-radius: 16px 16px 0 0;
            border-left: 1px solid rgba(255,255,255,0.07);
            border-right: 1px solid rgba(255,255,255,0.07);
            padding: 12px 20px 16px;
          }
        }

        /* Hide animation when chat is open */
        .bottom-nav.hidden {
          transform: translateY(120%);
          opacity: 0;
          pointer-events: none;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 12px;
          transition: background 0.2s, color 0.2s, transform 0.15s;
          color: rgba(255,255,255,0.35);
          font-family: 'DM Sans', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.3px;
          min-width: 50px;
          touch-action: manipulation;
        }

        /* Mobile optimizations */
        @media (max-width: 640px) {
          .nav-item {
            padding: 6px 8px;
            min-width: 45px;
            font-size: 9px;
            gap: 3px;
          }
        }

        /* Tablet */
        @media (min-width: 641px) and (max-width: 900px) {
          .nav-item {
            padding: 6px 14px;
            min-width: 55px;
            font-size: 10px;
          }
        }

        /* Desktop */
        @media (min-width: 901px) {
          .nav-item {
            padding: 8px 16px;
            min-width: 70px;
            font-size: 11px;
            gap: 5px;
          }
        }

        .nav-item:active {
          transform: scale(0.95);
        }

        .nav-item:hover {
          background: rgba(255,64,129,0.08);
          color: #ff80ab;
          transform: translateY(-1px);
        }
        
        .nav-item:hover:active {
          transform: scale(0.95) translateY(0);
        }

        .nav-item.active {
          color: #ff4081;
        }
        .nav-item.active .nav-dot {
          opacity: 1;
        }
        .nav-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #ff4081;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .nav-avatar-wrap {
          width: 26px; height: 26px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid transparent;
          transition: border-color 0.2s;
          position: relative;
        }
        .nav-item.active .nav-avatar-wrap {
          border-color: #ff4081;
        }
        .nav-avatar-ring {
          position: absolute; inset: -2px;
          border-radius: 50%;
          background: conic-gradient(#ff4081, #ff80ab, #f50057, #ff4081);
          animation: navRingSpin 5s linear infinite;
          display: none;
        }
        .nav-item.active .nav-avatar-ring {
          display: block;
        }
        @keyframes navRingSpin { to { transform: rotate(360deg); } }

        /* Touch targets for mobile (minimum 44x44px) */
        @media (max-width: 640px) {
          .nav-item {
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>

      <div className="bottom-nav">
        {/* Home */}
        <button className={`nav-item ${isHome ? "active" : ""}`} onClick={() => navigate("/home")}>
          <HomeIcon filled={isHome} />
          <span>Feed</span>
          <div className="nav-dot" />
        </button>

        {/* Discover */}
        <button className={`nav-item ${isDiscover ? "active" : ""}`} onClick={() => navigate("/discover")}>
          <SearchIcon filled={isDiscover} />
          <span>Discover</span>
          <div className="nav-dot" />
        </button>

        {/* Matching */}
        <button className={`nav-item ${isMatching ? "active" : ""}`} onClick={() => navigate("/matching")}>
          <MatchingIcon filled={isMatching} />
          <span>Match</span>
          <div className="nav-dot" />
        </button>

        {/* Messages */}
        <button className={`nav-item ${isMessages ? "active" : ""}`} onClick={() => navigate("/messages")}>
          <div style={{ position: "relative" }}>
            <MessagesIcon filled={isMessages} />
            {unreadChatCount > 0 && (
              <span style={{
                position: "absolute", top: -2, right: -4,
                background: "#ff4081", color: "#fff",
                fontSize: 9, fontWeight: 700, borderRadius: "50%",
                minWidth: 14, height: 14, display: "flex",
                alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 6px #ff4081", border: "1px solid #0c0c12"
              }}>
                {unreadChatCount}
              </span>
            )}
          </div>
          <span>Messages</span>
          <div className="nav-dot" />
        </button>

        {/* Profile */}
        <button className={`nav-item ${isProfile ? "active" : ""}`} onClick={() => navigate("/dashboard")}>
          <div style={{ position: "relative" }}>
            <div className="nav-avatar-ring" />
            <div className="nav-avatar-wrap">
              <Avatar
                src={currentUser?.profilepic}
                sx={{ width: 26, height: 26, fontSize: 11, background: "#ff4081", fontFamily: "'Syne'", fontWeight: 700, borderRadius: "50%" }}
              >
                {currentUser?.userid?.[0]?.toUpperCase()}
              </Avatar>
            </div>
          </div>
          <span>Profile</span>
          <div className="nav-dot" />
        </button>


      </div>
    </>
  );
}