import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Dimensions,
  Image,
  View,
  Animated,
  Easing,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { TopWave, BottomWave } from "../components/Waves";
import { VaultColors } from "../styles/DesignSystem";
import { scale, isSmallDevice } from "../utils/responsive";

const { width: W } = Dimensions.get("window");
const BRAND_IMAGE = require("../../assets/splash.png");

const SplashScreen = () => {
  const small = isSmallDevice();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoTranslateY = useRef(new Animated.Value(20)).current;

  const floatAnim = useRef(new Animated.Value(0)).current;
  const topWaveTranslate = useRef(new Animated.Value(-80)).current;
  const bottomWaveTranslate = useRef(new Animated.Value(80)).current;

  // Larger logo size
  const logoW = Math.min(Math.round(W * 0.9), scale(small ? 300 : 420));
  const logoH = Math.round(logoW * 0.72);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 900,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(topWaveTranslate, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bottomWaveTranslate, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 8,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [
    bottomWaveTranslate,
    floatAnim,
    logoOpacity,
    logoScale,
    logoTranslateY,
    topWaveTranslate,
  ]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <Animated.View
        style={[
          styles.topWaveHolder,
          { transform: [{ translateY: topWaveTranslate }] },
        ]}
        pointerEvents="none"
      >
        <TopWave />
      </Animated.View>

      <View style={styles.centerOverlay} pointerEvents="none">
        <Animated.Image
          source={BRAND_IMAGE}
          resizeMode="contain"
          style={{
            width: logoW,
            height: logoH,
            opacity: logoOpacity,
            transform: [
              { translateY: Animated.add(logoTranslateY, floatAnim) },
              { scale: logoScale },
            ],
          }}
        />
      </View>

      <Animated.View
        style={[
          styles.bottomWaveHolder,
          { transform: [{ translateY: bottomWaveTranslate }] },
        ]}
        pointerEvents="none"
      >
        <BottomWave />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VaultColors.appBackground,
    position: "relative",
    overflow: "hidden",
  },
  topWaveHolder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  bottomWaveHolder: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});

export default SplashScreen;