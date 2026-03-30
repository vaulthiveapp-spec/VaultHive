import React from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { scale } from "../utils/responsive";
import { VaultColors } from "../styles/DesignSystem";

const { width: W } = Dimensions.get("window");
const DEFAULT_WAVE_H = scale(130);
const TOP_FLAT_SPACE = 10;
const SVG_BASE_H = 140;
const SVG_TOTAL_H = SVG_BASE_H + TOP_FLAT_SPACE;

export const TopWave = ({ height = DEFAULT_WAVE_H, style }) => {
  return (
    <View
      style={[styles.topWaveWrap, { height: height + scale(TOP_FLAT_SPACE) }, style]}
      pointerEvents="none"
    >
      <Svg
        width={W}
        height={height + scale(TOP_FLAT_SPACE)}
        viewBox={`0 0 375 ${SVG_TOTAL_H}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="topWaveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={VaultColors.waves} />
            <Stop offset="50%" stopColor={VaultColors.brandGoldLight} />
            <Stop offset="100%" stopColor={VaultColors.waves} />
          </LinearGradient>
        </Defs>

        <Path
          d={`M0,${74 + TOP_FLAT_SPACE}
             C90,${30 + TOP_FLAT_SPACE} 170,${52 + TOP_FLAT_SPACE} 235,${76 + TOP_FLAT_SPACE}
             C305,${102 + TOP_FLAT_SPACE} 345,${92 + TOP_FLAT_SPACE} 375,${84 + TOP_FLAT_SPACE}
             L375,0 L0,0 Z`}
          fill="url(#topWaveGradient)"
          opacity={0.95}
        />
        <Path
          d={`M0,${92 + TOP_FLAT_SPACE}
             C95,${58 + TOP_FLAT_SPACE} 175,${70 + TOP_FLAT_SPACE} 240,${92 + TOP_FLAT_SPACE}
             C310,${114 + TOP_FLAT_SPACE} 348,${106 + TOP_FLAT_SPACE} 375,${98 + TOP_FLAT_SPACE}
             L375,0 L0,0 Z`}
          fill={VaultColors.brandGoldLight}
          opacity={0.55}
        />
      </Svg>
    </View>
  );
};

export const BottomWave = ({ height = DEFAULT_WAVE_H, absolute = false, style }) => {
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
        width={W}
        height={height}
        viewBox="0 0 375 140"
        preserveAspectRatio="none"
        style={styles.bottomSvg}
      >
        <Defs>
          <LinearGradient id="bottomWaveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={VaultColors.waves} />
            <Stop offset="50%" stopColor={VaultColors.brandGoldLight} />
            <Stop offset="100%" stopColor={VaultColors.waves} />
          </LinearGradient>
        </Defs>

        <Path
          d="M0,74 C90,30 170,52 235,76 C305,102 345,92 375,84 L375,0 L0,0 Z"
          fill="url(#bottomWaveGradient)"
          opacity={1}
        />
        <Path
          d="M0,92 C95,58 175,70 240,92 C310,114 348,106 375,98 L375,0 L0,0 Z"
          fill={VaultColors.brandGoldLight}
          opacity={0.55}
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