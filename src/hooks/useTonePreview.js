import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { getNotificationTone } from "../constants/notificationTones";

export function useTonePreview() {
  const playerRef = useRef(null);
  const timeoutRef = useRef(null);
  const [previewingToneKey, setPreviewingToneKey] = useState(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearTimer();

    const player = playerRef.current;
    if (player) {
      try {
        player.pause();
      } catch {}

      try {
        player.seekTo(0);
      } catch {}

      try {
        player.release();
      } catch {}
    }

    playerRef.current = null;
    setPreviewingToneKey(null);
  }, [clearTimer]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => {});

    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const previewTone = useCallback(
    async (toneKey) => {
      const tone = getNotificationTone(toneKey);

      if (!tone?.previewAsset) {
        stopPreview();
        return { success: false, reason: "no-preview" };
      }

      if (previewingToneKey === tone.key) {
        stopPreview();
        return { success: true, stopped: true };
      }

      stopPreview();

      try {
        const player = createAudioPlayer(tone.previewAsset);
        playerRef.current = player;
        setPreviewingToneKey(tone.key);

        player.seekTo(0);
        player.play();

        timeoutRef.current = setTimeout(() => {
          stopPreview();
        }, Number(tone.previewMs || 1500));

        return { success: true };
      } catch (error) {
        stopPreview();
        return { success: false, reason: "playback-error", error };
      }
    },
    [previewingToneKey, stopPreview]
  );

  return {
    previewingToneKey,
    previewTone,
    stopPreview,
  };
}

export default useTonePreview;