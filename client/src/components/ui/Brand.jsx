import React from "react";
import { Box, Typography } from "@mui/material";
import logoImg from "../../assets/logo.PNG";

/**
 * Unified Brand Logo and Slogan Component
 * @param {object} props
 * @param {'small' | 'large'} props.variant - Display format
 * @param {object} props.sx - MUI style overrides
 */
export default function Brand({ variant = "small", sx = {} }) {
  if (variant === "large") {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, ...sx }}>
        <Box component="img" src={logoImg} sx={{ width: 60, height: 60, borderRadius: '16px', mb: 1.5, objectFit: 'contain' }} />
        <Typography sx={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: '28px',
          textAlign: 'center',
          mb: 0.5
        }}>
          <span style={{ color: '#ff4081' }}>Find</span>
          <span style={{ color: '#8e8e93' }}>con</span>
        </Typography>
        <Typography sx={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          letterSpacing: '0.5px'
        }}>
          find people, connect better
        </Typography>
      </Box>
    );
  }

  // Inline small header variant
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, ...sx }}>
      <Box component="img" src={logoImg} sx={{ width: 28, height: 28, borderRadius: "6px", objectFit: "contain" }} />
      <Box>
        <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 18, lineHeight: 1.1 }}>
          <span style={{ color: '#ff4081' }}>Find</span>
          <span style={{ color: '#8e8e93' }}>con</span>
        </Typography>
        <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
          find people, connect better
        </Typography>
      </Box>
    </Box>
  );
}
