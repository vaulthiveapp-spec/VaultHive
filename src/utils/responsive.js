import { Dimensions, PixelRatio, Platform } from "react-native";

// Safe dimension access with fallback
const safeDimensions = (() => {
  try {
    const dims = Dimensions.get("window");
    return { width: dims.width || 375, height: dims.height || 667 };
  } catch (e) {
    console.warn("Could not get dimensions, using fallback", e);
    return { width: 375, height: 667 };
  }
})();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = safeDimensions;

const BASE_WIDTH = 375;
const BASE_HEIGHT = 667;

const scaleFactorW = SCREEN_WIDTH / BASE_WIDTH;
const scaleFactorH = SCREEN_HEIGHT / BASE_HEIGHT;

export const scale = (size) => {
  try {
    return PixelRatio.roundToNearestPixel(size * scaleFactorW);
  } catch (e) {
    console.warn("Scale calculation failed, using linear fallback", e);
    return size * scaleFactorW;
  }
};

export const verticalScale = (size) => {
  try {
    return PixelRatio.roundToNearestPixel(size * scaleFactorH);
  } catch (e) {
    console.warn("Vertical scale calculation failed, using linear fallback", e);
    return size * scaleFactorH;
  }
};

export const moderateScale = (size, factor = 0.5) => {
  const s = scale(size);
  return size + (s - size) * factor;
};

export const isTablet = () => {
  const pixelDensity = PixelRatio.get();
  const adjustedWidth = SCREEN_WIDTH * pixelDensity;
  const adjustedHeight = SCREEN_HEIGHT * pixelDensity;
  return adjustedWidth >= 1000 || adjustedHeight >= 1000;
};

export const isSmallDevice = () => SCREEN_HEIGHT < 600;

export const getScreenData = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isTablet: isTablet(),
  isSmallDevice: isSmallDevice(),
});

export const getSafeAreaPadding = () => {
  const isIOS = Platform.OS === "ios";
  if (isIOS) {
    const isIPhoneX = SCREEN_HEIGHT >= 812;
    return { top: isIPhoneX ? 44 : 20, bottom: isIPhoneX ? 34 : 0 };
  }
  return { top: 24, bottom: 0 };
};

export const getFontSize = (size) => {
  if (isTablet()) return moderateScale(size * 1.15);
  if (isSmallDevice()) return moderateScale(size * 0.92);
  return moderateScale(size);
};

export const getSpacing = (size) => {
  if (isTablet()) return scale(size * 1.2);
  if (isSmallDevice()) return scale(size * 0.9);
  return scale(size);
};
