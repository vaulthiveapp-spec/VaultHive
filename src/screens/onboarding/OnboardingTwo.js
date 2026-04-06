import React from "react";
import OnboardingBase from "./OnboardingBase";
import ShieldIcon from "../../components/onboarding/ShieldIcon";

export default function OnboardingTwo({ navigation }) {
  return (
    <OnboardingBase
      step={2}
      total={3}
      illustration={ShieldIcon}
      title="Track warranties & deadlines"
      subtitle="Link warranties to receipts and get smart reminders before return windows close or coverage expires."
      primaryLabel="Next"
      onPrimary={() => navigation.navigate("OnboardingThree")}
      onSkip={() => navigation.replace("Welcome")}
    />
  );
}