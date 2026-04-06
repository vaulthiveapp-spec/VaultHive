import React from "react";
import OnboardingBase from "./OnboardingBase";
import ReceiptIcon from "../../components/onboarding/ReceiptIcon";

export default function OnboardingOne({ navigation }) {
  return (
    <OnboardingBase
      step={1}
      total={3}
      illustration={ReceiptIcon}
      title="Save receipts in seconds"
      subtitle="Scan or upload receipts, extract details automatically with OCR, and keep everything organized in your vault."
      primaryLabel="Next"
      onPrimary={() => navigation.navigate("OnboardingTwo")}
      onSkip={() => navigation.replace("Welcome")}
    />
  );
}