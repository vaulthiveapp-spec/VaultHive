import React from "react";
import OnboardingBase from "./OnboardingBase";
import SparklesIcon from "../../components/onboarding/SparklesIcon";

export default function OnboardingThree({ navigation }) {
  return (
    <OnboardingBase
      step={3}
      total={3}
      illustration={SparklesIcon}
      title="Shop smarter in Saudi Arabia"
      subtitle="Use the AI assistant for store suggestions, smarter deals, clean spending summaries, and better habits."
      primaryLabel="Get started"
      onPrimary={() => navigation.replace("Welcome")}
      onSkip={() => navigation.replace("Welcome")}
    />
  );
}