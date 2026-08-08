import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DemoProvider } from "@/context/demo-context";
import "../src/global.css";

export default function RootLayout() {
  const url = process.env.EXPO_PUBLIC_CONVEX_URL;
  const client = useMemo(
    () => (url ? new ConvexReactClient(url) : null),
    [url],
  );

  if (!client) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.setup}>
          <Text style={styles.eyebrow}>ONE SETUP STEP REMAINS</Text>
          <Text style={styles.title}>Connect the Convex deployment</Text>
          <Text style={styles.copy}>
            Add EXPO_PUBLIC_CONVEX_URL to apps/example-native/.env.local, then
            restart Expo.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <ConvexProvider client={client}>
            <DemoProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false }} />
            </DemoProvider>
          </ConvexProvider>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  setup: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    backgroundColor: "#07111f",
  },
  eyebrow: {
    color: "#67e8f9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  title: { color: "white", fontSize: 30, fontWeight: "800", marginBottom: 14 },
  copy: { color: "#9fb0c4", fontSize: 17, lineHeight: 25 },
});
