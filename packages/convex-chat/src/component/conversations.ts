import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import {
  CHAT_LIMITS,
  normalizePageSize,
  validateBoundedString,
  validateIdentifier,
} from "./limits.js";
import { chatError } from "./model.js";
import { conversationKind, membershipAccess } from "./validators.js";

const conversationSummary = v.object({
  id: v.string(),
  kind: conversationKind,
  title: v.optional(v.string()),
  state: v.union(
    v.literal("active"),
    v.literal("archived"),
    v.literal("deleting"),
  ),
  updatedAt: v.number(),
  lastMessagePreview: v.optional(v.string()),
  lastMessageAt: v.optional(v.number()),
  unreadCount: v.number(),
  access: membershipAccess,
  memberSubjectIds: v.array(v.string()),
});

const memberAccess = v.object({
  access: membershipAccess,
  revision: v.number(),
});

export const create = mutation({
  args: {
    scopeId: v.string(),
    createdBySubjectId: v.string(),
    kind: conversationKind,
    externalKey: v.optional(v.string()),
    title: v.optional(v.string()),
    memberSubjectIds: v.array(v.string()),
  },
  returns: v.object({ id: v.string(), created: v.boolean() }),
  handler: async (ctx, args) => {
    validateIdentifier(args.scopeId, "scopeId");
    validateIdentifier(args.createdBySubjectId, "createdBySubjectId");
    if (args.externalKey !== undefined) {
      validateBoundedString(args.externalKey, "externalKey", 500);
    }
    const title = args.title?.trim() || undefined;
    if (title !== undefined) {
      validateBoundedString(title, "title", CHAT_LIMITS.titleCodePoints);
    }
    if (args.memberSubjectIds.length > CHAT_LIMITS.membersPerConversation) {
      chatError(
        "INVALID_ARGUMENT",
        `A conversation can have at most ${CHAT_LIMITS.membersPerConversation} members`,
      );
    }
    for (const subjectId of args.memberSubjectIds) {
      validateIdentifier(subjectId, "memberSubjectId");
    }
    const subjects = [...new Set(args.memberSubjectIds)];
    if (!subjects.includes(args.createdBySubjectId)) {
      subjects.unshift(args.createdBySubjectId);
    }
    if (args.kind === "direct" && subjects.length !== 2) {
      chatError("INVALID_ARGUMENT", "Direct conversations require two members");
    }
    if (args.kind === "group" && subjects.length < 2) {
      chatError("INVALID_ARGUMENT", "Groups require at least two members");
    }
    if (subjects.length > CHAT_LIMITS.membersPerConversation) {
      chatError(
        "INVALID_ARGUMENT",
        "A conversation can have at most 100 members",
      );
    }

    if (args.externalKey) {
      const existing = await ctx.db
        .query("conversations")
        .withIndex("scope_externalKey", (q) =>
          q.eq("scopeId", args.scopeId).eq("externalKey", args.externalKey),
        )
        .unique();
      if (existing) {
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("conversation_state_role", (q) =>
            q.eq("conversationId", existing._id).eq("state", "active"),
          )
          .collect();
        const existingSubjects = memberships
          .map((membership) => membership.subjectId)
          .sort();
        const requestedSubjects = [...subjects].sort();
        if (
          existing.kind !== args.kind ||
          existing.title !== title ||
          JSON.stringify(existingSubjects) !== JSON.stringify(requestedSubjects)
        ) {
          chatError(
            "IDEMPOTENCY_CONFLICT",
            "externalKey was already used for a different conversation",
          );
        }
        return { id: String(existing._id), created: false };
      }
    }

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      scopeId: args.scopeId,
      kind: args.kind,
      externalKey: args.externalKey,
      title,
      state: "active",
      createdBySubjectId: args.createdBySubjectId,
      nextSequence: 1,
      lastUnreadOrdinal: 0,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    for (const subjectId of subjects) {
      await ctx.db.insert("memberships", {
        scopeId: args.scopeId,
        conversationId,
        subjectId,
        role:
          args.kind === "group" && subjectId === args.createdBySubjectId
            ? "owner"
            : "member",
        state: "active",
        access: "read_write",
        historyStartsAtSequence: 1,
        lastDeliveredSequence: 0,
        lastReadSequence: 0,
        lastReadUnreadOrdinal: 0,
        inboxUpdatedAt: now,
        joinedAt: now,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { id: String(conversationId), created: true };
  },
});

export const list = query({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(conversationSummary),
  handler: async (ctx, args) => {
    validateIdentifier(args.scopeId, "scopeId");
    validateIdentifier(args.subjectId, "subjectId");
    const limit = normalizePageSize(args.limit);
    const memberships = (
      await Promise.all(
        (["read_write", "read_only"] as const).map((access) =>
          ctx.db
            .query("memberships")
            .withIndex("scope_subject_access_inboxUpdatedAt", (q) =>
              q
                .eq("scopeId", args.scopeId)
                .eq("subjectId", args.subjectId)
                .eq("access", access),
            )
            .order("desc")
            .take(limit),
        ),
      )
    )
      .flat()
      .filter((membership) => membership.state === "active")
      .sort((a, b) => b.inboxUpdatedAt - a.inboxUpdatedAt)
      .slice(0, limit);

    const summaries = await Promise.all(
      memberships.map(async (membership) => {
        const conversation = await ctx.db.get(membership.conversationId);
        if (!conversation || conversation.scopeId !== args.scopeId) return null;
        const members = await ctx.db
          .query("memberships")
          .withIndex("conversation_state_role", (q) =>
            q.eq("conversationId", conversation._id).eq("state", "active"),
          )
          .collect();
        return {
          id: String(conversation._id),
          kind: conversation.kind,
          title: conversation.title,
          state: conversation.state,
          updatedAt: conversation.updatedAt,
          lastMessagePreview: conversation.lastMessagePreview,
          lastMessageAt: conversation.lastMessageAt,
          unreadCount: Math.max(
            0,
            conversation.lastUnreadOrdinal - membership.lastReadUnreadOrdinal,
          ),
          access: membership.access,
          memberSubjectIds: members.map((member) => member.subjectId),
        };
      }),
    );
    return summaries.filter((summary) => summary !== null);
  },
});

export const getMemberAccess = query({
  args: {
    scopeId: v.string(),
    conversationId: v.string(),
    subjectId: v.string(),
  },
  returns: memberAccess,
  handler: async (ctx, args) => {
    validateIdentifier(args.scopeId, "scopeId");
    validateIdentifier(args.subjectId, "subjectId");
    const conversationId = ctx.db.normalizeId(
      "conversations",
      args.conversationId,
    );
    if (!conversationId) {
      chatError("CHAT_NOT_FOUND", "Conversation not found");
    }
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.scopeId !== args.scopeId) {
      chatError("CHAT_NOT_FOUND", "Conversation not found");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("conversation_subject", (q) =>
        q.eq("conversationId", conversationId).eq("subjectId", args.subjectId),
      )
      .unique();
    if (!membership || membership.scopeId !== args.scopeId) {
      chatError("CHAT_NOT_FOUND", "Conversation not found");
    }
    return { access: membership.access, revision: membership.revision };
  },
});

export const setMemberAccess = mutation({
  args: {
    scopeId: v.string(),
    conversationId: v.string(),
    subjectId: v.string(),
    access: membershipAccess,
    expectedRevision: v.number(),
  },
  returns: v.object({
    access: membershipAccess,
    revision: v.number(),
    changed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    validateIdentifier(args.scopeId, "scopeId");
    validateIdentifier(args.subjectId, "subjectId");
    if (
      !Number.isSafeInteger(args.expectedRevision) ||
      args.expectedRevision < 1
    ) {
      chatError(
        "INVALID_ARGUMENT",
        "expectedRevision must be a positive integer",
      );
    }
    const conversationId = ctx.db.normalizeId(
      "conversations",
      args.conversationId,
    );
    if (!conversationId) {
      chatError("CHAT_NOT_FOUND", "Conversation not found");
    }
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.scopeId !== args.scopeId) {
      chatError("CHAT_NOT_FOUND", "Conversation not found");
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("conversation_subject", (q) =>
        q.eq("conversationId", conversationId).eq("subjectId", args.subjectId),
      )
      .unique();
    if (!membership || membership.scopeId !== args.scopeId) {
      chatError("CHAT_NOT_FOUND", "Conversation not found");
    }
    if (membership.revision !== args.expectedRevision) {
      chatError("REVISION_CONFLICT", "Membership revision conflict");
    }
    if (membership.access === args.access) {
      return {
        access: membership.access,
        revision: membership.revision,
        changed: false,
      };
    }
    const now = Date.now();
    const revision = membership.revision + 1;
    await ctx.db.patch(membership._id, {
      access: args.access,
      revision,
      inboxUpdatedAt: now,
      updatedAt: now,
    });
    return { access: args.access, revision, changed: true };
  },
});
