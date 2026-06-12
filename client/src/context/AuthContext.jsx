/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { ENDPOINTS } from '../config/api';

const USER_API = ENDPOINTS.USERS;

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedId = localStorage.getItem('userId');
    if (storedId) {
      axios.get(USER_API).then(res => {
        const user = res.data.find(u => u.userid === storedId);
        if (user) {
          setCurrentUser(user);
        } else {
          // Clean invalid credentials from local storage
          localStorage.removeItem('userId');
        }
      }).catch(() => {
        localStorage.removeItem('userId');
      }).finally(() => {
        setAuthLoading(false);
      });
    } else {
      setAuthLoading(false);
    }
  }, []);

  const login = async (userid, password) => {
    const res = await axios.get(USER_API);
    const user = res.data.find(u => u.userid === userid);
    if (!user) throw new Error('User not found');
    if (user.password !== password) throw new Error('Invalid password');
    localStorage.setItem('userId', userid);
    setCurrentUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('userId');
    setCurrentUser(null);
  };

  const register = async (newUser) => {
    const { userid, password, email } = newUser;
    // check uniqueness
    const res = await axios.get(USER_API);
    if (res.data.some(u => u.userid === userid)) {
      throw new Error('UserID already exists');
    }
    // Basic password validation
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    // Create user via POST
    await axios.post(USER_API, { userid, password, email, followers: '', following: '' });
    // Optionally send verification email – placeholder
    // Store logged in
    localStorage.setItem('userId', userid);
    setCurrentUser({ userid, password, email, followers: '', following: '' });
    return currentUser;
  };

  const updatePassword = async (userid, newPassword) => {
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const res = await axios.get(USER_API);
    const userRec = res.data.find(u => u.userid === userid);
    if (!userRec) throw new Error('User not found');

    const { id, ...body } = userRec;
    await axios.put(`${USER_API}/${id}`, { ...body, password: newPassword });

    if (currentUser && currentUser.userid === userid) {
      setCurrentUser({ ...userRec, password: newPassword });
    }
  };

  const value = {
    currentUser,
    authLoading,
    login,
    logout,
    register,
    updatePassword,
    refreshUser: (updated) => setCurrentUser(updated),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
