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

export default function ShieldIcon({ size = 220 }) {
  // Calendar grid helpers
  const COLS = [80, 96, 112, 128, 144];   // 5 columns
  const ROWS = [120, 136, 152, 168];      // 4 rows

  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
      <Defs>
        <LinearGradient id="si_bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF7E6" />
          <Stop offset="1" stopColor="#EDD89A" />
        </LinearGradient>
        <LinearGradient id="si_shield" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6B4522" />
          <Stop offset="1" stopColor="#3A2414" />
        </LinearGradient>
        <LinearGradient id="si_shield_sheen" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#DFA94D" stopOpacity="0.18" />
          <Stop offset="0.5" stopColor="#DFA94D" stopOpacity="0.38" />
          <Stop offset="1" stopColor="#DFA94D" stopOpacity="0.05" />
        </LinearGradient>
        <LinearGradient id="si_cal_hdr" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DFA94D" />
          <Stop offset="1" stopColor="#B37A1F" />
        </LinearGradient>
        <LinearGradient id="si_check_bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DFA94D" />
          <Stop offset="1" stopColor="#8A5509" />
        </LinearGradient>
        <ClipPath id="si_cal_clip">
          <Rect x="72" y="70" width="96" height="116" rx="10" />
        </ClipPath>
      </Defs>

      {/* Background glow circle */}
      <Circle cx="120" cy="120" r="112" fill="url(#si_bg)" />
      <Circle cx="120" cy="120" r="112" stroke="#F6D586" strokeWidth="1.5" fill="none" />
      <Circle cx="120" cy="120" r="104" stroke="#DFA94D" strokeWidth="0.6" strokeDasharray="6 8" fill="none" strokeOpacity="0.4" />

      {/* Shield drop-shadow */}
      <Path
        d="M120 32 L186 60 L186 118 Q186 172 120 208 Q54 172 54 118 L54 60 Z"
        fill="#5B3B1F"
        fillOpacity="0.15"
        transform="translate(5 5)"
      />

      {/* Shield body */}
      <Path
        d="M120 28 L186 56 L186 114 Q186 168 120 204 Q54 168 54 114 L54 56 Z"
        fill="url(#si_shield)"
      />

      {/* Shield sheen (light sweep) */}
      <Path
        d="M120 28 L186 56 L186 114 Q186 168 120 204 Q54 168 54 114 L54 56 Z"
        fill="url(#si_shield_sheen)"
      />

      {/* Shield gold border */}
      <Path
        d="M120 28 L186 56 L186 114 Q186 168 120 204 Q54 168 54 114 L54 56 Z"
        stroke="#DFA94D"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Inner shield accent line */}
      <Path
        d="M120 36 L180 62 L180 116 Q180 165 120 198 Q60 165 60 116 L60 62 Z"
        stroke="#DFA94D"
        strokeWidth="0.8"
        strokeOpacity="0.25"
        fill="none"
      />

      {/* Calendar card */}
      <Rect x="72" y="70" width="96" height="116" rx="10" fill="white" />
      <Rect x="72" y="70" width="96" height="116" rx="10" stroke="#F6D586" strokeWidth="1" fill="none" />

      {/* Calendar header */}
      <G clipPath="url(#si_cal_clip)">
        <Rect x="72" y="70" width="96" height="32" fill="url(#si_cal_hdr)" />
      </G>
      {/* Month label placeholder */}
      <Rect x="92" y="79" width="46" height="5.5" rx="2.75" fill="white" fillOpacity="0.92" />
      {/* Nav arrows placeholders */}
      <Rect x="76" y="80" width="8" height="4" rx="2" fill="white" fillOpacity="0.5" />
      <Rect x="156" y="80" width="8" height="4" rx="2" fill="white" fillOpacity="0.5" />

      {/* Day-of-week header row */}
      {COLS.map((x, i) => (
        <Rect key={`dw${i}`} x={x - 5} y={108} width={10} height={3.5} rx={1.75} fill="#DFA94D" fillOpacity={0.35} />
      ))}

      {/* Calendar day cells */}
      {COLS.map((cx, col) =>
        ROWS.map((cy, row) => {
          const isDeadline = col === 3 && row === 1; // highlighted red deadline
          const isToday    = col === 1 && row === 0; // today in gold
          const isEmpty    = col === 0 && row === 3; // skip last-row Monday

          if (isEmpty) return null;

          const bg = isDeadline
            ? "#D64545"
            : isToday
            ? "#B37A1F"
            : "transparent";

          const dotColor = isDeadline || isToday ? "#F6D586" : "#DFA94D";

          return (
            <G key={`cell${col}${row}`}>
              {(isDeadline || isToday) && (
                <Circle cx={cx} cy={cy} r={8} fill={bg} />
              )}
              <Circle
                cx={cx}
                cy={cy}
                r={3}
                fill={dotColor}
                fillOpacity={isDeadline || isToday ? 1 : 0.45}
              />
            </G>
          );
        })
      )}

      {/* Deadline day exclamation dot */}
      <Circle cx="128" cy="136" r="2.5" fill="white" />

      {/* ── Bell notification bubble (top-right) ── */}
      <Circle cx="194" cy="54" r="22" fill="#FEF7E6" fillOpacity="0.95" />
      <Circle cx="194" cy="54" r="22" stroke="#F6D586" strokeWidth="1.5" fill="none" />
      {/* Bell body */}
      <Path
        d="M194 43 C189 43 185 47 185 52 L185 59 L182 62 L206 62 L203 59 L203 52 C203 47 199 43 194 43 Z"
        fill="#B37A1F"
      />
      {/* Bell bottom clip arc */}
      <Path d="M189 62 Q189 67 194 67 Q199 67 199 62" fill="#8A5509" />
      {/* Bell top knob */}
      <Circle cx="194" cy="43" r="2.5" fill="#8A5509" />
      {/* Notification red dot */}
      <Circle cx="203" cy="43" r="5.5" fill="#D64545" />
      <Circle cx="203" cy="43" r="3.5" fill="#FF7A7A" />

      {/* ── Clock bubble (bottom-left) ── */}
      <Circle cx="48" cy="170" r="20" fill="#FEF7E6" fillOpacity="0.95" />
      <Circle cx="48" cy="170" r="20" stroke="#F6D586" strokeWidth="1.5" fill="none" />
      <Circle cx="48" cy="170" r="12" stroke="#DFA94D" strokeWidth="2" fill="none" />
      {/* Clock tick marks */}
      <Line x1="48" y1="160" x2="48" y2="158" stroke="#DFA94D" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="48" y1="180" x2="48" y2="182" stroke="#DFA94D" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="38" y1="170" x2="36" y2="170" stroke="#DFA94D" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="58" y1="170" x2="60" y2="170" stroke="#DFA94D" strokeWidth="1.5" strokeLinecap="round" />
      {/* Clock hands */}
      <Line x1="48" y1="170" x2="48" y2="163" stroke="#8A5509" strokeWidth="2" strokeLinecap="round" />
      <Line x1="48" y1="170" x2="54" y2="173" stroke="#B37A1F" strokeWidth="2" strokeLinecap="round" />
      {/* Center dot */}
      <Circle cx="48" cy="170" r="2" fill="#5B3B1F" />

      {/* ── Checkmark badge at shield bottom tip ── */}
      <Circle cx="120" cy="204" r="18" fill="#F6D586" fillOpacity="0.4" />
      <Circle cx="120" cy="204" r="15" fill="#5B3B1F" />
      <Circle cx="120" cy="204" r="12.5" fill="url(#si_check_bg)" />
      <Path
        d="M113 204 L118 209 L127 197"
        stroke="#FEF7E6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── Decorative sparkles ── */}
      <Path d="M32 82 L34.5 76 L37 82 L43 84.5 L37 87 L34.5 93 L32 87 L26 84.5 Z" fill="#DFA94D" fillOpacity="0.5" />
      <Path d="M210 146 L212 141 L214 146 L219 148 L214 150 L212 155 L210 150 L205 148 Z" fill="#F6D586" fillOpacity="0.6" />
      <Circle cx="36" cy="128" r="4" fill="#DFA94D" fillOpacity="0.35" />
      <Circle cx="28" cy="140" r="2.5" fill="#F6D586" fillOpacity="0.4" />
      <Circle cx="214" cy="86" r="3.5" fill="#F6D586" fillOpacity="0.5" />
      <Circle cx="220" cy="100" r="2" fill="#DFA94D" fillOpacity="0.35" />
    </Svg>
  );
}