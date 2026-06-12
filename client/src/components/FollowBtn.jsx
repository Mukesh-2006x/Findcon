// src/components/FollowBtn.jsx
import React from 'react';
import { Button, CircularProgress } from '@mui/material';

export default function FollowBtn({
  children,
  onClick,
  disabled = false,
  variant = 'contained',
  uid,
  myFollowing,
  myFollowers,       // Set of UIDs who follow the current user
  followLoading = {},
  onToggle,
  stopProp = false,
  sx = {},
}) {
  const isToggle    = Boolean(uid && myFollowing && onToggle);
  const isFollowing = isToggle && myFollowing.has(uid);
  const followsMe   = Boolean(myFollowers?.has(uid));
  const showFollowBack = !isFollowing && followsMe;
  const loading     = isToggle ? Boolean(followLoading[uid]) : false;

  const handleClick = (event) => {
    if (stopProp) event.stopPropagation();
    if (loading || disabled) return;
    if (isToggle) {
      onToggle(uid);
      return;
    }
    if (onClick) onClick(event);
  };

  // ── Label ──────────────────────────────────────────────────────────────────
  let label;
  if (loading) {
    label = <CircularProgress size={14} sx={{ color: '#fff' }} />;
  } else if (isToggle) {
    label = isFollowing ? 'Following' : showFollowBack ? 'Follow Back' : 'Follow';
  } else {
    label = children;
  }

  // ── Style ──────────────────────────────────────────────────────────────────
  let btnStyle;
  if (isToggle && isFollowing) {
    // Already following
    btnStyle = {
      background: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.9)',
      border: '1px solid rgba(255,255,255,0.14)',
      '&:hover': { background: 'rgba(255,255,255,0.12)' },
    };
  } else if (showFollowBack) {
    // They follow me but I haven't followed back — purple accent
    btnStyle = {
      background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
      color: '#fff',
      boxShadow: '0 6px 18px rgba(124,58,237,0.30)',
      '&:hover': { filter: 'brightness(1.08)' },
    };
  } else {
    // Default — not following at all
    btnStyle = {
      background: 'linear-gradient(135deg,#ff4081,#f50057)',
      color: '#fff',
      boxShadow: '0 6px 18px rgba(255,64,129,0.22)',
      '&:hover': { filter: 'brightness(1.05)' },
    };
  }

  return (
    <Button
      variant={variant}
      size="small"
      onClick={handleClick}
      disabled={disabled || loading}
      sx={{
        textTransform: 'none',
        fontWeight: 700,
        letterSpacing: 0.3,
        borderRadius: '20px',
        minWidth: 90,
        px: 2,
        py: 0.8,
        fontFamily: "'Syne', sans-serif",
        transition: 'all 0.2s ease',
        ...btnStyle,
        '&.Mui-disabled': {
          opacity: 0.65,
          color: 'rgba(255,255,255,0.6)',
          background: isFollowing
            ? 'rgba(255,255,255,0.06)'
            : showFollowBack
            ? 'rgba(124,58,237,0.18)'
            : 'rgba(255,64,129,0.18)',
          boxShadow: 'none',
        },
        ...sx,
      }}
    >
      {label}
    </Button>
  );
}
