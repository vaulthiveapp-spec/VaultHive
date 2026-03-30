import React from "react";
import OnboardingBase from "./OnboardingBase";

export default function OnboardingTwo({ navigation }) {
  return (
    <OnboardingBase
      step={2}
      total={3}
      icon="shield-checkmark-outline"
      title="Track warranties & deadlines"
      subtitle="Link warranties to receipts, and get friendly reminders before returns or warranty expiry."
      primaryLabel="Next"
      onPrimary={() => navigation.navigate("OnboardingThree")}
      onSkip={() => navigation.replace("Welcome")}
    />
  );
}