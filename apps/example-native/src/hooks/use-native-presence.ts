import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex-chat/example-backend/api";
import type { Subject } from "@/lib/subjects";

const HEARTBEAT_INTERVAL = 10_000;
const TYPING_IDLE_TIMEOUT = 1_200;

export function useNativePresence({
  subjectId,
  conversationId,
}: {
  subjectId: Subject;
  conversationId: string;
}) {
  const [instanceId] = useState(() => Crypto.randomUUID());
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const heartbeatOnline = useMutation(api.chat.heartbeatOnline);
  const disconnectOnline = useMutation(api.chat.disconnectOnline);
  const heartbeatPresence = useMutation(api.chat.heartbeatPresence);
  const disconnectPresence = useMutation(api.chat.disconnectPresence);
  const updateTyping = useMutation(api.chat.setTyping);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingAdvertised = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!appActive) return;
    let cancelled = false;
    let sessionToken: string | null = null;

    const beat = async () => {
      try {
        const result = await heartbeatOnline({
          subjectId,
          sessionId: `${instanceId}:online:${subjectId}`,
          interval: HEARTBEAT_INTERVAL,
        });
        if (cancelled) {
          void disconnectOnline({
            subjectId,
            sessionToken: result.sessionToken,
          });
          return;
        }
        sessionToken = result.sessionToken;
      } catch (cause) {
        console.warn("Online presence heartbeat failed", cause);
      }
    };

    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (sessionToken) {
        void disconnectOnline({ subjectId, sessionToken }).catch((cause) =>
          console.warn("Online presence disconnect failed", cause),
        );
      }
    };
  }, [appActive, disconnectOnline, heartbeatOnline, instanceId, subjectId]);

  useEffect(() => {
    setRoomToken(null);
    if (!appActive) return;
    let cancelled = false;
    let sessionToken: string | null = null;

    const beat = async () => {
      try {
        const result = await heartbeatPresence({
          subjectId,
          conversationId,
          sessionId: `${instanceId}:${subjectId}:${conversationId}`,
          interval: HEARTBEAT_INTERVAL,
        });
        if (cancelled) {
          void disconnectPresence({
            subjectId,
            conversationId,
            sessionToken: result.sessionToken,
          });
          return;
        }
        sessionToken = result.sessionToken;
        setRoomToken(result.roomToken);
      } catch (cause) {
        console.warn("Conversation presence heartbeat failed", cause);
      }
    };

    void beat();
    const timer = setInterval(() => void beat(), HEARTBEAT_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (sessionToken) {
        void disconnectPresence({
          subjectId,
          conversationId,
          sessionToken,
        }).catch((cause) =>
          console.warn("Conversation presence disconnect failed", cause),
        );
      }
    };
  }, [
    appActive,
    conversationId,
    disconnectPresence,
    heartbeatPresence,
    instanceId,
    subjectId,
  ]);

  const onlinePresence = useQuery(api.chat.listOnline, {
    subjectId,
    conversationId,
  });
  const typingPresence = useQuery(
    api.chat.listPresence,
    roomToken ? { subjectId, conversationId, roomToken } : "skip",
  );

  const advertiseTyping = useCallback(
    (typing: boolean) => {
      if (!appActive || typingAdvertised.current === typing) return;
      typingAdvertised.current = typing;
      void updateTyping({ subjectId, conversationId, typing }).catch((cause) =>
        console.warn("Typing update failed", cause),
      );
    },
    [appActive, conversationId, subjectId, updateTyping],
  );

  const clearTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    advertiseTyping(false);
  }, [advertiseTyping]);

  const noteTyping = useCallback(() => {
    advertiseTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(clearTyping, TYPING_IDLE_TIMEOUT);
  }, [advertiseTyping, clearTyping]);

  useEffect(() => {
    if (!appActive) clearTyping();
  }, [appActive, clearTyping]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = null;
      if (typingAdvertised.current) {
        typingAdvertised.current = false;
        void updateTyping({ subjectId, conversationId, typing: false });
      }
    },
    [conversationId, subjectId, updateTyping],
  );

  const presence = useMemo(
    () =>
      onlinePresence?.map((entry) => ({
        ...entry,
        typing:
          typingPresence?.some(
            (typingEntry) =>
              typingEntry.subjectId === entry.subjectId &&
              typingEntry.online &&
              typingEntry.typing,
          ) ?? false,
      })),
    [onlinePresence, typingPresence],
  );

  return { appActive, clearTyping, noteTyping, presence };
}
