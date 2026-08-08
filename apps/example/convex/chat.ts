import { v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";

const DEMO_SCOPE = "convex-chat-demo";
const demoSubject = v.union(
  v.literal("alice"),
  v.literal("bob"),
  v.literal("charlie"),
);

// DEMO ONLY: production wrappers must derive this subject from ctx.auth.
export const ensureDemo = mutation({
  args: {},
  returns: v.object({ directId: v.string(), groupId: v.string() }),
  handler: async (ctx) => {
    const direct = await ctx.runMutation(components.chat.conversations.create, {
      scopeId: DEMO_SCOPE,
      createdBySubjectId: "alice",
      kind: "direct",
      externalKey: "demo:alice:bob",
      memberSubjectIds: ["alice", "bob"],
    });
    const group = await ctx.runMutation(components.chat.conversations.create, {
      scopeId: DEMO_SCOPE,
      createdBySubjectId: "alice",
      kind: "group",
      externalKey: "demo:launch-room",
      title: "Launch room",
      memberSubjectIds: ["alice", "bob", "charlie"],
    });
    return { directId: direct.id, groupId: group.id };
  },
});

export const listConversations = query({
  args: { subjectId: demoSubject },
  handler: async (ctx, { subjectId }) =>
    ctx.runQuery(components.chat.conversations.list, {
      scopeId: DEMO_SCOPE,
      subjectId,
    }),
});

export const listMessages = query({
  args: { subjectId: demoSubject, conversationId: v.string() },
  handler: async (ctx, args) =>
    ctx.runQuery(components.chat.messages.list, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const listPresence = query({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    roomToken: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.runQuery(components.chat.presence.list, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const listOnline = query({
  args: { subjectId: demoSubject, conversationId: v.string() },
  handler: async (ctx, args) =>
    ctx.runQuery(components.chat.presence.listOnline, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const heartbeatOnline = mutation({
  args: {
    subjectId: demoSubject,
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.presence.heartbeatOnline, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const disconnectOnline = mutation({
  args: { subjectId: demoSubject, sessionToken: v.string() },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.presence.disconnectOnline, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const heartbeatPresence = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.presence.heartbeat, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const setTyping = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    typing: v.boolean(),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.presence.setTyping, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const disconnectPresence = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.presence.disconnect, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const sendText = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    clientMessageId: v.string(),
    text: v.string(),
    replyToMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.messages.sendText, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const editMessage = mutation({
  args: {
    subjectId: demoSubject,
    messageId: v.string(),
    partId: v.string(),
    expectedRevision: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.messages.editOwnTextPart, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const setReaction = mutation({
  args: {
    subjectId: demoSubject,
    messageId: v.string(),
    reactionKey: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.messages.setReaction, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});

export const markReadThrough = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    sequence: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.runMutation(components.chat.messages.markReadThrough, {
      scopeId: DEMO_SCOPE,
      ...args,
    }),
});
