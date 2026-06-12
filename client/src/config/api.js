export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export const ENDPOINTS = {
  USERS: `${API_BASE}/credentials`,
  PROFILES: `${API_BASE}/persona`,
  POSTS: `${API_BASE}/post`,
  MESSAGES: `${API_BASE}/message`,
};

export const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY || "77caf76e0d4db991647141710657112b";
