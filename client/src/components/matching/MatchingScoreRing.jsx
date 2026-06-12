import React from "react";

export default function MatchingScoreRing({ score }) {
  const RING_R = 22;
  const RING_C = 2 * Math.PI * RING_R;
  const scoreStroke = RING_C - (score / 100) * RING_C;

  const strokeColor = score >= 70 
    ? "#4cceac" 
    : score >= 40 
      ? "#ff80ab" 
      : "#ff5252";

  return (
    <div className="m-score-wrap">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={RING_R} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="28"
          cy="28"
          r={RING_R}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.5"
          strokeDasharray={RING_C}
          strokeDashoffset={scoreStroke}
          strokeLinecap="round"
        />
      </svg>
      <span className="m-score-num">{score}%</span>
      <span className="m-score-label">match</span>
    </div>
  );
}
