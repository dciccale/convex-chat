import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex-chat/example-backend/api";
import { Avatar } from "heroui-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDemo } from "@/context/demo-context";
import { conversationLabel, errorMessage } from "@/lib/chat";
import { capitalize, subjects } from "@/lib/subjects";

export default function InboxScreen() {
  const router = useRouter();
  const { subjectId, setSubjectId } = useDemo();
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ensureDemo = useMutation(api.chat.ensureDemo);
  const conversations = useQuery(api.chat.listConversations, { subjectId });

  useEffect(() => {
    let active = true;
    ensureDemo()
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, [ensureDemo]);

  const loading = booting || conversations === undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>convex-chat</Text>
          <Text style={styles.demoLabel}>Demo identity</Text>
        </View>
        <View style={styles.identityPicker} accessibilityRole="radiogroup">
          {subjects.map((subject) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: subject === subjectId }}
              key={subject}
              onPress={() => {
                setError(null);
                setSubjectId(subject);
              }}
              style={[
                styles.identityButton,
                subject === subjectId && styles.identityButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.identityText,
                  subject === subjectId && styles.identityTextActive,
                ]}
              >
                {capitalize(subject).slice(0, 1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#22d3ee" size="large" />
          <Text style={styles.loadingText}>Connecting to the demo…</Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyCopy}>The shared demo inbox is empty.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(conversation) => conversation.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const label = conversationLabel(item, subjectId);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label}. ${item.lastMessagePreview ?? "No messages yet"}`}
                onPress={() =>
                  router.push({
                    pathname: "/conversation/[id]",
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [
                  styles.conversation,
                  pressed && styles.conversationPressed,
                ]}
              >
                <Avatar size="md" color="accent">
                  <Avatar.Fallback>{label.slice(0, 1)}</Avatar.Fallback>
                </Avatar>
                <View style={styles.conversationCopy}>
                  <View style={styles.conversationTitleRow}>
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={styles.kind}>{item.kind}</Text>
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {item.lastMessagePreview ?? "No messages yet"}
                  </Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.warning}>
        <Text style={styles.warningText}>
          Demo only — production apps derive identity from authentication.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#08111e" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#172235",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { color: "#f8fafc", fontSize: 29, fontWeight: "800" },
  demoLabel: { color: "#718096", fontSize: 12, marginTop: 3 },
  identityPicker: { flexDirection: "row", gap: 7 },
  identityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#172235",
    borderWidth: 1,
    borderColor: "#26354b",
  },
  identityButtonActive: { backgroundColor: "#0891b2", borderColor: "#22d3ee" },
  identityText: { color: "#9fb0c4", fontWeight: "800" },
  identityTextActive: { color: "white" },
  list: { paddingVertical: 8 },
  conversation: {
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  conversationPressed: { backgroundColor: "#101c2d" },
  conversationCopy: { flex: 1, minWidth: 0 },
  conversationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  conversationTitle: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "700",
  },
  kind: { color: "#5f7188", fontSize: 11, textTransform: "uppercase" },
  preview: { color: "#8495aa", fontSize: 15 },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "#06b6d4",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: { color: "#03202a", fontWeight: "900", fontSize: 12 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  loadingText: { color: "#8495aa", marginTop: 14 },
  emptyTitle: { color: "white", fontWeight: "800", fontSize: 20 },
  emptyCopy: { color: "#8495aa", marginTop: 6 },
  errorBanner: {
    backgroundColor: "#3b1520",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  errorText: { color: "#fecdd3", fontSize: 13 },
  warning: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#172235",
  },
  warningText: { color: "#5f7188", fontSize: 11, textAlign: "center" },
});
