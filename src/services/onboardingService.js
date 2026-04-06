import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY = "vh_onboarding_seen_v1";

export async function hasSeenOnboarding() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setOnboardingSeen() {
  try {
    await AsyncStorage.setItem(KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export async function clearOnboardingSeenForDev() {
  try {
    await AsyncStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}
