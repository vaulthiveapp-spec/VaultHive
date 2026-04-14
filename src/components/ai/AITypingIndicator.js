import React, { memo, useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { scale } from "../../utils/responsive";
import { IcoHandler } from "../../utils/icoHandler";
import { UI } from "./aiTheme";

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
    let mounted = true;

    const loadIco = async () => {
      try {
        const icoAsset = require("../../../assets/AIicon.ico");
        const icoSource = await IcoHandler.getIcoSource(icoAsset);
        if (mounted) setAvatarSource(icoSource);
      } catch (error) {
        if (mounted) setAvatarSource(require("../../../assets/icon.png"));
      }
    };

    loadIco();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.avatarWrap}>
        <Image source={avatarSource} style={styles.avatar} contentFit="cover" />
      </View>

      <LinearGradient
        colors={UI.assistantGradientColors}
        locations={UI.assistantGradientLocations}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.bubble}
      >
        <Dot delay={0} />
        <Dot delay={DOT_DELAY} />
        <Dot delay={DOT_DELAY * 2} />
      </LinearGradient>
    </View>
  );
}

export default memo(AITypingIndicator);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: scale(18),
    paddingHorizontal: scale(8),
  },

  avatarWrap: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    overflow: "hidden",
    marginHorizontal: scale(4),
    backgroundColor: UI.goldAvatar,
  },

  avatar: {
    width: "100%",
    height: "100%",
  },

  bubble: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: scale(20),
    borderBottomLeftRadius: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: scale(11),
    borderWidth: 1,
    borderColor: UI.goldBorder,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.1,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  dot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
    backgroundColor: UI.brown,
    marginRight: scale(5),
  },
});