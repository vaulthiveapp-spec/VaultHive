import React from "react";
import Svg, {
  G,
  Path,
  Rect,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
} from "react-native-svg";

export default function SparklesIcon({ size = 220 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
      <Defs>
        <LinearGradient id="ai_bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF7E6" />
          <Stop offset="1" stopColor="#EDD89A" />
        </LinearGradient>
        <LinearGradient id="ai_core" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#6B4522" />
          <Stop offset="1" stopColor="#3A2414" />
        </LinearGradient>
        <LinearGradient id="ai_core_sheen" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#DFA94D" stopOpacity="0.4" />
          <Stop offset="1" stopColor="#DFA94D" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id="ai_bag" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8A5509" />
          <Stop offset="1" stopColor="#5B3B1F" />
        </LinearGradient>
        <LinearGradient id="ai_chip1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF7E6" />
          <Stop offset="1" stopColor="#F6E8C4" />
        </LinearGradient>
        <LinearGradient id="ai_chip2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF7E6" />
          <Stop offset="1" stopColor="#F0DFB0" />
        </LinearGradient>
        <ClipPath id="ai_core_clip">
          <Rect x="82" y="68" width="76" height="76" rx="22" />
        </ClipPath>
      </Defs>

      {/* Background glow circle */}
      <Circle cx="120" cy="120" r="112" fill="url(#ai_bg)" />
      <Circle cx="120" cy="120" r="112" stroke="#F6D586" strokeWidth="1.5" fill="none" />
      <Circle cx="120" cy="120" r="104" stroke="#DFA94D" strokeWidth="0.6" strokeDasharray="6 8" fill="none" strokeOpacity="0.4" />

      {/* ── Radial connection lines from AI core to store chips ── */}
      {/* To store chip 1 (top-right) */}
      <Line x1="155" y1="98" x2="174" y2="82" stroke="#DFA94D" strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4 4" />
      {/* To store chip 2 (right) */}
      <Line x1="158" y1="113" x2="178" y2="120" stroke="#DFA94D" strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4 4" />
      {/* To shopping bag (bottom-left) */}
      <Line x1="90" y1="140" x2="74" y2="165" stroke="#DFA94D" strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4 4" />
      {/* To map pin (bottom-right) */}
      <Line x1="148" y1="140" x2="170" y2="174" stroke="#DFA94D" strokeWidth="1.2" strokeOpacity="0.35" strokeDasharray="4 4" />

      {/* Connection dots on lines */}
      <Circle cx="163" cy="87" r="3" fill="#DFA94D" fillOpacity="0.5" />
      <Circle cx="168" cy="116" r="3" fill="#DFA94D" fillOpacity="0.5" />
      <Circle cx="82" cy="155" r="3" fill="#DFA94D" fillOpacity="0.5" />
      <Circle cx="160" cy="160" r="3" fill="#DFA94D" fillOpacity="0.5" />

      {/* ── AI Core rounded square ── */}
      {/* Shadow */}
      <Rect x="86" y="74" width="76" height="76" rx="22" fill="#5B3B1F" fillOpacity="0.2" />
      {/* Body */}
      <Rect x="82" y="68" width="76" height="76" rx="22" fill="url(#ai_core)" />
      {/* Sheen */}
      <G clipPath="url(#ai_core_clip)">
        <Rect x="82" y="68" width="76" height="76" fill="url(#ai_core_sheen)" />
      </G>
      {/* Gold border */}
      <Rect x="82" y="68" width="76" height="76" rx="22" stroke="#DFA94D" strokeWidth="2" fill="none" />

      {/* ── Central star / sparkle inside AI core ── */}
      {/* 4-point star centered at 120,106 */}
      <Path
        d="M120 88 L124 102 L138 106 L124 110 L120 124 L116 110 L102 106 L116 102 Z"
        fill="#DFA94D"
      />
      {/* Inner smaller star highlight */}
      <Path
        d="M120 96 L122.5 103.5 L130 106 L122.5 108.5 L120 116 L117.5 108.5 L110 106 L117.5 103.5 Z"
        fill="#F6D586"
      />
      {/* Center dot */}
      <Circle cx="120" cy="106" r="4" fill="#FEF7E6" />

      {/* ── Small circuit-dot accents on AI core corners ── */}
      <Circle cx="90" cy="76" r="3" fill="#DFA94D" fillOpacity="0.6" />
      <Circle cx="150" cy="76" r="3" fill="#DFA94D" fillOpacity="0.6" />
      <Circle cx="90" cy="136" r="3" fill="#DFA94D" fillOpacity="0.6" />
      <Circle cx="150" cy="136" r="3" fill="#DFA94D" fillOpacity="0.6" />

      {/* ── Store chip 1 (top-right) ── */}
      <Rect x="168" y="68" width="58" height="30" rx="10" fill="url(#ai_chip1)" />
      <Rect x="168" y="68" width="58" height="30" rx="10" stroke="#DFA94D" strokeWidth="1.5" fill="none" />
      {/* Store icon dot */}
      <Circle cx="181" cy="83" r="6" fill="#B37A1F" fillOpacity="0.2" />
      <Circle cx="181" cy="83" r="4" fill="#B37A1F" fillOpacity="0.6" />
      {/* Store name lines */}
      <Rect x="191" y="78" width="28" height="4" rx="2" fill="#8A5509" fillOpacity="0.4" />
      <Rect x="191" y="86" width="20" height="3.5" rx="1.75" fill="#DFA94D" fillOpacity="0.5" />

      {/* ── Store chip 2 (right, lower) ── */}
      <Rect x="172" y="110" width="58" height="30" rx="10" fill="url(#ai_chip2)" />
      <Rect x="172" y="110" width="58" height="30" rx="10" stroke="#DFA94D" strokeWidth="1.5" fill="none" />
      <Circle cx="185" cy="125" r="6" fill="#DFA94D" fillOpacity="0.2" />
      <Circle cx="185" cy="125" r="4" fill="#DFA94D" fillOpacity="0.55" />
      <Rect x="195" y="120" width="28" height="4" rx="2" fill="#8A5509" fillOpacity="0.4" />
      <Rect x="195" y="128" width="20" height="3.5" rx="1.75" fill="#DFA94D" fillOpacity="0.5" />

      {/* ── Shopping bag (bottom-left) ── */}
      {/* Handle */}
      <Path
        d="M58 164 C58 150 66 145 74 145 C82 145 90 150 90 164"
        stroke="#B37A1F"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Bag body shadow */}
      <Rect x="53" y="164" width="46" height="42" rx="9" fill="#8A5509" fillOpacity="0.15" transform="translate(3 3)" />
      {/* Bag body */}
      <Rect x="53" y="164" width="46" height="42" rx="9" fill="url(#ai_bag)" />
      <Rect x="53" y="164" width="46" height="42" rx="9" stroke="#DFA94D" strokeWidth="1.5" fill="none" />
      {/* Bag label / logo star */}
      <Path d="M76 177 L78 183 L84 185 L78 187 L76 193 L74 187 L68 185 L74 183 Z" fill="#DFA94D" fillOpacity="0.8" />
      <Circle cx="76" cy="185" r="2.5" fill="#F6D586" />

      {/* ── Map pin (bottom-right) ── */}
      {/* Pin head */}
      <Circle cx="174" cy="180" r="15" fill="#5B3B1F" />
      <Circle cx="174" cy="180" r="15" stroke="#DFA94D" strokeWidth="2" fill="none" />
      <Circle cx="174" cy="180" r="10" fill="#B37A1F" />
      <Circle cx="174" cy="180" r="6" fill="#DFA94D" />
      <Circle cx="174" cy="180" r="3" fill="#FEF7E6" />
      {/* Pin tail */}
      <Path d="M174 195 L168 208 L174 204 L180 208 Z" fill="#5B3B1F" />

      {/* ── Decorative sparkles / stars ── */}
      {/* Large 4-point star top area */}
      <Path
        d="M120 26 L123 36 L133 38 L123 41 L120 51 L117 41 L107 38 L117 36 Z"
        fill="#DFA94D"
        fillOpacity="0.6"
      />
      {/* Small sparkle top-left */}
      <Path
        d="M38 72 L40.5 66 L43 72 L49 74.5 L43 77 L40.5 83 L38 77 L32 74.5 Z"
        fill="#DFA94D"
        fillOpacity="0.5"
      />
      {/* Small 4-point bottom area */}
      <Path
        d="M36 188 L38 183 L40 188 L45 190 L40 192 L38 197 L36 192 L31 190 Z"
        fill="#F6D586"
        fillOpacity="0.55"
      />
      {/* Dot cluster top-right */}
      <Circle cx="208" cy="54" r="5.5" fill="#F6D586" fillOpacity="0.55" />
      <Circle cx="218" cy="64" r="3.5" fill="#DFA94D" fillOpacity="0.45" />
      <Circle cx="210" cy="68" r="2.5" fill="#B37A1F" fillOpacity="0.35" />
      {/* Scattered dots */}
      <Circle cx="30" cy="112" r="3.5" fill="#DFA94D" fillOpacity="0.4" />
      <Circle cx="22" cy="128" r="2" fill="#F6D586" fillOpacity="0.45" />
      <Circle cx="212" cy="188" r="3" fill="#F6D586" fillOpacity="0.5" />
      <Circle cx="220" cy="176" r="2" fill="#DFA94D" fillOpacity="0.35" />
    </Svg>
  );
}