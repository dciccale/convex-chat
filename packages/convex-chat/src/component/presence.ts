import { Presence } from "@convex-dev/presence";
import { v } from "convex/values";
import { components } from "./_generated/api.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { mutation, query } from "./_generated/server.js";
import { validateIdentifier } from "./limits.js";
import { chatError, requireMembership } from "./model.js";

const presence = new Presence(components.presence);

const presenceState = v.object({
  subjectId: v.string(),
  online: v.boolean(),
  lastDisconnected: v.number(),
  typing: v.boolean(),
});

const onlineState = v.object({
  subjectId: v.string(),
  online: v.boolean(),
  lastDisconnected: v.optional(v.number()),
});

export const heartbeatOnline = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: v.object({ sessionToken: v.string() }),
  handler: async (ctx, args) => {
    await requireScopeParticipant(ctx, args);
    validateSession(args.sessionId, args.interval);
    const ids = onlinePresenceIds(args.scopeId, args.subjectId);
    const result = await presence.heartbeat(
      ctx,
      ids.roomId,
      ids.userId,
      args.sessionId,
      args.interval,
    );
    return { sessionToken: result.sessionToken };
  },
});

export const listOnline = query({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
  },
  returns: v.array(onlineState),
  handler: async (ctx, args) => {
    const { conversationId } = await requireMembership(ctx, args);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("conversation_state_role", (q) =>
        q.eq("conversationId", conversationId).eq("state", "active"),
      )
      .collect();
    return Promise.all(
      memberships
        .filter((membership) => membership.access !== "none")
        .map(async (membership) => {
          const ids = onlinePresenceIds(args.scopeId, membership.subjectId);
          const rooms = await presence.listUser(ctx, ids.userId, false, 10);
          const state = rooms.find((entry) => entry.roomId === ids.roomId);
          return {
            subjectId: membership.subjectId,
            online: state?.online ?? false,
            lastDisconnected: state?.lastDisconnected,
          };
        }),
    );
  },
});

export const disconnectOnline = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    sessionToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireScopeParticipant(ctx, args);
    await presence.disconnect(ctx, args.sessionToken);
    return null;
  },
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
    validateSession(args.sessionId, args.interval);
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
      typing: entry.online && isTyping(entry.data),
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

function validateSession(sessionId: string, interval: number) {
  if (
    !sessionId ||
    sessionId.length > 200 ||
    !Number.isSafeInteger(interval) ||
    interval < 5_000 ||
    interval > 60_000
  ) {
    chatError("INVALID_ARGUMENT", "Invalid presence session");
  }
}

async function requireScopeParticipant(
  ctx: QueryCtx | MutationCtx,
  args: { scopeId: string; subjectId: string },
) {
  validateIdentifier(args.scopeId, "scopeId");
  validateIdentifier(args.subjectId, "subjectId");
  const memberships = await Promise.all(
    (["read_write", "read_only"] as const).map((access) =>
      ctx.db
        .query("memberships")
        .withIndex("scope_subject_state_access", (q) =>
          q
            .eq("scopeId", args.scopeId)
            .eq("subjectId", args.subjectId)
            .eq("state", "active")
            .eq("access", access),
        )
        .first(),
    ),
  );
  if (!memberships.some(Boolean)) {
    chatError("CHAT_NOT_FOUND", "Chat participant not found");
  }
}

function onlinePresenceIds(scopeId: string, subjectId: string) {
  return {
    roomId: JSON.stringify(["convex-chat-online", scopeId, subjectId]),
    userId: JSON.stringify([scopeId, subjectId]),
  };
}
