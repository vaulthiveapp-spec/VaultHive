import React from "react";
import OnboardingBase from "./OnboardingBase";

export default function OnboardingThree({ navigation }) {
  return (
    <OnboardingBase
      step={3}
      total={3}
      icon="sparkles-outline"
      title="Shop smarter in Saudi Arabia"
      subtitle="Use the AI assistant for store suggestions, better deals, clean summaries, and smarter spending habits."
      primaryLabel="Get started"
      onPrimary={() => navigation.replace("Welcome")}
      onSkip={() => navigation.replace("Welcome")}
    />
  );
}