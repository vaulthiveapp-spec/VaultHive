import React from "react";
import OnboardingBase from "./OnboardingBase";

export default function OnboardingOne({ navigation }) {
  return (
    <OnboardingBase
      step={1}
      total={3}
      image={require("../../../assets/on1.png")}
      title="Save receipts in seconds"
      subtitle="Scan or upload receipts, extract details with OCR, and keep everything organized in your vault."
      primaryLabel="Next"
      onPrimary={() => navigation.navigate("OnboardingTwo")}
      onSkip={() => navigation.replace("Welcome")}
    />
  );
}