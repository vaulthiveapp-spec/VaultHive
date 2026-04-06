
import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { scale } from "../../utils/responsive";
import { IcoHandler } from "../../utils/icoHandler";
const DOT_DELAY = 200;

function Dot({ delay }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(DOT_DELAY * 3 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0.3, 1],
                outputRange: [0, -4],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function AITypingIndicator() {
  const [avatarSource, setAvatarSource] = useState(null);

  useEffect(() => {
    const loadIco = async () => {
      try {
        const icoAsset = require("../../../assets/AIicon.ico");
        const icoSource = await IcoHandler.getIcoSource(icoAsset);
        setAvatarSource(icoSource);
      } catch (error) {
        console.warn('Failed to load ICO avatar in typing indicator:', error);
        setAvatarSource(require("../../../assets/icon.png"));
      }
    };
    loadIco();
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
      </View>
      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={DOT_DELAY} />
        <Dot delay={DOT_DELAY * 2} />
      </View>
    </View>
  );
}

export default memo(AITypingIndicator);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: scale(18),
    paddingHorizontal: scale(16),
  },

  avatarWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: "hidden",
    marginRight: scale(8),
  },

  avatar: {
    width: "100%",
    height: "100%",
  },

  bubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0DDB8",
    borderRadius: scale(20),
    borderBottomLeftRadius: scale(6),
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    gap: scale(5),
    minWidth: scale(64),
  },

  dot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
    backgroundColor: "#7A4F1C",
  },
});
