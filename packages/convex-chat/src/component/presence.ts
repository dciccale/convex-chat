import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";
import { components } from "./_generated/api.js";
import { mutation, query } from "./_generated/server.js";
import { chatError, requireMembership } from "./model.js";

const presence = new Presence(components.presence);

const presenceState = v.object({
  subjectId: v.string(),
  online: v.boolean(),
  lastDisconnected: v.number(),
  typing: v.boolean(),
});

export const heartbeat = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args);
    if (
      !args.sessionId ||
      args.sessionId.length > 200 ||
      !Number.isSafeInteger(args.interval) ||
      args.interval < 5_000 ||
      args.interval > 60_000
    ) {
      chatError("INVALID_ARGUMENT", "Invalid presence session");
    }
    return presence.heartbeat(
      ctx,
      args.conversationId,
      args.subjectId,
      args.sessionId,
      args.interval,
    );
  },
});

export const list = query({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    roomToken: v.string(),
  },
  returns: v.array(presenceState),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args);
    const entries = await presence.list(ctx, args.roomToken, 100);
    return entries.map((entry) => ({
      subjectId: entry.userId,
      online: entry.online,
      lastDisconnected: entry.lastDisconnected,
      typing: isTyping(entry.data),
    }));
  },
});

export const setTyping = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    typing: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { conversation } = await requireMembership(ctx, {
      ...args,
      write: true,
    });
    if (conversation.state !== "active") {
      chatError("READ_ONLY", "Conversation is not active");
    }
    await presence.updateRoomUser(ctx, args.conversationId, args.subjectId, {
      version: 1,
      typing: args.typing,
    });
    return null;
  },
});

export const disconnect = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    sessionToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMembership(ctx, args);
    await presence.disconnect(ctx, args.sessionToken);
    return null;
  },
});

function isTyping(data: unknown) {
  return (
    typeof data === "object" &&
    data !== null &&
    "version" in data &&
    data.version === 1 &&
    "typing" in data &&
    data.typing === true
  );
}
