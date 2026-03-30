import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../context/AuthContext";
import DrawerContent from "./DrawerContent";
import TabBar from "./TabBar";
import SplashScreen from "../screens/SplashScreen";

// ─── Guest / onboarding ────────────────────────────────────────────────────────
import OnboardingOne from "../screens/onboarding/OnboardingOne";
import OnboardingTwo from "../screens/onboarding/OnboardingTwo";
import OnboardingThree from "../screens/onboarding/OnboardingThree";
import WelcomeScreen from "../screens/onboarding/WelcomeScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import CreateAccountScreen from "../screens/auth/CreateAccountScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";

// ─── Tab screens ───────────────────────────────────────────────────────────────
import HomeScreen from "../screens/app/HomeScreen";
import VaultScreen from "../screens/app/VaultScreen";
import AddScreen from "../screens/app/AddScreen";
import AIAssistantScreen from "../screens/app/AIAssistantScreen";
import ProfileScreen from "../screens/app/ProfileScreen";

// ─── Drawer screens ────────────────────────────────────────────────────────────
import AttentionCenterScreen from "../screens/app/AttentionCenterScreen";
import StoresScreen from "../screens/app/StoresScreen";
import ReportsScreen from "../screens/app/ReportsScreen";
import SettingsScreen from "../screens/app/SettingsScreen";

// ─── Push / detail screens (accessible from anywhere via root Stack) ───────────
import AddItemScreen from "../screens/app/AddItemScreen";
import AddReceiptScreen from "../screens/app/AddReceiptScreen";
import ReceiptDetailsScreen from "../screens/app/ReceiptDetailsScreen";
import AddWarrantyScreen from "../screens/app/AddWarrantyScreen";
import WarrantyDetailsScreen from "../screens/app/WarrantyDetailsScreen";
import RemindersScreen from "../screens/app/RemindersScreen";
import StoreDetailsScreen from "../screens/app/StoreDetailsScreen";
import AddReviewScreen from "../screens/app/AddReviewScreen";
import HubDetailScreen from "../screens/app/HubDetailScreen";
import AddReminderScreen from "../screens/app/AddReminderScreen";
import EditProfileScreen from "../screens/app/EditProfileScreen";

// ─── Navigators ────────────────────────────────────────────────────────────────
const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

const noHeader = { headerShown: false };

// ─── Guest stack (unauthenticated) ─────────────────────────────────────────────
function GuestStack() {
  return (
    <Stack.Navigator screenOptions={noHeader} initialRouteName="OnboardingOne">
      <Stack.Screen name="OnboardingOne"   component={OnboardingOne}       />
      <Stack.Screen name="OnboardingTwo"   component={OnboardingTwo}       />
      <Stack.Screen name="OnboardingThree" component={OnboardingThree}     />
      <Stack.Screen name="Welcome"         component={WelcomeScreen}       />
      <Stack.Screen name="Login"           component={LoginScreen}         />
      <Stack.Screen name="Register"        component={CreateAccountScreen} />
      <Stack.Screen name="ForgotPassword"  component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}

// ─── Bottom Tabs (lives inside Drawer as "MainTabs") ───────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={noHeader}
      initialRouteName="Home"
    >
      <Tab.Screen name="Home"        component={HomeScreen}        />
      <Tab.Screen name="Vault"       component={VaultScreen}       />
      <Tab.Screen name="Add"         component={AddScreen}         />
      <Tab.Screen name="AIAssistant" component={AIAssistantScreen} />
      <Tab.Screen name="Profile"     component={ProfileScreen}     />
    </Tab.Navigator>
  );
}

// ─── Drawer Navigator (authenticated root surface) ─────────────────────────────
function AuthenticatedDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: "transparent", width: "84%" },
        overlayColor: "rgba(18,12,4,0.22)",
        swipeEnabled: true,
        swipeMinDistance: 10,
      }}
      initialRouteName="MainTabs"
    >
      <Drawer.Screen name="MainTabs"        component={MainTabs}              />
      <Drawer.Screen name="AttentionCenter" component={AttentionCenterScreen} />
      <Drawer.Screen name="Stores"          component={StoresScreen}          />
      <Drawer.Screen name="Reports"         component={ReportsScreen}         />
      <Drawer.Screen name="Settings"        component={SettingsScreen}        />
    </Drawer.Navigator>
  );
}

// ─── App Stack (authenticated) ─────────────────────────────────────────────────
// DrawerRoot is the default screen. All push/detail screens live here so that
// navigation.navigate("AddReceipt") etc. resolves from any nested screen
// without needing qualified path syntax.
function AppStack() {
  return (
    <Stack.Navigator screenOptions={noHeader}>
      <Stack.Screen name="DrawerRoot"      component={AuthenticatedDrawer}   />
      <Stack.Screen name="AddItem"         component={AddItemScreen}         />
      <Stack.Screen name="AddReceipt"      component={AddReceiptScreen}      />
      <Stack.Screen name="ReceiptDetails"  component={ReceiptDetailsScreen}  />
      <Stack.Screen name="AddWarranty"     component={AddWarrantyScreen}     />
      <Stack.Screen name="WarrantyDetails" component={WarrantyDetailsScreen} />
      <Stack.Screen name="Reminders"       component={RemindersScreen}       />
      <Stack.Screen name="StoreDetails"    component={StoreDetailsScreen}    />
      <Stack.Screen name="AddReview"       component={AddReviewScreen}       />
      <Stack.Screen name="HubDetail"       component={HubDetailScreen}       />
      <Stack.Screen name="AddReminder"     component={AddReminderScreen}     />
      <Stack.Screen name="EditProfile"     component={EditProfileScreen}     />
    </Stack.Navigator>
  );
}

// ─── Root navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, bootLoading } = useAuth();

  if (bootLoading) return <SplashScreen />;

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <GuestStack />}
    </NavigationContainer>
  );
}
