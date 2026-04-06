/**
 * ConnectionStatus
 *
 * Phase 4 upgrade: shows two distinct states as a slide-down banner.
 *
 *  1. Offline  — device has no internet ("You're offline · N queued")
 *  2. Failed   — online but one or more jobs permanently failed
 *               ("Sync error · N items failed to save")
 *
 * The banner auto-hides when the device is online AND there are no
 * permanently-failed jobs.
 */
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import Ionicons from "react-native-vector-icons/Ionicons";

import { VaultColors } from "../styles/DesignSystem";
import { scale, getFontSize, getSpacing } from "../utils/responsive";
import { useSyncStatus } from "../hooks/useSyncStatus";

const BANNER_H = 52;

export default function ConnectionStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const slideAnim = useRef(new Animated.Value(-BANNER_H)).current;
  const { pending, failed, hasFailed, refresh } = useSyncStatus();

  // Track real connectivity via NetInfo.
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsConnected(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  const shouldShow = !isConnected || hasFailed;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue:         shouldShow ? 0 : -BANNER_H,
      duration:        280,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, slideAnim]);

  if (!shouldShow) return null;

  const isOffline     = !isConnected;
  const bgColor       = isOffline ? VaultColors.warning : VaultColors.error;
  const icon          = isOffline ? "cloud-offline-outline" : "alert-circle-outline";
  const headline      = isOffline
    ? "You're offline"
    : `Sync error · ${failed} item${failed !== 1 ? "s" : ""} failed`;
  const subline       = isOffline
    ? pending > 0
      ? `${pending} change${pending !== 1 ? "s" : ""} queued — will sync when back online`
      : "Changes will sync when connection is restored"
    : "Tap to retry syncing your data";

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: bgColor, transform: [{ translateY: slideAnim }] }]}
    >
      <Ionicons name={icon} size={scale(16)} color="#FFF" style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>
      </View>
      {hasFailed && !isOffline && (
        <TouchableOpacity onPress={refresh} style={styles.retryBtn} activeOpacity={0.8}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:        "absolute",
    top:             0,
    left:            0,
    right:           0,
    flexDirection:   "row",
    alignItems:      "center",
    paddingVertical: getSpacing(8),
    paddingHorizontal: getSpacing(14),
    zIndex:          1000,
    minHeight:       BANNER_H,
  },
  icon: {
    marginRight: getSpacing(8),
    flexShrink:  0,
  },
  textWrap: {
    flex: 1,
  },
  headline: {
    color:      "#FFF",
    fontSize:   getFontSize(13),
    fontWeight: "700",
  },
  subline: {
    color:      "rgba(255,255,255,0.88)",
    fontSize:   getFontSize(11),
    fontWeight: "400",
    marginTop:  2,
  },
  retryBtn: {
    marginLeft:      getSpacing(8),
    paddingHorizontal: getSpacing(10),
    paddingVertical:   getSpacing(4),
    borderRadius:    6,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  retryText: {
    color:      "#FFF",
    fontSize:   getFontSize(12),
    fontWeight: "600",
  },
});

