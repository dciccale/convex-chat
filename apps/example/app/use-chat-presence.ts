"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@convex-chat/example-backend/api";
import type { Subject } from "./subjects";

const HEARTBEAT_INTERVAL = 10_000;
const TYPING_IDLE_TIMEOUT = 1_200;

export function useChatPresence({
  subjectId,
  conversationId,
}: {
  subjectId: Subject;
  conversationId: string | null;
}) {
  const [instanceId] = useState(() => crypto.randomUUID());
  const [roomToken, setRoomToken] = useState<string | null>(null);
  const convex = useConvex();
  const heartbeatOnline = useMutation(api.chat.heartbeatOnline);
  const disconnectOnline = useMutation(api.chat.disconnectOnline);
  const heartbeat = useMutation(api.chat.heartbeatPresence);
  const disconnect = useMutation(api.chat.disconnectPresence);
  const updateTyping = useMutation(api.chat.setTyping);
  const onlineSessionToken = useRef<string | null>(null);
  const onlineHeartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const sessionToken = useRef<string | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingAdvertised = useRef(false);

  const onlinePresence = useQuery(
    api.chat.listOnline,
    conversationId ? { subjectId, conversationId } : "skip",
  );
  const typingPresence = useQuery(
    api.chat.listPresence,
    conversationId && roomToken
      ? { subjectId, conversationId, roomToken }
      : "skip",
  );

  useEffect(() => {
    let canceled = false;

    const stopHeartbeat = () => {
      if (onlineHeartbeatTimer.current) {
        clearInterval(onlineHeartbeatTimer.current);
      }
      onlineHeartbeatTimer.current = null;
    };
    const disconnectCurrent = () => {
      const token = onlineSessionToken.current;
      onlineSessionToken.current = null;
      if (token) {
        void disconnectOnline({ subjectId, sessionToken: token }).catch(
          (cause) => console.warn("Online presence disconnect failed", cause),
        );
      }
    };
    const sendHeartbeat = async () => {
      try {
        const result = await heartbeatOnline({
          subjectId,
          sessionId: `${instanceId}:online:${subjectId}`,
          interval: HEARTBEAT_INTERVAL,
        });
        if (canceled) {
          void disconnectOnline({
            subjectId,
            sessionToken: result.sessionToken,
          }).catch((cause) =>
            console.warn("Online presence disconnect failed", cause),
          );
          return;
        }
        onlineSessionToken.current = result.sessionToken;
      } catch (cause) {
        console.warn("Online presence heartbeat failed", cause);
      }
    };
    const startHeartbeat = () => {
      stopHeartbeat();
      void sendHeartbeat();
      onlineHeartbeatTimer.current = setInterval(
        () => void sendHeartbeat(),
        HEARTBEAT_INTERVAL,
      );
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopHeartbeat();
        disconnectCurrent();
      } else {
        startHeartbeat();
      }
    };
    const handleUnload = () => {
      const token = onlineSessionToken.current;
      if (!token) return;
      const body = new Blob(
        [
          JSON.stringify({
            path: getFunctionName(api.chat.disconnectOnline),
            args: { subjectId, sessionToken: token },
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon(`${convex.url}/api/mutation`, body);
    };

    startHeartbeat();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      canceled = true;
      stopHeartbeat();
      disconnectCurrent();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [convex.url, disconnectOnline, heartbeatOnline, instanceId, subjectId]);

  useEffect(() => {
    if (!conversationId) return;
    let canceled = false;

    const stopHeartbeat = () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
    };
    const disconnectCurrent = () => {
      const token = sessionToken.current;
      sessionToken.current = null;
      if (token) {
        void disconnect({
          subjectId,
          conversationId,
          sessionToken: token,
        }).catch((cause) => console.warn("Presence disconnect failed", cause));
      }
    };
    const sendHeartbeat = async () => {
      try {
        const result = await heartbeat({
          subjectId,
          conversationId,
          sessionId: `${instanceId}:${subjectId}:${conversationId}`,
          interval: HEARTBEAT_INTERVAL,
        });
        if (canceled) {
          void disconnect({
            subjectId,
            conversationId,
            sessionToken: result.sessionToken,
          }).catch((cause) =>
            console.warn("Presence disconnect failed", cause),
          );
          return;
        }
        sessionToken.current = result.sessionToken;
        setRoomToken(result.roomToken);
      } catch (cause) {
        console.warn("Presence heartbeat failed", cause);
      }
    };
    const startHeartbeat = () => {
      stopHeartbeat();
      void sendHeartbeat();
      heartbeatTimer.current = setInterval(
        () => void sendHeartbeat(),
        HEARTBEAT_INTERVAL,
      );
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stopHeartbeat();
        disconnectCurrent();
      } else {
        startHeartbeat();
      }
    };
    const handleUnload = () => {
      const token = sessionToken.current;
      if (!token) return;
      const body = new Blob(
        [
          JSON.stringify({
            path: getFunctionName(api.chat.disconnectPresence),
            args: { subjectId, conversationId, sessionToken: token },
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon(`${convex.url}/api/mutation`, body);
    };

    setRoomToken(null);
    startHeartbeat();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      canceled = true;
      stopHeartbeat();
      disconnectCurrent();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [
    conversationId,
    convex.url,
    disconnect,
    heartbeat,
    instanceId,
    subjectId,
  ]);

  const setTyping = useCallback(
    (typing: boolean) => {
      if (!conversationId || typingAdvertised.current === typing) return;
      typingAdvertised.current = typing;
      void updateTyping({ subjectId, conversationId, typing }).catch((cause) =>
        console.warn("Typing presence update failed", cause),
      );
    },
    [conversationId, subjectId, updateTyping],
  );

  const clearTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    setTyping(false);
  }, [setTyping]);

  const noteTyping = useCallback(() => {
    if (!conversationId) return;
    setTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(clearTyping, TYPING_IDLE_TIMEOUT);
  }, [clearTyping, conversationId, setTyping]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = null;
      if (typingAdvertised.current && conversationId) {
        typingAdvertised.current = false;
        void updateTyping({
          subjectId,
          conversationId,
          typing: false,
        }).catch((cause) =>
          console.warn("Typing presence cleanup failed", cause),
        );
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

  return { presence, noteTyping, clearTyping };
}
