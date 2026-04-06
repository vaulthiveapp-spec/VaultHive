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

export default function ReceiptIcon({ size = 220 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
      <Defs>
        <LinearGradient id="ri_bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FEF7E6" />
          <Stop offset="1" stopColor="#EDD89A" />
        </LinearGradient>
        <LinearGradient id="ri_gold" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DFA94D" />
          <Stop offset="1" stopColor="#8A5509" />
        </LinearGradient>
        <LinearGradient id="ri_pill" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#DFA94D" />
          <Stop offset="1" stopColor="#B37A1F" />
        </LinearGradient>
        <LinearGradient id="ri_scan" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#DFA94D" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#DFA94D" stopOpacity="0.5" />
          <Stop offset="1" stopColor="#DFA94D" stopOpacity="0" />
        </LinearGradient>
        <ClipPath id="ri_card_clip">
          <Rect x="54" y="30" width="132" height="178" rx="14" />
        </ClipPath>
        <ClipPath id="ri_hdr_clip">
          <Rect x="54" y="30" width="132" height="46" rx="14" />
        </ClipPath>
      </Defs>

      {/* Background glow circle */}
      <Circle cx="120" cy="118" r="112" fill="url(#ri_bg)" />
      <Circle cx="120" cy="118" r="112" stroke="#F6D586" strokeWidth="1.5" fill="none" />
      <Circle cx="120" cy="118" r="104" stroke="#DFA94D" strokeWidth="0.6" strokeDasharray="6 8" fill="none" strokeOpacity="0.4" />

      {/* Receipt drop-shadow */}
      <Rect x="60" y="38" width="132" height="178" rx="14" fill="#8A5509" fillOpacity="0.12" />

      {/* Receipt card */}
      <Rect x="54" y="30" width="132" height="178" rx="14" fill="white" />
      <Rect x="54" y="30" width="132" height="178" rx="14" stroke="#F6D586" strokeWidth="1.5" fill="none" />

      {/* Gold header */}
      <G clipPath="url(#ri_hdr_clip)">
        <Rect x="54" y="30" width="132" height="46" fill="url(#ri_gold)" />
      </G>
      <Rect x="80" y="43" width="58" height="5.5" rx="2.75" fill="white" fillOpacity="0.92" />
      <Rect x="90" y="54" width="38" height="4" rx="2" fill="white" fillOpacity="0.55" />

      {/* Content rows: label + amount */}
      <Rect x="67" y="89" width="74" height="4.5" rx="2.25" fill="#DFA94D" fillOpacity="0.4" />
      <Rect x="155" y="89" width="22" height="4.5" rx="2.25" fill="#B37A1F" fillOpacity="0.55" />
      <Rect x="67" y="103" width="58" height="4.5" rx="2.25" fill="#DFA94D" fillOpacity="0.3" />
      <Rect x="155" y="103" width="22" height="4.5" rx="2.25" fill="#DFA94D" fillOpacity="0.35" />
      <Rect x="67" y="117" width="68" height="4.5" rx="2.25" fill="#DFA94D" fillOpacity="0.3" />
      <Rect x="155" y="117" width="22" height="4.5" rx="2.25" fill="#DFA94D" fillOpacity="0.3" />

      {/* Dotted divider */}
      <Line x1="62" y1="134" x2="178" y2="134" stroke="#F6D586" strokeWidth="1.2" strokeDasharray="5 4" />

      {/* Total row */}
      <Rect x="67" y="141" width="36" height="5" rx="2.5" fill="#8A5509" fillOpacity="0.4" />
      <Rect x="148" y="138" width="34" height="11" rx="5.5" fill="url(#ri_pill)" />

      {/* Barcode section */}
      <Rect x="67" y="158" width="106" height="32" rx="5" fill="#FEF7E6" stroke="#F6D586" strokeWidth="1" />
      {[
        [71,2],[75,1],[78,3],[83,1],[86,2],[90,1],[93,1],[96,3],[101,1],[104,2],
        [108,1],[111,1],[114,3],[119,1],[122,2],[126,1],[129,3],[134,1],[137,2],
        [141,1],[144,1],[147,3],[152,1],[155,2],[159,1],[162,1],[165,3],[170,1],
      ].map(([x, w], i) => (
        <Rect key={`bc${i}`} x={x} y={162} width={w} height={22} rx="0.5" fill="#5B3B1F" fillOpacity="0.6" />
      ))}

      {/* Scan beam */}
      <G clipPath="url(#ri_card_clip)">
        <Rect x="54" y="126" width="132" height="18" fill="url(#ri_scan)" />
      </G>
      <Line x1="54" y1="135" x2="186" y2="135" stroke="#DFA94D" strokeWidth="1.8" strokeOpacity="0.85" />
      <Circle cx="54" cy="135" r="3" fill="#DFA94D" fillOpacity="0.7" />
      <Circle cx="186" cy="135" r="3" fill="#DFA94D" fillOpacity="0.7" />

      {/* Corner scan markers */}
      <Path d="M54 52 L54 30 L76 30" stroke="#DFA94D" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <Path d="M186 52 L186 30 L164 30" stroke="#DFA94D" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <Path d="M54 186 L54 208 L76 208" stroke="#DFA94D" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <Path d="M186 186 L186 208 L164 208" stroke="#DFA94D" strokeWidth="2.8" strokeLinecap="round" fill="none" />

      {/* Checkmark badge */}
      <Circle cx="179" cy="44" r="18" fill="#F6D586" fillOpacity="0.35" />
      <Circle cx="179" cy="44" r="15" fill="#5B3B1F" />
      <Circle cx="179" cy="44" r="12.5" fill="#B37A1F" />
      <Circle cx="179" cy="44" r="12.5" fill="#DFA94D" fillOpacity="0.3" />
      <Path d="M172.5 44 L177 48.5 L185.5 39.5" stroke="#FEF7E6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

      {/* Decorative sparkles */}
      <Path d="M36 78 L38.5 72 L41 78 L47 80.5 L41 83 L38.5 89 L36 83 L30 80.5 Z" fill="#DFA94D" fillOpacity="0.55" />
      <Path d="M207 68 L209 63 L211 68 L216 70 L211 72 L209 77 L207 72 L202 70 Z" fill="#F6D586" fillOpacity="0.65" />
      <Circle cx="204" cy="180" r="6" fill="#F6D586" fillOpacity="0.55" />
      <Circle cx="213" cy="170" r="4" fill="#DFA94D" fillOpacity="0.45" />
      <Circle cx="208" cy="192" r="3" fill="#B37A1F" fillOpacity="0.35" />
      <Circle cx="34" cy="148" r="3.5" fill="#DFA94D" fillOpacity="0.4" />
      <Circle cx="26" cy="135" r="2" fill="#F6D586" fillOpacity="0.45" />
      <Circle cx="210" cy="100" r="3" fill="#F6D586" fillOpacity="0.5" />
      <Circle cx="218" cy="112" r="2" fill="#DFA94D" fillOpacity="0.35" />
    </Svg>
  );
}