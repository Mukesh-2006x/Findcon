import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Brand } from "../components/ui";
import { ENDPOINTS } from "../config/api";
import {
  Box, Typography, Avatar, CircularProgress, IconButton, TextField, Divider, Button,
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, FormControlLabel, Switch
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LockIcon from "@mui/icons-material/Lock";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingsIcon from "@mui/icons-material/Settings";
import EyeIcon from "@mui/icons-material/RemoveRedEye";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GridOnIcon from "@mui/icons-material/GridOn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import GroupIcon from "@mui/icons-material/Group";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";

import Notifications from "../components/Notification";
import FollowBtn from "../components/FollowBtn";
import { useAuth } from "../context/AuthContext";
import { ProfileView } from "../components/profile";
import {
  parseFollowList,
  serializeFollowList,
  parseLikes,
  parseComments,
  serializeComments,
  getMediaUrl
} from "../utils/helpers";

const USER_API    = ENDPOINTS.USERS;
const PROFILE_API = ENDPOINTS.PROFILES;
const CHAT_API    = ENDPOINTS.MESSAGES;
const POST_API    = ENDPOINTS.POSTS;


// Advanced serialized messages parser
const parseChatMessages = (raw) => {
  if (raw == null || raw === "") return { messages: [], settings: { erase: "none" }, groupMeta: null };
  const messages = [];
  const settings = { erase: "none" };
  let groupMeta = null;
  const entries = String(raw).split("||").map(s => s.trim()).filter(Boolean);
  entries.forEach(entry => {
    if (entry.startsWith("[groupmeta]")) {
      const rawMeta = entry.replace("[groupmeta]", "");
      const parts = rawMeta.split("::");
      const meta = { name: "", members: [], createdby: "", pic: "", createdat: null };
      parts.forEach(p => {
        if (p.startsWith("name:")) meta.name = p.replace("name:", "");
        if (p.startsWith("members:")) meta.members = p.replace("members:", "").split(",").map(s => s.trim()).filter(Boolean);
        if (p.startsWith("createdby:")) meta.createdby = p.replace("createdby:", "");
        if (p.startsWith("pic:")) meta.pic = p.replace("pic:", "");
        if (p.startsWith("createdat:")) meta.createdat = Number(p.replace("createdat:", "")) || null;
      });
      groupMeta = meta;
      return;
    }
    if (entry.startsWith("[setting]")) {
      const parts = entry.replace("[setting]", "").split(":");
      if (parts[0] === "erase") {
        settings.erase = parts[1] || "none";
      }
      return;
    }
    let contentPart = entry;
    let timestamp = Date.now();
    const tsIdx = entry.lastIndexOf("::");
    if (tsIdx !== -1) {
      contentPart = entry.slice(0, tsIdx);
      timestamp = Number(entry.slice(tsIdx + 2)) || Date.now();
    }
    const colonIdx = contentPart.indexOf(":");
    if (colonIdx === -1) {
      messages.push({ sender: "unknown", text: contentPart, timestamp });
    } else {
      messages.push({
        sender: contentPart.slice(0, colonIdx).trim(),
        text: contentPart.slice(colonIdx + 1).trim(),
        timestamp
      });
    }
  });
  return { messages, settings, groupMeta };
};

const serializeChat = (messages, settings, groupMeta = null) => {
  const parts = [];
  if (groupMeta) {
    const memStr = groupMeta.members.join(",");
    const picStr = groupMeta.pic ? `::pic:${groupMeta.pic}` : "";
    const dateStr = groupMeta.createdat ? `::createdat:${groupMeta.createdat}` : "";
    parts.push(`[groupmeta]name:${groupMeta.name}::members:${memStr}::createdby:${groupMeta.createdby}${picStr}${dateStr}`);
  }
  if (settings.erase && settings.erase !== "none") {
    parts.push(`[setting]erase:${settings.erase}`);
  }
  messages.forEach(m => {
    parts.push(`${m.sender}:${m.text}::${m.timestamp}`);
  });
  return parts.join("||");
};

// ── FILTER EXPIRED MESSAGES (ON LOAD) ──
const cleanExpiredMessages = async (chatRow) => {
  const parsed = parseChatMessages(chatRow.message);
  const msgs = parsed.messages;
  const eraseSetting = parsed.settings.erase || "none";
  
  if (eraseSetting === "none") {
    return { messages: msgs, settings: parsed.settings, groupMeta: parsed.groupMeta, row: chatRow };
  }

  let cutoffMs = 0;
  if (eraseSetting === "30m") cutoffMs = 30 * 60 * 1000;
  else if (eraseSetting === "1h") cutoffMs = 60 * 60 * 1000;
  else if (eraseSetting === "6h") cutoffMs = 6 * 60 * 60 * 1000;
  else if (eraseSetting === "24h") cutoffMs = 24 * 60 * 60 * 1000;

  if (cutoffMs === 0) return { messages: msgs, settings: parsed.settings, groupMeta: parsed.groupMeta, row: chatRow };

  const now = Date.now();
  const remaining = msgs.filter(m => (now - m.timestamp) < cutoffMs);

  if (remaining.length !== msgs.length) {
    const serialized = serializeChat(remaining, parsed.settings, parsed.groupMeta);
    const updatedRow = { ...chatRow, message: serialized };
    const res = await axios.put(`${CHAT_API}/${chatRow.id}`, updatedRow);
    return { messages: remaining, settings: parsed.settings, groupMeta: parsed.groupMeta, row: res.data };
  }

  return { messages: msgs, settings: parsed.settings, groupMeta: parsed.groupMeta, row: chatRow };
};

export default function Messages() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading]       = useState(true);
  const [followingUsers, setFollowingUsers] = useState([]);
  const [followers, setFollowers]           = useState(new Set());
  const [conversations, setConversations]   = useState([]);
  const [users, setUsers]                   = useState({});
  const [profiles, setProfiles]             = useState({});
  
  // Chat Overlay state
  const [activeUser, setActiveUser]   = useState(null);
  const [activeChat, setActiveChat]   = useState(null); // The raw API row
  const [chatMessages, setChatMessages] = useState([]);
  const [chatSettings, setChatSettings] = useState({ erase: "none" });
  const [newMessage, setNewMessage]   = useState("");
  const [sending, setSending]         = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Tab Switcher and Groups state
  const [activeTab, setActiveTab] = useState("dms");
  const [activeGroup, setActiveGroup] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupMembersDialogOpen, setGroupMembersDialogOpen] = useState(false);
  const [showSeenStatus, setShowSeenStatus] = useState(true);

  const chatMode = activeGroup ? "group" : activeUser ? "dm" : null;

  // Auto-Erase Timer Settings Dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Message Options Context Menu (Long press / Right click)
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null); // { msg, index }
  
  // Header options menu
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState(null);

  // Edit Message Dialog
  const [editOpen, setEditOpen]         = useState(false);
  const [editText, setEditText]         = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  // ImgBB Photo Uploading
  const [photoFile, setPhotoFile]           = useState(null);
  const [photoPreview, setPhotoPreview]     = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewOnceToggle, setViewOnceToggle] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // View Once Disappearing Image Viewer
  const [viewOnceUrl, setViewOnceUrl]     = useState("");
  const [viewOnceIndex, setViewOnceIndex] = useState(null);

  // Profile overlay stack (view profile in messaging)
  const [viewingUser, setViewingUser] = useState(null);
  const [followLoading, setFollowLoading] = useState({});
  const [myFollowing, setMyFollowing]   = useState(new Set());
  const [followListDialog, setFollowListDialog] = useState(null);

  // Profile post detailed view
  const [profileViewPost, setProfileViewPost]                 = useState(null);
  const [profileViewLikers, setProfileViewLikers]             = useState([]);
  const [profileViewComments, setProfileViewComments]         = useState([]);
  const [profilePostShowLikers, setProfilePostShowLikers]     = useState(false);
  const [profilePostShowComments, setProfilePostShowComments] = useState(true);
  const [profilePostNewComment, setProfilePostNewComment]     = useState("");
  const [profilePostReplyTo, setProfilePostReplyTo]           = useState(null);
  const [profilePostSubmitting, setProfilePostSubmitting]     = useState(false);
  const [profilePostLiking, setProfilePostLiking]             = useState(false);

  // Screenshot / Print shield states
  const [screenShieldActive, setScreenShieldActive] = useState(false);

  // Toast notifications
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg]   = useState("");
  const [toastSeverity, setToastSeverity] = useState("success");

  const messagesEndRef = useRef(null);
  let touchTimer = null;

  const showToast = (msg, severity = "success") => {
    setToastMsg(msg);
    setToastSeverity(severity);
    setToastOpen(true);
  };

  const markSeen = async (chatRow) => {
    try {
      const updatedBody = {
        ...chatRow,
        isRead: true
      };
      const res = await axios.put(`${CHAT_API}/${chatRow.id}`, updatedBody);
      setConversations(prev => prev.map(c => c.id === chatRow.id ? res.data : c));
      if (activeChat && activeChat.id === chatRow.id) {
        setActiveChat(res.data);
      }
    } catch (err) {
      console.log("Error marking seen:", err);
    }
  };

  const isUnread = (chatRow) => {
    if (!chatRow || !chatRow.message) return false;
    const { messages } = parseChatMessages(chatRow.message);
    if (messages.length === 0) return false;
    const last = messages[messages.length - 1];
    return (
      last.sender !== currentUser?.userid &&
      (chatRow.isRead === false || chatRow.isRead === "false" || !chatRow.isRead)
    );
  };

  const getChatRowForUser = (otherUserid) => {
    return conversations.find(c =>
      (c.userid === currentUser.userid && c.receiverid === otherUserid) ||
      (c.userid === otherUserid && c.receiverid === currentUser.userid)
    );
  };

  const isDMUnread = (otherUserid) => {
    const row = getChatRowForUser(otherUserid);
    return isUnread(row);
  };

  const getGroupConversations = () => {
    return conversations.filter(c => {
      if (c.receiverid !== "[GROUP]") return false;
      const parsed = parseChatMessages(c.message);
      if (!parsed.groupMeta) return false;
      return parsed.groupMeta.members.includes(currentUser?.userid);
    });
  };

  // ── FETCH INITIAL INBOX DATA ──
  const fetchInbox = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [userRes, chatRes, profileRes] = await Promise.all([
        axios.get(USER_API),
        axios.get(CHAT_API),
        axios.get(PROFILE_API)
      ]);

      const allUsers = userRes.data;
      const allChats = chatRes.data;
      const allProfiles = profileRes.data;

      const userMap = {};
      allUsers.forEach(u => { userMap[u.userid] = u; });
      setUsers(userMap);

      const profileMap = {};
      allProfiles.forEach(p => { profileMap[p.userid] = p; });
      setProfiles(profileMap);

      const myRec = allUsers.find(u => u.userid === currentUser.userid);
      if (!myRec) throw new Error("Current user record not found");

      const followedUids = parseFollowList(myRec.following);
      setMyFollowing(new Set(followedUids));
      
      // Get followers list (for notifications only, not for inbox filtering)
      const followerUids = parseFollowList(myRec.followers);
      setFollowers(new Set(followerUids));
      
      // Get all users who have sent messages to current user
      const messagedUserIds = new Set();
      allChats.forEach(chat => {
        if (chat.receiverid === "[GROUP]") return; // Skip groups
        
        // Extract other user ID from the conversation
        let otherUserId = null;
        if (chat.userid === currentUser.userid) {
          otherUserId = chat.receiverid;
        } else if (chat.receiverid === currentUser.userid) {
          otherUserId = chat.userid;
        }
        
        if (otherUserId) {
          messagedUserIds.add(otherUserId);
        }
      });
      
      // Show only: people you follow + people who messaged you (exclude followers who haven't messaged)
      const inboxUserIds = new Set([...followedUids, ...messagedUserIds]);
      const inboxUsers = allUsers.filter(u => inboxUserIds.has(u.userid));
      
      // Sort by most recent message (by latest message timestamp within conversation)
      inboxUsers.sort((a, b) => {
        const chatA = getChatRowForUser(a.userid);
        const chatB = getChatRowForUser(b.userid);
        
        // Get the latest message timestamp from within each conversation
        let timestampA = 0;
        let timestampB = 0;
        
        if (chatA) {
          const parsedA = parseChatMessages(chatA.message);
          if (parsedA.messages.length > 0) {
            const lastMsgA = parsedA.messages[parsedA.messages.length - 1];
            timestampA = lastMsgA.timestamp || 0;
          }
        }
        
        if (chatB) {
          const parsedB = parseChatMessages(chatB.message);
          if (parsedB.messages.length > 0) {
            const lastMsgB = parsedB.messages[parsedB.messages.length - 1];
            timestampB = lastMsgB.timestamp || 0;
          }
        }
        
        return timestampB - timestampA;
      });
      
      setFollowingUsers(inboxUsers);
      setConversations(allChats);
    } catch (err) {
      console.log("Error loading Inbox:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchInbox();
    }
  }, [currentUser?.userid]);

  // ── SCREENSHOT & WINDOW BLUR PROTECTION ──
  useEffect(() => {
    const handleBlur = () => {
      if (activeUser || activeGroup) {
        setScreenShieldActive(true);
      }
    };
    const handleFocus = () => {
      setScreenShieldActive(false);
    };
    const handleKeyDown = (e) => {
      if (!activeUser && !activeGroup) return;
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        setScreenShieldActive(true);
        showToast("Screenshots are blocked for privacy!", "warning");
        setTimeout(() => setScreenShieldActive(false), 2500);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        showToast("Printing the chat is restricted!", "error");
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5")) {
        e.preventDefault();
        setScreenShieldActive(true);
        showToast("Screenshots are restricted!", "warning");
        setTimeout(() => setScreenShieldActive(false), 2500);
      }
    };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeUser, activeGroup]);

  // ── MANAGE NAV BAR VISIBILITY ──
  // Add/remove "chat-open" class to body to hide BottomNav when a chat is active
  useEffect(() => {
    if (activeUser || activeGroup) {
      document.body.classList.add("chat-open");
    } else {
      document.body.classList.remove("chat-open");
    }
    return () => {
      document.body.classList.remove("chat-open");
    };
  }, [activeUser, activeGroup]);

  // ── GET CONVERSATION PREVIEW ──
  const getChatPreview = (otherUserid) => {
    const match = conversations.find(c =>
      (c.userid === currentUser.userid && c.receiverid === otherUserid) ||
      (c.userid === otherUserid && c.receiverid === currentUser.userid)
    );
    if (!match || !match.message) return "No messages yet. Tap to chat!";
    const { messages } = parseChatMessages(match.message);
    if (messages.length === 0) return "No messages yet. Tap to chat!";
    const last = messages[messages.length - 1];
    if (last.text.startsWith("[photo]")) return last.sender === currentUser.userid ? "You sent a photo" : "Sent a photo";
    if (last.text.startsWith("[viewonce]")) return last.sender === currentUser.userid ? "You sent a disappearing photo" : "Sent a disappearing photo";
    if (last.text.startsWith("[viewonce_opened]")) return last.sender === currentUser.userid ? "Opened disappearing photo" : "Opened disappearing photo";
    return last.sender === currentUser.userid ? `You: ${last.text}` : `${last.text}`;
  };

  // ── SCROLL TO BOTTOM ──
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeUser) {
      scrollToBottom();
    }
  }, [chatMessages, activeUser]);

  // ── OPEN CHAT WINDOW ──
  const openChat = async (target, isGroup = false) => {
    if (isGroup) {
      setActiveUser(null);
      setLoadingChat(true);
      setChatMessages([]);
      setChatSettings({ erase: "none" });
      setActiveChat(null);
      setNewMessage("");

      try {
        const res = await axios.get(CHAT_API);
        const allChats = res.data;
        setConversations(allChats);

        const match = allChats.find(c => c.id === target.id);
        if (match) {
          const cleaned = await cleanExpiredMessages(match);
          setActiveChat(cleaned.row);
          setChatMessages(cleaned.messages);
          setChatSettings(cleaned.settings);
          setActiveGroup(cleaned.groupMeta);

          // Mark seen if last msg not me
          if (cleaned.messages.length > 0) {
            const lastMsg = cleaned.messages[cleaned.messages.length - 1];
            if (lastMsg.sender !== currentUser.userid && (match.isRead === false || match.isRead === "false")) {
              await markSeen(match);
            }
          }
        }
      } catch (err) {
        console.log("Error loading group chat:", err);
      } finally {
        setLoadingChat(false);
      }
    } else {
      setActiveGroup(null);
      setActiveUser(target);
      setLoadingChat(true);
      setChatMessages([]);
      setChatSettings({ erase: "none" });
      setActiveChat(null);
      setNewMessage("");

      try {
        const res = await axios.get(CHAT_API);
        const allChats = res.data;
        setConversations(allChats);

        const match = allChats.find(c =>
          (c.userid === currentUser.userid && c.receiverid === target.userid) ||
          (c.userid === target.userid && c.receiverid === currentUser.userid)
        );

        if (match) {
          const cleaned = await cleanExpiredMessages(match);
          setActiveChat(cleaned.row);
          setChatMessages(cleaned.messages);
          setChatSettings(cleaned.settings);

          // Mark seen if last msg not me
          if (cleaned.messages.length > 0) {
            const lastMsg = cleaned.messages[cleaned.messages.length - 1];
            if (lastMsg.sender !== currentUser.userid && (match.isRead === false || match.isRead === "false")) {
              await markSeen(match);
            }
          }
        } else {
          setActiveChat(null);
          setChatMessages([]);
          setChatSettings({ erase: "none" });
        }
      } catch (err) {
        console.log("Error loading chat:", err);
      } finally {
        setLoadingChat(false);
      }
    }
  };

  // ── REFRESH CURRENT CHAT ──
  const refreshChat = async () => {
    if (!activeUser && !activeGroup) return;
    try {
      const res = await axios.get(CHAT_API);
      const allChats = res.data;
      setConversations(allChats);

      let match;
      if (activeGroup) {
        match = allChats.find(c => c.id === activeChat?.id);
      } else {
        match = allChats.find(c =>
          (c.userid === currentUser.userid && c.receiverid === activeUser.userid) ||
          (c.userid === activeUser.userid && c.receiverid === currentUser.userid)
        );
      }

      if (match) {
        const cleaned = await cleanExpiredMessages(match);
        setActiveChat(cleaned.row);
        setChatMessages(cleaned.messages);
        setChatSettings(cleaned.settings);
        if (activeGroup) {
          setActiveGroup(cleaned.groupMeta);
        }
        
        // Mark seen if last msg not me
        if (cleaned.messages.length > 0) {
          const lastMsg = cleaned.messages[cleaned.messages.length - 1];
          if (lastMsg.sender !== currentUser.userid && (match.isRead === false || match.isRead === "false")) {
            await markSeen(match);
          }
        }
      }
    } catch (err) {
      console.log("Error refreshing chat:", err);
    }
  };

  // ── SEND MESSAGE ──
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !currentUser || (!activeUser && !activeGroup)) return;
    setSending(true);

    const txt = newMessage.trim();
    const timestamp = Date.now();
    const newMsgItem = `${currentUser.userid}:${txt}::${timestamp}`;

    try {
      if (activeChat) {
        const currentMsgString = activeChat.message || "";
        const updatedMsgString = currentMsgString
          ? `${currentMsgString}||${newMsgItem}`
          : newMsgItem;

        const updatedBody = {
          ...activeChat,
          message: updatedMsgString,
          timestamp: new Date().toISOString(),
          isRead: false
        };

        const res = await axios.put(`${CHAT_API}/${activeChat.id}`, updatedBody);
        
        setActiveChat(res.data);
        const parsed = parseChatMessages(res.data.message);
        setChatMessages(parsed.messages);
      } else if (chatMode === "dm") {
        const newBody = {
          userid: currentUser.userid,
          receiverid: activeUser.userid,
          message: newMsgItem,
          timestamp: new Date().toISOString(),
          isRead: false
        };

        const res = await axios.post(CHAT_API, newBody);

        setActiveChat(res.data);
        const parsed = parseChatMessages(res.data.message);
        setChatMessages(parsed.messages);
      }
      setNewMessage("");
      fetchInbox(false);
    } catch (err) {
      console.log("Error sending message:", err);
    } finally {
      setSending(false);
    }
  };

  // ── MESSAGE ACTIONS: COPY, EDIT, DELETE ──
  const handleContextMenu = (e, msg, index) => {
    e.preventDefault();
    setMenuAnchor({ mouseX: e.clientX - 2, mouseY: e.clientY - 4 });
    setMenuTarget({ msg, index });
  };

  const handleTouchStart = (e, msg, index) => {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    touchTimer = setTimeout(() => {
      setMenuAnchor({ mouseX: x, mouseY: y });
      setMenuTarget({ msg, index });
    }, 600);
  };

  const handleTouchEnd = () => {
    if (touchTimer) clearTimeout(touchTimer);
  };

  const handleCopy = (text) => {
    let cleanText = text;
    if (text.startsWith("[photo]")) cleanText = text.replace("[photo]", "");
    else if (text.startsWith("[viewonce]")) cleanText = text.replace("[viewonce]", "");
    else if (text.startsWith("[viewonce_opened]")) cleanText = "Disappearing Image (Opened)";
    
    navigator.clipboard.writeText(cleanText);
    showToast("Copied to clipboard!");
    setMenuAnchor(null);
  };

  const handleOpenEdit = () => {
    if (!menuTarget) return;
    setEditText(menuTarget.msg.text);
    setEditingIndex(menuTarget.index);
    setEditOpen(true);
    setMenuAnchor(null);
  };

  const saveEdit = async () => {
    if (editingIndex === null || !activeChat) return;
    const updatedMsgs = [...chatMessages];
    updatedMsgs[editingIndex].text = editText.trim();

    const serialized = serializeChat(updatedMsgs, chatSettings, activeGroup);
    try {
      const res = await axios.put(`${CHAT_API}/${activeChat.id}`, { ...activeChat, message: serialized });
      setActiveChat(res.data);
      setChatMessages(updatedMsgs);
      setEditOpen(false);
      setEditingIndex(null);
      showToast("Message updated");
    } catch (err) {
      console.log(err);
      showToast("Failed to edit message", "error");
    }
  };

  const deleteMsg = async (index) => {
    if (!activeChat) return;
    const updatedMsgs = chatMessages.filter((_, i) => i !== index);

    const serialized = serializeChat(updatedMsgs, chatSettings, activeGroup);
    try {
      const res = await axios.put(`${CHAT_API}/${activeChat.id}`, { ...activeChat, message: serialized });
      setActiveChat(res.data);
      setChatMessages(updatedMsgs);
      setMenuAnchor(null);
      showToast("Message deleted");
    } catch (err) {
      console.log(err);
      showToast("Failed to delete message", "error");
    }
  };

  // ── DELETE HISTORY ──
  const clearHistory = async () => {
    if (!activeChat) return;
    const serialized = serializeChat([], chatSettings, activeGroup);
    try {
      const res = await axios.put(`${CHAT_API}/${activeChat.id}`, { ...activeChat, message: serialized });
      setActiveChat(res.data);
      setChatMessages([]);
      showToast("Chat history cleared");
    } catch (err) {
      console.log(err);
      showToast("Failed to clear history", "error");
    }
  };

  // ── SAVE AUTO-ERASE TIMER SETTING ──
  const handleSaveEraseSetting = async (settingValue) => {
    if (!activeChat) return;
    const newSettings = { ...chatSettings, erase: settingValue };
    setChatSettings(newSettings);

    const serialized = serializeChat(chatMessages, newSettings, activeGroup);
    try {
      const res = await axios.put(`${CHAT_API}/${activeChat.id}`, { ...activeChat, message: serialized });
      setActiveChat(res.data);
      showToast(`Auto-erase set to: ${settingValue === "none" ? "off" : settingValue}`);
      setSettingsDialogOpen(false);
    } catch (err) {
      console.log(err);
      showToast("Failed to save settings", "error");
    }
  };

  // ── SEND PHOTO (ImgBB Upload) ──
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setUploadDialogOpen(true);
    e.target.value = "";
  };

  const handleSendPhoto = async () => {
    if (!photoFile || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("image", photoFile);
      const IMGBB_KEY = import.meta.env.VITE_IMGBB_API_KEY;
      const res = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, formData);
      const url = res.data?.data?.url;
      if (!url) throw new Error("No URL returned");

      const photoTag = viewOnceToggle ? `[viewonce]${url}` : `[photo]${url}`;
      const timestamp = Date.now();
      const newMsgItem = `${currentUser.userid}:${photoTag}::${timestamp}`;

      if (activeChat) {
        const currentMsgString = activeChat.message || "";
        const updatedMsgString = currentMsgString
          ? `${currentMsgString}||${newMsgItem}`
          : newMsgItem;

        const updatedBody = {
          ...activeChat,
          message: updatedMsgString,
          timestamp: new Date().toISOString(),
          isRead: false
        };

        const putRes = await axios.put(`${CHAT_API}/${activeChat.id}`, updatedBody);
        setActiveChat(putRes.data);
        const parsed = parseChatMessages(putRes.data.message);
        setChatMessages(parsed.messages);
      } else if (chatMode === "dm") {
        const newBody = {
          userid: currentUser.userid,
          receiverid: activeUser.userid,
          message: newMsgItem,
          timestamp: new Date().toISOString(),
          isRead: false
        };
        const postRes = await axios.post(CHAT_API, newBody);
        setActiveChat(postRes.data);
        const parsed = parseChatMessages(postRes.data.message);
        setChatMessages(parsed.messages);
      }

      setUploadDialogOpen(false);
      setPhotoFile(null);
      setPhotoPreview("");
      setViewOnceToggle(false);
      fetchInbox(false);
    } catch (err) {
      console.log("Error sending photo:", err);
      showToast("Failed to upload photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── VIEW ONCE DISAPPEARING MEDIA ──
  const handleOpenViewOnce = (url, index) => {
    setViewOnceUrl(url);
    setViewOnceIndex(index);
  };

  const handleCloseViewOnce = async () => {
    if (viewOnceIndex === null || !activeChat) {
      setViewOnceUrl("");
      setViewOnceIndex(null);
      return;
    }
    const updatedMsgs = [...chatMessages];
    updatedMsgs[viewOnceIndex].text = "[viewonce_opened]";
    
    const serialized = serializeChat(updatedMsgs, chatSettings, activeGroup);
    try {
      const res = await axios.put(`${CHAT_API}/${activeChat.id}`, { ...activeChat, message: serialized });
      setActiveChat(res.data);
      setChatMessages(updatedMsgs);
    } catch (err) {
      console.log(err);
    } finally {
      setViewOnceUrl("");
      setViewOnceIndex(null);
    }
  };

  // ── OPEN USER PROFILE (SLIDER) ──
  const openUserProfile = async (userid) => {
    if (!userid) return;
    if (currentUser && userid === currentUser.userid) {
      navigate("/dashboard");
      return;
    }
    setViewingUser({ loading: true, userid });
    setProfileViewPost(null);
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
  };

  // Profile overlay follow toggle
  const handleProfileFollowToggle = async (targetUserid) => {
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

      setUsers(prev => ({
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
    } catch (err) {
      console.log("Follow toggle error:", err);
    } finally {
      setFollowLoading(prev => ({ ...prev, [targetUserid]: false }));
    }
  };

  const openProfilePost = (post) => {
    setProfileViewPost(post);
    setProfileViewLikers(parseLikes(post.likes));
    setProfileViewComments(parseComments(post.comment));
    setProfilePostShowLikers(false);
    setProfilePostShowComments(true);
    setProfilePostNewComment("");
    setProfilePostReplyTo(null);
  };

  const handleProfilePostLike = async () => {
    if (!profileViewPost || profilePostLiking || !currentUser) return;
    setProfilePostLiking(true);
    try {
      const likers = parseLikes(profileViewPost.likes);
      const updatedLikers = likers.includes(currentUser.userid)
        ? likers.filter(u => u !== currentUser.userid)
        : [...likers, currentUser.userid];
      const newLikesStr = updatedLikers.join(",");
      await axios.put(`${POST_API}/${profileViewPost.id}`, { ...profileViewPost, likes: newLikesStr });
      const updatedPost = { ...profileViewPost, likes: newLikesStr };
      setProfileViewPost(updatedPost);
      setProfileViewLikers(updatedLikers);
      setViewingUser(prev => prev ? ({ ...prev, posts: prev.posts?.map(p => p.id === profileViewPost.id ? updatedPost : p) }) : prev);
    } catch (err) { console.log(err); }
    finally { setProfilePostLiking(false); }
  };

  const handleProfilePostComment = async () => {
    if (!profilePostNewComment.trim() || profilePostSubmitting || !currentUser || !profileViewPost) return;
    setProfilePostSubmitting(true);
    try {
      const text       = profilePostReplyTo ? `@${profilePostReplyTo} ${profilePostNewComment.trim()}` : profilePostNewComment.trim();
      const existing   = parseComments(profileViewPost.comment);
      const updated    = [...existing, { user: currentUser.userid, text }];
      const serialized = serializeComments(updated);
      await axios.put(`${POST_API}/${profileViewPost.id}`, { ...profileViewPost, comment: serialized });
      const updatedPost = { ...profileViewPost, comment: serialized };
      setProfileViewPost(updatedPost);
      setProfileViewComments(updated);
      setViewingUser(prev => prev ? ({ ...prev, posts: prev.posts?.map(p => p.id === profileViewPost.id ? updatedPost : p) }) : prev);
      setProfilePostNewComment("");
      setProfilePostReplyTo(null);
    } catch (err) { console.log(err); }
    finally { setProfilePostSubmitting(false); }
  };

  const handleOpenHeaderMenu = (e) => setHeaderMenuAnchor(e.currentTarget);

  const renderBubbleContent = (msg, index) => {
    const isMe = msg.sender === currentUser.userid;
    const { text } = msg;

    if (text.startsWith("[photo]")) {
      const url = text.replace("[photo]", "");
      return (
        <img
          src={url}
          alt="Shared content"
          draggable="false"
          style={{ maxWidth: "100%", borderRadius: 12, marginTop: 4, display: "block", cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)", pointerEvents: "none" }}
          onClick={() => window.open(url, "_blank")}
        />
      );
    }

    if (text.startsWith("[viewonce]")) {
      const url = text.replace("[viewonce]", "");
      return (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer", py: 0.8, px: 1.2, background: "rgba(255,255,255,0.08)", borderRadius: "10px" }}
          onClick={() => handleOpenViewOnce(url, index)}
        >
          <LockIcon sx={{ fontSize: 16, color: "#ff80ab" }} />
          <Typography sx={{ fontSize: 13, fontFamily: "'DM Sans'", fontWeight: 500, color: "#ff80ab" }}>
            View Once Photo
          </Typography>
        </Box>
      );
    }

    if (text.startsWith("[viewonce_opened]")) {
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.8, px: 1.2, opacity: 0.55 }}>
          <EyeIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />
          <Typography sx={{ fontSize: 13, fontFamily: "'DM Sans'", fontStyle: "italic", color: "rgba(255,255,255,0.6)" }}>
            Disappearing Photo Opened
          </Typography>
        </Box>
      );
    }

    return <>{text}</>;
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !currentUser) return;
    const membersList = [currentUser.userid, ...selectedMembers];
    const newGroupMeta = {
      name: groupName.trim(),
      members: membersList,
      createdby: currentUser.userid,
      createdat: Date.now(),
      pic: ""
    };
    const initialMessage = serializeChat([], { erase: "none" }, newGroupMeta);
    try {
      const newBody = {
        userid: currentUser.userid,
        receiverid: "[GROUP]",
        message: initialMessage,
        timestamp: new Date().toISOString(),
        isRead: false
      };
      await axios.post(CHAT_API, newBody);
      showToast("Group created successfully!");
      setCreateGroupOpen(false);
      setGroupName("");
      setSelectedMembers([]);
      fetchInbox(false);
    } catch (err) {
      console.log("Error creating group:", err);
      showToast("Failed to create group", "error");
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeChat || !activeGroup || !currentUser) return;
    try {
      const updatedMembers = activeGroup.members.filter(uid => uid !== currentUser.userid);
      const updatedGroupMeta = {
        ...activeGroup,
        members: updatedMembers
      };
      const serialized = serializeChat(chatMessages, chatSettings, updatedGroupMeta);
      const updatedBody = {
        ...activeChat,
        message: serialized,
        timestamp: new Date().toISOString()
      };
      await axios.put(`${CHAT_API}/${activeChat.id}`, updatedBody);
      showToast("You have left the group");
      setActiveGroup(null);
      fetchInbox(false);
    } catch (err) {
      console.log("Error leaving group:", err);
      showToast("Failed to leave group", "error");
    }
  };

  const handleDeleteGroup = async () => {
  if (!activeChat || !activeGroup || !currentUser) return;
  try {
    await axios.delete(`${CHAT_API}/${activeChat.id}`);
    showToast("Group deleted");
    setActiveGroup(null);
    fetchInbox(false);
  } catch (err) {
    console.log("Error deleting group:", err);
    showToast("Failed to delete group", "error");
  }
};

  const groupPhotoInputRef = useRef(null);
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false);

  const handleGroupPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !activeGroup) return;
    setUploadingGroupPhoto(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const IMGBB_KEY = import.meta.env.VITE_IMGBB_API_KEY;
      const res = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, formData);
      const url = res.data?.data?.url;
      if (!url) throw new Error("No URL returned");

      const updatedGroupMeta = {
        ...activeGroup,
        pic: url
      };

      const serialized = serializeChat(chatMessages, chatSettings, updatedGroupMeta);

      const updatedBody = {
        ...activeChat,
        message: serialized,
        timestamp: new Date().toISOString()
      };

      const putRes = await axios.put(`${CHAT_API}/${activeChat.id}`, updatedBody);
      setActiveChat(putRes.data);
      const parsed = parseChatMessages(putRes.data.message);
      setChatMessages(parsed.messages);
      setActiveGroup(parsed.groupMeta);
      showToast("Group photo updated!");
      fetchInbox(false);
    } catch (err) {
      console.log("Error uploading group photo:", err);
      showToast("Failed to upload group photo", "error");
    } finally {
      setUploadingGroupPhoto(false);
    }
  };

  const profileFollowBtnProps = { myFollowing, myFollowers: followers, followLoading, onToggle: handleProfileFollowToggle };

  if (!currentUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#0a0a0f" }}>
        <CircularProgress sx={{ color: "#ff4081" }} />
      </Box>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0f; font-family: 'DM Sans', sans-serif; min-height: 100dvh; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,64,129,0.3); border-radius: 4px; }

        @media print {
          body, html, #root {
            display: none !important;
            visibility: hidden !important;
          }
        }

        .messages-container {
          position: fixed; inset: 0; z-index: 50; background: #0a0a0f;
          display: flex; overflow: hidden;
        }
        .inbox-sidebar {
          width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden;
          background: #0a0a0f;
        }
        .messages-page-scroll {
          flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
        }
        .messages-header {
          position: sticky; top: 0; z-index: 100; flex-shrink: 0;
          background: rgba(10,10,15,0.88); backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding: 14px 16px; display: flex; align-items: center; justify-content: space-between;
        }

        .pill-tabs {
          display: flex; gap: 8px; margin: 12px auto 0; max-width: 500px; padding: 0 16px;
          flex-shrink: 0;
        }
        .pill-tab {
          flex: 1; padding: 10px; border: none; cursor: pointer;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
          border-radius: 12px; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .pill-tab.active {
          background: linear-gradient(135deg, #ff4081, #f50057); color: #fff;
          box-shadow: 0 4px 12px rgba(255, 64, 129, 0.3);
        }
        .pill-tab.inactive {
          background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .pill-tab.inactive:hover {
          background: rgba(255, 255, 255, 0.08); color: #fff;
        }
        .create-group-btn {
          width: 100%; padding: 12px; margin-bottom: 16px; border: none; cursor: pointer;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13.5px;
          border-radius: 14px; transition: all 0.2s;
          background: linear-gradient(135deg, #ff4081, #ff80ab); color: #fff;
          box-shadow: 0 4px 15px rgba(255, 64, 129, 0.35);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .create-group-btn:hover {
          box-shadow: 0 6px 20px rgba(255, 64, 129, 0.55);
          transform: translateY(-1px);
        }

        .chat-list {
          margin-top: 10px;
        }
        .chat-list-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06); border-radius: 18px;
          margin-bottom: 10px; cursor: pointer; transition: all 0.2s;
        }
        .chat-list-row:hover {
          background: rgba(255,64,129,0.05); border-color: rgba(255,64,129,0.2);
          transform: translateY(-1px);
        }
        .chat-list-row.unread {
          background: rgba(255, 64, 129, 0.06);
          border-color: rgba(255, 64, 129, 0.3);
        }
        .chat-list-row.selected {
          background: rgba(255, 64, 129, 0.12) !important;
          border-color: rgba(255, 64, 129, 0.4) !important;
        }
        .chat-list-row.unread .chat-user-name {
          font-weight: 800 !important;
          color: #fff !important;
        }
        .chat-list-row.unread .chat-preview-text {
          font-weight: 600 !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .unread-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #ff4081; box-shadow: 0 0 8px #ff4081;
          margin-left: auto; flex-shrink: 0;
        }

        /* ── CHAT OVERLAY ── */
        .chat-page {
          position: fixed; inset: 0; z-index: 1300; background: #0a0a0f;
          display: flex; flex-direction: column; overflow: hidden;
          animation: slideInUp 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }

        .chat-page-blurred {
          filter: blur(20px) !important;
          pointer-events: none !important;
        }

        .chat-page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,15,0.92); backdrop-filter: blur(20px); flex-shrink: 0;
        }

        /* Desktop split pane rules */
        @media (min-width: 900px) {
          .inbox-sidebar {
            width: 380px;
            border-right: 1px solid rgba(255,255,255,0.06);
            flex-shrink: 0;
          }
          .chat-page {
            position: static !important;
            flex: 1 !important;
            display: flex !important;
            animation: none !important;
          }
          .chat-back-btn {
            display: none !important;
          }
          .chat-placeholder {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at 50% 20%, rgba(255,64,129,0.03) 0%, transparent 60%);
            border-left: 1px solid rgba(255,255,255,0.06);
            text-align: center;
            padding: 24px;
          }
        }

        /* Mobile specific rules */
        @media (max-width: 899px) {
          .chat-placeholder {
            display: none !important;
          }
          .chat-back-btn {
            display: inline-flex !important;
          }
        }
        .chat-stream {
          flex: 1; overflow-y: auto; padding: 20px 16px;
          display: flex; flex-direction: column; gap: 12px;
          background: radial-gradient(circle at 50% 20%, rgba(255,64,129,0.02) 0%, transparent 60%);
        }

        /* Message Bubbles */
        .msg-bubble-wrap {
          display: flex; flex-direction: column;
          max-width: 75%;
        }
        .msg-bubble-wrap.sent {
          align-self: flex-end;
          align-items: flex-end;
        }
        .msg-bubble-wrap.received {
          align-self: flex-start;
          align-items: flex-start;
        }

        .msg-bubble {
          padding: 10px 14px; border-radius: 16px;
          font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.5;
          word-break: break-word; user-select: none;
        }
        .msg-sent {
          background: linear-gradient(135deg, #ff4081, #f50057);
          color: #fff; border-bottom-right-radius: 4px;
          box-shadow: 0 2px 10px rgba(255,64,129,0.2);
        }
        .msg-received {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.9); border-bottom-left-radius: 4px;
          border: 1px solid rgba(255,255,255,0.08);
        }

        .chat-input-row {
          display: flex; gap: 8px; align-items: center;
          padding: 14px 16px 20px; border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(10,10,15,0.95);
        }

        .comment-item { padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; margin-bottom:8px; }
        .reply-btn { font-size:11px; color:rgba(255,64,129,0.7); cursor:pointer; background:none; border:none; padding:0; margin-top:4px; font-family:'DM Sans',sans-serif; display:inline-block; }
        .reply-btn:hover { color:#ff4081; }
        .liker-pill { display:inline-flex; align-items:center; gap:6px; background:rgba(255,64,129,0.08); border:1px solid rgba(255,64,129,0.18); border-radius:20px; padding:4px 10px; margin:3px; cursor:pointer; transition:background 0.2s; }
        .liker-pill:hover { background:rgba(255,64,129,0.16); }
        .comment-input-row { display:flex; gap:8px; align-items:flex-end; padding:12px 16px; border-top:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.3); }

        /* ── PROFILE STACK OVERLAY ── */
        .profile-page { position:fixed; inset:0; z-index:1500; background:#0a0a0f; display:flex; flex-direction:column; overflow:hidden; animation:slideInUp 0.28s cubic-bezier(0.22,1,0.36,1) both; }
        .profile-page-header { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(10,10,15,0.92); backdrop-filter:blur(20px); flex-shrink:0; }
        .profile-page-body { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }

        .uprofile-hero { background:linear-gradient(160deg,#1c0a15 0%,#2a0e22 50%,#160a1e 100%); padding:32px 20px 24px; position:relative; overflow:hidden; text-align:center; }
        .uprofile-hero::before { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 50% -20%,rgba(255,64,129,0.25) 0%,transparent 65%); pointer-events:none; }
        .uprofile-avatar-ring { position:relative; width:88px; height:88px; margin:0 auto 14px; }
        .uprofile-avatar-ring::before { content:''; position:absolute; inset:-3px; border-radius:50%; background:conic-gradient(#ff4081,#ff80ab,#f50057,#ff4081); animation:spinRing 5s linear infinite; z-index:0; }
        .uprofile-avatar-inner { position:absolute; inset:2px; border-radius:50%; overflow:hidden; z-index:1; background:#1a1a24; }

        .stats-row { display:flex; border-top:1px solid rgba(255,255,255,0.06); border-bottom:1px solid rgba(255,255,255,0.06); margin:16px 0 0; }
        .stat-block { flex:1; text-align:center; padding:12px 4px; border-right:1px solid rgba(255,255,255,0.06); cursor:pointer; transition:background 0.18s; }
        .stat-block:last-child { border-right:none; }
        .stat-block:hover { background:rgba(255,64,129,0.06); }
        .stat-block.no-click { cursor:default; }
        .stat-block.no-click:hover { background:transparent; }

        .uprofile-posts-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:2px; }
        .uprofile-post-thumb { aspect-ratio:1; overflow:hidden; background:rgba(255,255,255,0.04); position:relative; cursor:pointer; }
        .uprofile-post-thumb img { width:100%; height:100%; object-fit:cover; transition:transform 0.25s; }
        .uprofile-post-thumb:hover img { transform:scale(1.06); }
        .uprofile-post-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; gap:12px; opacity:0; transition:opacity 0.2s; }
        .uprofile-post-thumb:hover .uprofile-post-overlay { opacity:1; }

        .profile-post-view { position:fixed; inset:0; z-index:1600; background:#0a0a0f; display:flex; flex-direction:column; animation:slideInUp 0.22s cubic-bezier(0.22,1,0.36,1) both; }
        .profile-post-view img { pointer-events: none; -webkit-user-drag: none; }
        .profile-post-header { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(10,10,15,0.92); backdrop-filter:blur(20px); flex-shrink:0; }
        .tab-btn { flex:1; padding:8px; border:none; cursor:pointer; font-family:'Syne',sans-serif; font-weight:700; font-size:12px; border-radius:10px; transition:background 0.2s,color 0.2s; }
        .tab-btn.active   { background:rgba(255,64,129,0.18); color:#ff80ab; border:1px solid rgba(255,64,129,0.3); }
        .tab-btn.inactive { background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.07); }

        .feed-follow-btn { font-family:'Syne',sans-serif; font-weight:700; font-size:11px; padding:3px 12px; border-radius:20px; border:none; cursor:pointer; transition:all 0.18s; letter-spacing:0.3px; min-width:68px; display:inline-flex; align-items:center; justify-content:center; }
        .feed-follow-btn.not-following { background:linear-gradient(135deg,#ff4081,#f50057); color:#fff; box-shadow:0 2px 10px rgba(255,64,129,0.35); }
        .feed-follow-btn.not-following:hover { box-shadow:0 3px 14px rgba(255,64,129,0.55); transform:translateY(-1px); }
        .feed-follow-btn.following { background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.55); border:1px solid rgba(255,255,255,0.12); }
        .feed-follow-btn.following:hover { background:rgba(255,64,64,0.1); color:#ff6b6b; border-color:rgba(255,64,64,0.25); }
        .feed-follow-btn:disabled { opacity:0.55; cursor:not-allowed; transform:none!important; }

        .follow-list-item { display:flex; align-items:center; gap:10px; padding:10px 6px; border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s; border-radius:8px; }
        .follow-list-item:last-child { border-bottom:none; }
        .follow-list-item:hover { background:rgba(255,64,129,0.04); }

        .image-preview-box {
          border: 1px dashed rgba(255,64,129,0.3);
          border-radius: 12px;
          padding: 8px;
          margin-bottom: 12px;
          display: flex;
          justify-content: center;
          background: rgba(255,64,129,0.04);
        }

        .disappearing-viewer {
          position: fixed; inset: 0; z-index: 1700;
          background: #000; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        
        .disappearing-viewer img {
          pointer-events: none;
          -webkit-user-drag: none;
        }

        .menu-dark .MuiPaper-root {
          background: #1c1c28 !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          color: #fff !important;
          border-radius: 12px !important;
        }
        .menu-dark .MuiMenuItem-root {
          font-family: 'DM Sans', sans-serif !important;
          font-size: 13px !important;
        }

        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="messages-container">
        
        {/* ── LEFT SIDEBAR: INBOX LIST ── */}
        <div className="inbox-sidebar">
          {/* ── MESSAGES HEADER ── */}
          <div className="messages-header" style={{ padding: "12px 16px" }}>
            <Brand variant="small" />
          </div>

          {/* ── TAB SWITCHER ── */}
          <div className="pill-tabs">
            <button
              className={`pill-tab ${activeTab === "dms" ? "active" : "inactive"}`}
              onClick={() => setActiveTab("dms")}
            >
              💬 DMs
            </button>
            <button
              className={`pill-tab ${activeTab === "groups" ? "active" : "inactive"}`}
              onClick={() => setActiveTab("groups")}
            >
              👥 Groups
            </button>
          </div>

          {/* ── CHAT INBOX LIST ── */}
          <div className="messages-page-scroll">
          <Box sx={{ maxWidth: 500, mx: "auto", px: 2, pt: 1, pb: "96px" }}>
            {activeTab === "groups" && (
              <button className="create-group-btn" onClick={() => setCreateGroupOpen(true)}>
                <AddIcon /> Create Group
              </button>
            )}

            <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", mb: 2, textTransform: "uppercase" }}>
              {activeTab === "dms" ? "Conversations" : "Your Groups"}
            </Typography>
            
            {activeTab === "dms" ? (
              followingUsers.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <Typography sx={{ fontSize: 40 }}>💬</Typography>
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.25)", mt: 1.5, px: 3 }}>
                    Follow users from the Discover page to start chatting with them!
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/discover")}
                    sx={{
                      mt: 2.5, borderColor: "rgba(255,64,129,0.3)", color: "#ff80ab",
                      borderRadius: "10px", textTransform: "none", fontSize: 12.5,
                      "&:hover": { borderColor: "#ff4081", background: "rgba(255,64,129,0.05)" }
                    }}
                  >
                    Go to Discover
                  </Button>
                </Box>
              ) : (
                <div className="chat-list">
                  {followingUsers.map(otherUser => {
                    const isRowUnread = isDMUnread(otherUser.userid);
                    const isRowSelected = activeUser?.userid === otherUser.userid && !activeGroup;
                    return (
                      <div className={`chat-list-row ${isRowUnread ? "unread" : ""} ${isRowSelected ? "selected" : ""}`} key={otherUser.userid} onClick={() => openChat(otherUser)}>
                        <Avatar src={otherUser.profilepic} sx={{ width: 46, height: 46, background: "#ff4081", fontFamily: "'Syne'", fontWeight: 700 }}>
                          {otherUser.userid?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography className="chat-user-name" sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 14.5, color: "#fff", lineHeight: 1.2 }}>
                            @{otherUser.userid}
                          </Typography>
                          <Typography className="chat-preview-text" sx={{ fontFamily: "'DM Sans'", fontSize: 12.5, color: "rgba(255,255,255,0.4)", mt: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {getChatPreview(otherUser.userid)}
                          </Typography>
                        </Box>
                        {isRowUnread && <div className="unread-dot" />}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Groups Tab */
              getGroupConversations().length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <Typography sx={{ fontSize: 40 }}>👥</Typography>
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.25)", mt: 1.5, px: 3 }}>
                    You are not in any groups yet. Create one above to start group messaging!
                  </Typography>
                </Box>
              ) : (
                <div className="chat-list">
                  {getGroupConversations().map(groupRow => {
                    const parsed = parseChatMessages(groupRow.message);
                    const gMeta = parsed.groupMeta;
                    const lastMsg = parsed.messages[parsed.messages.length - 1];
                    let previewText = "No messages yet. Tap to chat!";
                    if (lastMsg) {
                      if (lastMsg.text.startsWith("[photo]")) previewText = `${lastMsg.sender === currentUser.userid ? "You" : "@" + lastMsg.sender}: sent a photo`;
                      else if (lastMsg.text.startsWith("[viewonce]")) previewText = `${lastMsg.sender === currentUser.userid ? "You" : "@" + lastMsg.sender}: sent a disappearing photo`;
                      else if (lastMsg.text.startsWith("[viewonce_opened]")) previewText = `${lastMsg.sender === currentUser.userid ? "You" : "@" + lastMsg.sender}: opened disappearing photo`;
                      else previewText = `${lastMsg.sender === currentUser.userid ? "You" : "@" + lastMsg.sender}: ${lastMsg.text}`;
                    }
                    const isGroupUnread = isUnread(groupRow);
                    const isGroupSelected = activeChat?.id === groupRow.id;
                    return (
                      <div className={`chat-list-row ${isGroupUnread ? "unread" : ""} ${isGroupSelected ? "selected" : ""}`} key={groupRow.id} onClick={() => openChat(groupRow, true)}>
                        <Avatar src={gMeta?.pic} sx={{ width: 46, height: 46, background: "linear-gradient(135deg,#ff4081,#ff80ab)", fontFamily: "'Syne'", fontWeight: 700 }}>
                          {!gMeta?.pic && <GroupIcon sx={{ fontSize: 24, color: "#fff" }} />}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography className="chat-user-name" sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 14.5, color: "#fff", lineHeight: 1.2 }}>
                            {gMeta?.name}
                          </Typography>
                          <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11.5, color: "rgba(255,255,255,0.35)", mt: 0.2 }}>
                            👥 {gMeta?.members.length} {gMeta?.members.length === 1 ? "member" : "members"}
                          </Typography>
                          <Typography className="chat-preview-text" sx={{ fontFamily: "'DM Sans'", fontSize: 12.5, color: "rgba(255,255,255,0.4)", mt: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {previewText}
                          </Typography>
                        </Box>
                        {isGroupUnread && <div className="unread-dot" />}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </Box>
          </div> {/* end messages-page-scroll */}
        </div> {/* end inbox-sidebar */}

      {/* ── CHAT PANEL / PLACEHOLDER ── */}
      {(activeUser || activeGroup) ? (
        <div className={`chat-page ${screenShieldActive ? "chat-page-blurred" : ""}`}>
          <div className="chat-page-header">
            <IconButton className="chat-back-btn" size="small" onClick={() => { setActiveUser(null); setActiveGroup(null); fetchInbox(false); }} sx={{ color: "rgba(255,255,255,0.7)", "&:hover": { color: "#ff80ab" } }}>
              <ArrowBackIcon sx={{ fontSize: 22 }} />
            </IconButton>
            <Box sx={{ display: { xs: "none", md: "none" } }}>
            </Box>

            <Box
              sx={{ flex: 1, ml: { xs: 1.5, md: 0.5 }, display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
              onClick={() => {
                if (chatMode === "dm") {
                  openUserProfile(activeUser.userid);
                } else if (chatMode === "group") {
                  setGroupMembersDialogOpen(true);
                }
              }}
            >
              {chatMode === "dm" ? (
                <Avatar src={activeUser.profilepic} sx={{ width: 32, height: 32, background: "#ff4081", fontFamily: "'Syne'", fontWeight: 700, fontSize: 12 }}>
                  {activeUser.userid?.[0]?.toUpperCase()}
                </Avatar>
              ) : (
                <Avatar src={activeGroup?.pic} sx={{ width: 32, height: 32, background: "linear-gradient(135deg,#ff4081,#ff80ab)", fontFamily: "'Syne'", fontWeight: 700, fontSize: 12 }}>
                  {!activeGroup?.pic && <GroupIcon sx={{ fontSize: 18, color: "#fff" }} />}
                </Avatar>
              )}
              <Box>
                <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 15, color: "#fff", lineHeight: 1 }}>
                  {chatMode === "dm" ? `@${activeUser.userid}` : activeGroup?.name}
                </Typography>
                {chatMode === "group" && activeGroup && (
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.45)", mt: 0.3 }}>
                    👥 {activeGroup.members?.length} members
                  </Typography>
                )}
                {chatSettings.erase && chatSettings.erase !== "none" && (
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 9.5, color: "#ff80ab", mt: 0.3 }}>
                    ⏳ Auto-erase: {chatSettings.erase}
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton size="small" onClick={() => setSettingsDialogOpen(true)} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#ff80ab" } }}>
                <SettingsIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={refreshChat} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#ff80ab" } }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={handleOpenHeaderMenu} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#ff80ab" } }}>
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => { setActiveUser(null); setActiveGroup(null); fetchInbox(false); }} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#ff5252" } }}>
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>
          </div>

          {loadingChat ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
              <CircularProgress sx={{ color: "#ff4081" }} />
            </Box>
          ) : (
            <div className="chat-stream">
              {chatMessages.length === 0 ? (
                <Box sx={{ textAlign: "center", my: "auto", py: 6, color: "rgba(255,255,255,0.2)" }}>
                  <Typography sx={{ fontSize: 32, mb: 1 }}>🔒 Shield Protected Chat</Typography>
                  <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, fontStyle: "italic" }}>
                    {chatMode === "dm" ? `Say hello to @${activeUser?.userid || ""}!` : "Say hello to the group!"} Screenshot shields are active.
                  </Typography>
                </Box>
              ) : (() => {
                const lastSentIdx = chatMessages.map(m => m.sender).lastIndexOf(currentUser.userid);
                return chatMessages.map((msg, i) => {
                  const isMe = msg.sender === currentUser.userid;
                  return (
                    <div
                      className={`msg-bubble-wrap ${isMe ? "sent" : "received"}`}
                      key={i}
                      onContextMenu={(e) => handleContextMenu(e, msg, i)}
                      onTouchStart={(e) => handleTouchStart(e, msg, i)}
                      onTouchEnd={handleTouchEnd}
                    >
                      {!isMe && chatMode === "group" && (
                        <Typography sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: "'Syne'",
                          color: "#ff80ab",
                          mb: 0.4,
                          cursor: "pointer",
                          "&:hover": { textDecoration: "underline" }
                        }} onClick={() => openUserProfile(msg.sender)}>
                          @{msg.sender}
                        </Typography>
                      )}
                      <div className={`msg-bubble ${isMe ? "msg-sent" : "msg-received"}`} style={{ cursor: "context-menu" }}>
                        {renderBubbleContent(msg, i)}
                      </div>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.3 }}>
                        <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.25)", px: 0.5 }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        {isMe && i === lastSentIdx && chatMode === "dm" && showSeenStatus && (
                          <Typography sx={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            fontFamily: "'DM Sans'",
                            color: (activeChat?.isRead === true || activeChat?.isRead === "true") ? "#ff80ab" : "rgba(255,255,255,0.35)",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.2
                          }}>
                            {(activeChat?.isRead === true || activeChat?.isRead === "true") ? (
                              <>
                                <DoneAllIcon sx={{ fontSize: 11, color: "#ff80ab" }} /> Seen
                              </>
                            ) : (
                              <>
                                <DoneIcon sx={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }} /> Sent
                              </>
                            )}
                          </Typography>
                        )}
                      </Box>
                    </div>
                  );
                });
              })()}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Chat input */}
          <Box className="chat-input-row">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              sx={{
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.5)",
                borderRadius: "12px",
                width: 40,
                height: 40,
                flexShrink: 0,
                "&:hover": { color: "#ff80ab", background: "rgba(255,64,129,0.08)" }
              }}
            >
              <PhotoCameraIcon sx={{ fontSize: 18 }} />
            </IconButton>

            <TextField
              fullWidth
              size="small"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder={chatMode === "dm" ? `Message @${activeUser?.userid || ""}…` : "Message group…"}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.08)"
                },
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                "& input::placeholder": { color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans'" }
              }}
            />
            <IconButton
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              sx={{
                background: newMessage.trim() ? "#ff4081" : "rgba(255,255,255,0.05)",
                color: "#fff",
                borderRadius: "12px",
                width: 40,
                height: 40,
                flexShrink: 0,
                "&:hover": { background: "#e91e63" },
                "&:disabled": { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" }
              }}
            >
              {sending ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <SendIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Box>

          {/* Privacy screen shield overlay */}
          {screenShieldActive && (
            <Box sx={{
              position: "absolute", inset: 0, zIndex: 10000,
              background: "rgba(10,10,15,0.96)", display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(25px)", color: "#fff", textAlign: "center"
            }}>
              <Typography variant="h5" sx={{ fontFamily: "'Syne'", color: "#ff4081", fontWeight: 700, mb: 1, letterSpacing: "-0.5px" }}>
                🔒 Screen Shield Active
              </Typography>
              <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.5)", maxW: 280, px: 2, lineHeight: 1.6 }}>
                Screenshots and screen recordings are restricted in this chat. Window focus blurred due to security check.
              </Typography>
            </Box>
          )}
        </div>
      ) : (
        <div className="chat-placeholder">
          <Typography sx={{ fontSize: 56, mb: 2 }}>💬</Typography>
          <Typography variant="h5" sx={{ fontFamily: "'Syne'", fontWeight: 800, color: "#fff", mb: 1 }}>
            Your Messages
          </Typography>
          <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13.5, color: "rgba(255,255,255,0.35)", maxWidth: 300 }}>
            Select a direct message or group conversation from the list to start chatting.
          </Typography>
        </div>
      )}
      </div> {/* end messages-container */}

      {/* ── BUBBLE CONTEXT MENU (Mobile & Desktop) ── */}
      <Menu
        open={menuAnchor !== null}
        onClose={() => setMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          menuAnchor !== null
            ? { top: menuAnchor.mouseY, left: menuAnchor.mouseX }
            : undefined
        }
        className="menu-dark"
      >
        <MenuItem onClick={() => handleCopy(menuTarget?.msg.text)}>
          <ContentCopyIcon sx={{ fontSize: 16, mr: 1, color: "rgba(255,255,255,0.6)" }} /> Copy Message
        </MenuItem>
        
        {menuTarget?.msg.sender === currentUser.userid && 
         !menuTarget?.msg.text.startsWith("[photo]") && 
         !menuTarget?.msg.text.startsWith("[viewonce]") && 
         !menuTarget?.msg.text.startsWith("[viewonce_opened]") && (
          <MenuItem onClick={handleOpenEdit}>
            <EditIcon sx={{ fontSize: 16, mr: 1, color: "rgba(255,255,255,0.6)" }} /> Edit Message
          </MenuItem>
        )}
        
        {menuTarget?.msg.sender === currentUser.userid && (
          <MenuItem onClick={() => deleteMsg(menuTarget?.index)} sx={{ color: "#ff5252" }}>
            <DeleteIcon sx={{ fontSize: 16, mr: 1, color: "#ff5252" }} /> Delete Message
          </MenuItem>
        )}
      </Menu>

      {/* ── HEADER MORE OPTIONS MENU ── */}
      <Menu
        anchorEl={headerMenuAnchor}
        open={Boolean(headerMenuAnchor)}
        onClose={() => setHeaderMenuAnchor(null)}
        className="menu-dark"
      >
        {chatMode === "dm" && (
          <MenuItem onClick={() => { setHeaderMenuAnchor(null); openUserProfile(activeUser.userid); }}>
            👤 View Profile
          </MenuItem>
        )}
        {chatMode === "dm" && (
          <MenuItem onClick={() => { setShowSeenStatus(prev => !prev); setHeaderMenuAnchor(null); }}>
            {showSeenStatus ? "🚫 Hide Seen Receipts" : "👁️ Show Seen Receipts"}
          </MenuItem>
        )}
        {chatMode === "group" && (
  currentUser?.userid === activeGroup?.createdby ? (
    <MenuItem onClick={() => { setHeaderMenuAnchor(null); handleDeleteGroup(); }} sx={{ color: "#ff5252" }}>
      <DeleteIcon sx={{ fontSize: 16, mr: 1 }} /> Delete Group
    </MenuItem>
  ) : (
    <MenuItem onClick={() => { setHeaderMenuAnchor(null); handleLeaveGroup(); }} sx={{ color: "#ff5252" }}>
      <LogoutIcon sx={{ fontSize: 16, mr: 1 }} /> Leave Group
    </MenuItem>
  )
)}
        
        <MenuItem onClick={() => { setHeaderMenuAnchor(null); clearHistory(); }} sx={{ color: "#ff5252" }}>
          🗑️ Clear Chat History
        </MenuItem>
      </Menu>

      {/* ── AUTO-ERASE CONFIG DIALOG ── */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} className="dialog-dark" fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: "'Syne'", fontWeight: 700 }}>Chat Settings</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", mb: 1.5, textTransform: "uppercase", fontFamily: "'Syne'", fontWeight: 700 }}>
            Auto-Erase Timer
          </Typography>
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", mb: 2, fontFamily: "'DM Sans'" }}>
            Select a timer to automatically delete chat history from the server. Checks occur every time the chat is opened.
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              { label: "Erase after 30 Minutes", value: "30m" },
              { label: "Erase after 1 Hour", value: "1h" },
              { label: "Erase after 6 Hours", value: "6h" },
              { label: "Erase after 24 Hours", value: "24h" },
              { label: "Don't Erase (Off)", value: "none" }
            ].map(item => (
              <Button
                key={item.value}
                variant={chatSettings.erase === item.value ? "contained" : "outlined"}
                onClick={() => handleSaveEraseSetting(item.value)}
                sx={{
                  justifyContent: "flex-start",
                  fontFamily: "'DM Sans'",
                  textTransform: "none",
                  borderRadius: "10px",
                  py: 1.2,
                  px: 2,
                  borderColor: chatSettings.erase === item.value ? "#ff4081" : "rgba(255,255,255,0.1)",
                  background: chatSettings.erase === item.value ? "linear-gradient(135deg,#ff4081,#f50057)" : "transparent",
                  color: "#fff",
                  "&:hover": {
                    borderColor: "#ff80ab",
                    background: chatSettings.erase === item.value ? "linear-gradient(135deg,#ff6090,#f50057)" : "rgba(255,255,255,0.05)"
                  }
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          {chatMode === "dm" && (
            <>
              <Divider sx={{ my: 2.5, borderColor: "rgba(255,255,255,0.06)" }} />
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", mb: 1.5, textTransform: "uppercase", fontFamily: "'Syne'", fontWeight: 700 }}>
                Privacy & Seen Receipts
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={showSeenStatus}
                    onChange={e => setShowSeenStatus(e.target.checked)}
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": { color: "#ff4081" },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#ff4081" }
                    }}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontSize: 13, fontFamily: "'DM Sans'", color: "#fff", fontWeight: 600 }}>Show Seen Status</Typography>
                    <Typography sx={{ fontSize: 11, fontFamily: "'DM Sans'", color: "rgba(255,255,255,0.4)" }}>Show ✓ Sent and ✓✓ Seen tick receipts below messages</Typography>
                  </Box>
                }
                sx={{ ml: 0 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)} sx={{ fontFamily: "'Syne'", color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── EDIT MESSAGE TEXT DIALOG ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} className="dialog-dark" fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: "'Syne'", fontWeight: 700 }}>Edit Message</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                background: "rgba(255,255,255,0.04)"
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
          <Button onClick={saveEdit} variant="contained" sx={{ background: "#ff4081", "&:hover": { background: "#e91e63" } }}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── PHOTO UPLOAD CONFIG DIALOG (View Once toggle) ── */}
      <Dialog open={uploadDialogOpen} onClose={() => { if(!uploadingPhoto){ setUploadDialogOpen(false); setPhotoFile(null); } }} className="dialog-dark" fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: "'Syne'", fontWeight: 700 }}>Send Photo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <div className="image-preview-box">
            {photoPreview && <img src={photoPreview} alt="Upload preview" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, objectFit: "contain" }} />}
          </div>
          <FormControlLabel
            control={
              <Switch
                checked={viewOnceToggle}
                onChange={e => setViewOnceToggle(e.target.checked)}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": { color: "#ff4081" },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#ff4081" }
                }}
              />
            }
            label={
              <Box>
                <Typography sx={{ fontSize: 13, fontFamily: "'DM Sans'", color: "#fff", fontWeight: 600 }}>disappearing photo (View Once)</Typography>
                <Typography sx={{ fontSize: 11, fontFamily: "'DM Sans'", color: "rgba(255,255,255,0.4)" }}>Photo disappears forever after receiver views it once</Typography>
              </Box>
            }
            sx={{ mt: 1, ml: 0 }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={uploadingPhoto} onClick={() => { setUploadDialogOpen(false); setPhotoFile(null); }} sx={{ color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
          <Button disabled={uploadingPhoto} onClick={handleSendPhoto} variant="contained" sx={{ background: "#ff4081", "&:hover": { background: "#e91e63" } }}>
            {uploadingPhoto ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Send Photo"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── FULL-SCREEN VIEW ONCE DISAPPEARING MEDIA VIEW ── */}
      {viewOnceUrl && (
        <div className="disappearing-viewer" onClick={handleCloseViewOnce}>
          <Typography sx={{ position: "absolute", top: 20, left: 20, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans'", fontSize: 12.5 }}>
            📸 View Once Media (Tap anywhere to close)
          </Typography>
          <img
            src={viewOnceUrl}
            alt="Disappearing"
            style={{ maxWidth: "100%", maxHeight: "80%", objectFit: "contain", display: "block" }}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="contained"
            onClick={handleCloseViewOnce}
            sx={{
              position: "absolute", bottom: 40, background: "linear-gradient(135deg,#ff4081,#f50057)",
              borderRadius: "12px", fontFamily: "'Syne'", px: 4, py: 1.2
            }}
          >
            Close & Disappear
          </Button>
        </div>
      )}

      {/* ── SNACKBAR TOAST ── */}
      <Snackbar open={toastOpen} autoHideDuration={2500} onClose={() => setToastOpen(false)} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert onClose={() => setToastOpen(false)} severity={toastSeverity} variant="filled" sx={{ width: '100%', borderRadius: "10px" }}>
          {toastMsg}
        </Alert>
      </Snackbar>

      {/* ── CREATE GROUP DIALOG ── */}
      <Dialog open={createGroupOpen} onClose={() => { setCreateGroupOpen(false); setGroupName(""); setSelectedMembers([]); }} className="dialog-dark" fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontFamily: "'Syne'", fontWeight: 700 }}>Create New Group</DialogTitle>
        <DialogContent sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            fullWidth
            label="Group Name"
            variant="outlined"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            sx={{
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "12px"
              },
              "& label": { color: "rgba(255,255,255,0.4)" },
              "& label.Mui-focused": { color: "#ff4081" }
            }}
          />

          <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", textTransform: "uppercase", mt: 1 }}>
            Add Members (Followers)
          </Typography>

          <Box sx={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
            {followingUsers.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic", textAlign: "center", py: 2 }}>
                You must follow users to add them to groups.
              </Typography>
            ) : (
              followingUsers.map(user => {
                const isSelected = selectedMembers.includes(user.userid);
                return (
                  <Box
                    key={user.userid}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1.2,
                      background: isSelected ? "rgba(255,64,129,0.08)" : "rgba(255,255,255,0.03)",
                      border: "1px solid",
                      borderColor: isSelected ? "#ff4081" : "rgba(255,255,255,0.06)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedMembers(prev => prev.filter(uid => uid !== user.userid));
                      } else {
                        setSelectedMembers(prev => [...prev, user.userid]);
                      }
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                      <Avatar src={user.profilepic} sx={{ width: 32, height: 32, background: "#ff4081", fontSize: 12 }}>
                        {user.userid?.[0]?.toUpperCase()}
                      </Avatar>
                      <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 13.5, color: "#fff" }}>
                        @{user.userid}
                      </Typography>
                    </Box>
                    <IconButton size="small" sx={{ color: isSelected ? "#ff4081" : "rgba(255,255,255,0.3)" }}>
                      {isSelected ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                    </IconButton>
                  </Box>
                );
              })
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { setCreateGroupOpen(false); setGroupName(""); setSelectedMembers([]); }} sx={{ fontFamily: "'Syne'", color: "rgba(255,255,255,0.5)" }}>Cancel</Button>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedMembers.length === 0}
            variant="contained"
            sx={{
              background: "linear-gradient(135deg,#ff4081,#f50057)",
              fontFamily: "'Syne'",
              fontWeight: 700,
              borderRadius: "10px",
              boxShadow: "0 2px 8px rgba(255,64,129,0.3)",
              "&:hover": { background: "linear-gradient(135deg,#ff6090,#f50057)" }
            }}
          >
            Create Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── GROUP INFO & MEMBERS DIALOG ── */}
      <Dialog open={groupMembersDialogOpen} onClose={() => setGroupMembersDialogOpen(false)} fullWidth maxWidth="xs" className="dialog-dark">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
          <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 15, color: "#fff" }}>Group Info</Typography>
          <IconButton size="small" onClick={() => setGroupMembersDialogOpen(false)} sx={{ color: "rgba(255,255,255,0.4)" }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ py: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <input
            type="file"
            accept="image/*"
            ref={groupPhotoInputRef}
            style={{ display: "none" }}
            onChange={handleGroupPhotoChange}
          />
          <Box sx={{ position: "relative" }}>
            <Avatar src={activeGroup?.pic} sx={{ width: 80, height: 80, background: "linear-gradient(135deg,#ff4081,#ff80ab)", fontSize: 32 }}>
              {!activeGroup?.pic && <GroupIcon sx={{ fontSize: 40, color: "#fff" }} />}
            </Avatar>
            <IconButton
              onClick={() => groupPhotoInputRef.current?.click()}
              disabled={uploadingGroupPhoto}
              sx={{
                position: "absolute", bottom: -4, right: -4,
                background: "#ff4081", color: "#fff",
                width: 28, height: 28,
                "&:hover": { background: "#e91e63" },
                "&.Mui-disabled": { background: "rgba(255,255,255,0.1)" }
              }}
            >
              {uploadingGroupPhoto ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : <PhotoCameraIcon sx={{ fontSize: 14 }} />}
            </IconButton>
          </Box>

          <Box sx={{ textAlign: "center", width: "100%" }}>
            <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 18, color: "#fff" }}>
              {activeGroup?.name}
            </Typography>
            <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11.5, color: "rgba(255,255,255,0.4)", mt: 0.5 }}>
              👑 Created by @{activeGroup?.createdby}
            </Typography>
            {activeGroup?.createdat && (
              <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 11, color: "rgba(255,255,255,0.35)", mt: 0.2 }}>
                📅 Created on {new Date(activeGroup.createdat).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            )}
          </Box>

          <Divider sx={{ width: "100%", borderColor: "rgba(255,255,255,0.06)" }} />

          <Typography sx={{ width: "100%", fontFamily: "'Syne'", fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "1px", textTransform: "uppercase" }}>
            Members ({activeGroup?.members?.length})
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", maxHeight: 200, overflowY: "auto" }}>
            {activeGroup?.members?.map((uid, i) => (
              <div className="follow-list-item" key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, cursor: "pointer", flex: 1, minWidth: 0 }}
                  onClick={() => { setGroupMembersDialogOpen(false); openUserProfile(uid); }}>
                  <Avatar src={users[uid]?.profilepic} sx={{ width: 32, height: 32, background: "rgba(255,64,129,0.3)", color: "#ff80ab", fontFamily: "'Syne'", fontWeight: 700, fontSize: 12 }}>
                    {uid[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontFamily: "'Syne'", fontWeight: 700, fontSize: 13, color: "#fff", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      @{uid} {uid === activeGroup.createdby && <span style={{ color: "#ff4081", fontSize: 9, fontWeight: 700 }}>(Admin)</span>}
                    </Typography>
                    {profiles[uid]?.profession && <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>{profiles[uid].profession}</Typography>}
                  </Box>
                </Box>
                {currentUser && uid !== currentUser.userid && (
                  <FollowBtn uid={uid} stopProp {...profileFollowBtnProps} />
                )}
              </div>
            ))}
          </Box>
        </DialogContent>
      </Dialog>

      {viewingUser && createPortal(
        <ProfileView
          viewingUser={viewingUser}
          currentUser={currentUser}
          myFollowing={myFollowing}
          myFollowers={followers}
          followLoading={followLoading}
          onFollowToggle={handleProfileFollowToggle}
          onClose={() => setViewingUser(null)}
          onOpenProfile={openUserProfile}
          usersMap={users}
          profilesMap={profiles}
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
