import React from "react";
import { Chip } from "@mui/material";

/**
 * Reusable Interest Chip Component
 * @param {object} props
 * @param {string} props.label - Chip text label
 * @param {object} props.sx - MUI style overrides
 */
export default function InterestChip({ label, sx = {}, ...props }) {
  return (
    <Chip
      label={label}
      size="small"
      {...props}
      sx={{
        background: "rgba(255,64,129,0.1)",
        color: "#ff80ab",
        border: "1px solid rgba(255,64,129,0.22)",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "11.5px",
        fontWeight: 500,
        borderRadius: "20px",
        transition: "background 0.2s",
        "&:hover": {
          background: "rgba(255,64,129,0.2)",
        },
        ...sx
      }}
    />
  );
}
