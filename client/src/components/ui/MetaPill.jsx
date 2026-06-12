import React from "react";

/**
 * Reusable Meta Pill Component
 * @param {object} props
 * @param {'default' | 'accent' | 'green'} props.variant - Visual variant style
 * @param {*} props.children - Pill content
 * @param {string} props.className - Custom CSS classes
 * @param {object} props.style - Custom style overrides
 */
export default function MetaPill({ variant = "default", children, className = "", style = {} }) {
  const baseStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    borderRadius: "20px",
    padding: "3px 9px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "11px",
    fontWeight: 500,
    borderStyle: "solid",
    borderWidth: "1px",
    whiteSpace: "nowrap",
  };

  let customStyle = {};
  if (variant === "accent") {
    customStyle = {
      background: "rgba(255,64,129,0.1)",
      borderColor: "rgba(255,64,129,0.25)",
      color: "#ff80ab",
    };
  } else if (variant === "green") {
    customStyle = {
      background: "rgba(76,206,172,0.1)",
      borderColor: "rgba(76,206,172,0.25)",
      color: "#4cceac",
    };
  } else {
    customStyle = {
      background: "rgba(255,255,255,0.05)",
      borderColor: "rgba(255,255,255,0.09)",
      color: "rgba(255,255,255,0.5)",
    };
  }

  return (
    <span style={{ ...baseStyle, ...customStyle, ...style }} className={className}>
      {children}
    </span>
  );
}
