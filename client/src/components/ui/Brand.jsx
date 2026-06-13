import React from "react";
import { Box, Typography } from "@mui/material";
import logoImg from "../../assets/logo.png";

/**
 * Unified Brand Logo and Slogan Component
 * @param {object} props
 * @param {'small' | 'large'} props.variant - Display format
 * @param {object} props.sx - MUI style overrides
 */
export default function Brand({ variant = "small", sx = {} }) {
  if (variant === "large") {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2, ...sx }}>
        <Box component="img" src={logoImg} sx={{ width: 36, height: 36, borderRadius: '8px', mb: 0.8, objectFit: 'contain' }} />
        <Typography sx={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: '20px',
          textAlign: 'center',
          mb: 0.2
        }}>
          <span style={{ color: '#ff4081' }}>Find</span>
          <span style={{ color: '#8e8e93' }}>con</span>
        </Typography>
        <Typography sx={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '11px',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          letterSpacing: '0.3px'
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
