import React from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Pattern,
  G,
  Polygon,
} from "react-native-svg";
import { scale } from "../utils/responsive";
import { VaultColors } from "../styles/DesignSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_WAVE_HEIGHT = scale(130);
const TOP_FLAT_SPACE = 10;
const SVG_BASE_HEIGHT = 140;
const SVG_TOTAL_HEIGHT = SVG_BASE_HEIGHT + TOP_FLAT_SPACE;

const WAVE_PATH_1 = (offset = 0) => `
  M0,${74 + offset}
  C90,${30 + offset} 170,${52 + offset} 235,${76 + offset}
  C305,${102 + offset} 345,${92 + offset} 375,${84 + offset}
  L375,0 L0,0 Z
`;

const WAVE_PATH_2 = (offset = 0) => `
  M0,${92 + offset}
  C95,${58 + offset} 175,${70 + offset} 240,${92 + offset}
  C310,${114 + offset} 348,${106 + offset} 375,${98 + offset}
  L375,0 L0,0 Z
`;

const WaveDefs = ({ prefix }) => (
  <Defs>
    {/* Main gold gradient */}
    <LinearGradient id={`${prefix}GoldGradient`} x1="0%" y1="0%" x2="100%" y2="25%">
      <Stop offset="0%" stopColor="#7A4B00" />
      <Stop offset="16%" stopColor="#B87A12" />
      <Stop offset="32%" stopColor="#F0CD76" />
      <Stop offset="50%" stopColor="#C58A1D" />
      <Stop offset="68%" stopColor="#F3D98E" />
      <Stop offset="84%" stopColor="#8B5604" />
      <Stop offset="100%" stopColor="#C9922A" />
    </LinearGradient>

    {/* Soft shine */}
    <LinearGradient id={`${prefix}GlowGradient`} x1="0%" y1="0%" x2="100%" y2="0%">
      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
      <Stop offset="22%" stopColor="#FFF6D7" stopOpacity="0.08" />
      <Stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.22" />
      <Stop offset="52%" stopColor="#FFF0BF" stopOpacity="0.05" />
      <Stop offset="72%" stopColor="#FFFFFF" stopOpacity="0.14" />
      <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
    </LinearGradient>

    {/* Depth */}
    <LinearGradient id={`${prefix}DepthGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0%" stopColor="#5E3900" stopOpacity="0.22" />
      <Stop offset="45%" stopColor="#D7A13A" stopOpacity="0.38" />
      <Stop offset="100%" stopColor="#7A4B00" stopOpacity="0.26" />
    </LinearGradient>

    {/* Honeycomb pattern */}
    <Pattern
      id={`${prefix}HoneycombPattern`}
      patternUnits="userSpaceOnUse"
      width="42"
      height="36"
    >
      <G opacity="0.24">
        <Polygon
          points="7,0 21,0 28,12 21,24 7,24 0,12"
          fill="#FFF4C8"
          fillOpacity="0.05"
          stroke="#FFF1B3"
          strokeWidth="1"
          strokeOpacity="0.55"
        />
        <Polygon
          points="28,18 42,18 49,30 42,42 28,42 21,30"
          fill="#FFF4C8"
          fillOpacity="0.03"
          stroke="#E7B54B"
          strokeWidth="1"
          strokeOpacity="0.45"
        />
        <Polygon
          points="-14,18 0,18 7,30 0,42 -14,42 -21,30"
          fill="#FFF4C8"
          fillOpacity="0.03"
          stroke="#E7B54B"
          strokeWidth="1"
          strokeOpacity="0.45"
        />
      </G>
    </Pattern>
  </Defs>
);

const WaveLayers = ({ prefix, offset = 0 }) => (
  <>
    <Path
      d={WAVE_PATH_1(offset)}
      fill={`url(#${prefix}GoldGradient)`}
      opacity={0.98}
    />

    <Path
      d={WAVE_PATH_1(offset)}
      fill={`url(#${prefix}HoneycombPattern)`}
      opacity={1}
    />

    <Path
      d={WAVE_PATH_1(offset)}
      fill={`url(#${prefix}GlowGradient)`}
      opacity={0.9}
    />

    <Path
      d={WAVE_PATH_2(offset)}
      fill={`url(#${prefix}DepthGradient)`}
      opacity={0.58}
    />

    <Path
      d={WAVE_PATH_2(offset)}
      fill={`url(#${prefix}HoneycombPattern)`}
      opacity={0.45}
    />
  </>
);

export const TopWave = ({ height = DEFAULT_WAVE_HEIGHT, style }) => {
  const svgHeight = height + scale(TOP_FLAT_SPACE);

  return (
    <View
      style={[styles.topWaveWrap, { height: svgHeight }, style]}
      pointerEvents="none"
    >
      <Svg
        width={SCREEN_WIDTH}
        height={svgHeight}
        viewBox={`0 0 375 ${SVG_TOTAL_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <WaveDefs prefix="topWave" />
        <WaveLayers prefix="topWave" offset={TOP_FLAT_SPACE} />
      </Svg>
    </View>
  );
};

export const BottomWave = ({ height = DEFAULT_WAVE_HEIGHT, absolute = false, style }) => {
  return (
    <View
      style={[
        styles.bottomWaveWrap,
        { height },
        absolute && styles.bottomAbsolute,
        style,
      ]}
      pointerEvents="none"
    >
      <Svg
        width={SCREEN_WIDTH}
        height={height}
        viewBox="0 0 375 140"
        preserveAspectRatio="none"
        style={styles.bottomSvg}
      >
        <WaveDefs prefix="bottomWave" />
        <WaveLayers prefix="bottomWave" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  topWaveWrap: {
    width: "100%",
    backgroundColor: VaultColors.appBackground,
    overflow: "hidden",
  },

  bottomWaveWrap: {
    width: "100%",
    backgroundColor: VaultColors.appBackground,
    overflow: "hidden",
  },

  bottomAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    ...(Platform.OS === "android" ? { elevation: -1 } : null),
  },

  bottomSvg: {
    transform: [{ scaleY: -1 }],
  },
});