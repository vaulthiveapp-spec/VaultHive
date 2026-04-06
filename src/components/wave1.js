import React from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
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

const Highlight_PATH = (offset = 0) => `
  M0,${56 + offset}
  C95,${18 + offset} 180,${36 + offset} 250,${60 + offset}
  C315,${82 + offset} 350,${74 + offset} 375,${66 + offset}
  L375,0 L0,0 Z
`;

const WaveDefs = ({ prefix }) => (
  <Defs>
    <LinearGradient
      id={`${prefix}MainGradient`}
      x1="0%"
      y1="0%"
      x2="100%"
      y2="30%"
    >
      <Stop offset="0%" stopColor={VaultColors.waves} />
      <Stop offset="18%" stopColor={VaultColors.brandGoldLight} />
      <Stop offset="38%" stopColor={VaultColors.waves} />
      <Stop offset="62%" stopColor={VaultColors.brandGoldLight} />
      <Stop offset="82%" stopColor={VaultColors.waves} />
      <Stop offset="100%" stopColor={VaultColors.brandGoldLight} />
    </LinearGradient>

    <LinearGradient
      id={`${prefix}SoftOverlay`}
      x1="0%"
      y1="0%"
      x2="100%"
      y2="100%"
    >
      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
      <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.12" />
      <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
    </LinearGradient>

    <LinearGradient
      id={`${prefix}DepthGradient`}
      x1="0%"
      y1="0%"
      x2="100%"
      y2="0%"
    >
      <Stop offset="0%" stopColor={VaultColors.brandGoldLight} stopOpacity="0.18" />
      <Stop offset="50%" stopColor={VaultColors.brandGoldLight} stopOpacity="0.58" />
      <Stop offset="100%" stopColor={VaultColors.waves} stopOpacity="0.22" />
    </LinearGradient>
  </Defs>
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

        <Path
          d={WAVE_PATH_1(TOP_FLAT_SPACE)}
          fill="url(#topWaveMainGradient)"
          opacity={0.98}
        />

        <Path
          d={Highlight_PATH(TOP_FLAT_SPACE)}
          fill="url(#topWaveSoftOverlay)"
          opacity={0.9}
        />

        <Path
          d={WAVE_PATH_2(TOP_FLAT_SPACE)}
          fill="url(#topWaveDepthGradient)"
          opacity={0.7}
        />
      </Svg>
    </View>
  );
};

export const BottomWave = ({
  height = DEFAULT_WAVE_HEIGHT,
  absolute = false,
  style,
}) => {
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

        <Path
          d={WAVE_PATH_1()}
          fill="url(#bottomWaveMainGradient)"
          opacity={1}
        />

        <Path
          d={Highlight_PATH()}
          fill="url(#bottomWaveSoftOverlay)"
          opacity={0.85}
        />

        <Path
          d={WAVE_PATH_2()}
          fill="url(#bottomWaveDepthGradient)"
          opacity={0.7}
        />
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