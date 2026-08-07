import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  conversationKind,
  conversationState,
  membershipAccess,
  membershipRole,
  membershipState,
  messagePart,
} from "./validators.js";

export default defineSchema({
  conversations: defineTable({
    scopeId: v.string(),
    kind: conversationKind,
    externalKey: v.optional(v.string()),
    title: v.optional(v.string()),
    state: conversationState,
    createdBySubjectId: v.string(),
    nextSequence: v.number(),
    lastUnreadOrdinal: v.number(),
    lastMessageId: v.optional(v.id("messages")),
    lastMessageSequence: v.optional(v.number()),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("scope_externalKey", ["scopeId", "externalKey"])
    .index("scope_state_updatedAt", ["scopeId", "state", "updatedAt"]),

  memberships: defineTable({
    scopeId: v.string(),
    conversationId: v.id("conversations"),
    subjectId: v.string(),
    role: membershipRole,
    state: membershipState,
    access: membershipAccess,
    historyStartsAtSequence: v.number(),
    lastDeliveredSequence: v.number(),
    lastDeliveredAt: v.optional(v.number()),
    lastReadSequence: v.number(),
    lastReadUnreadOrdinal: v.number(),
    lastReadAt: v.optional(v.number()),
    manualUnreadFromSequence: v.optional(v.number()),
    manualUnreadSetAt: v.optional(v.number()),
    inboxUpdatedAt: v.number(),
    invitedBySubjectId: v.optional(v.string()),
    joinedAt: v.optional(v.number()),
    leftAt: v.optional(v.number()),
    removedAt: v.optional(v.number()),
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("conversation_subject", ["conversationId", "subjectId"])
    .index("scope_subject_access_inboxUpdatedAt", [
      "scopeId",
      "subjectId",
      "access",
      "inboxUpdatedAt",
    ])
    .index("conversation_state_role", ["conversationId", "state", "role"]),

  messages: defineTable({
    scopeId: v.string(),
    conversationId: v.id("conversations"),
    sequence: v.number(),
    unreadOrdinal: v.optional(v.number()),
    authorSubjectId: v.optional(v.string()),
    clientMessageId: v.optional(v.string()),
    parts: v.array(messagePart),
    searchText: v.optional(v.string()),
    contextRef: v.optional(v.string()),
    replyToMessageId: v.optional(v.id("messages")),
    quoteSnapshot: v.optional(
      v.object({
        authorSubjectId: v.optional(v.string()),
        fallbackText: v.string(),
        sourceRevision: v.number(),
      }),
    ),
    status: v.union(v.literal("published"), v.literal("redacted")),
    revision: v.number(),
    editedBySubjectId: v.optional(v.string()),
    editedAt: v.optional(v.number()),
    redactedBySubjectId: v.optional(v.string()),
    redactedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("conversation_sequence", ["conversationId", "sequence"])
    .index("conversation_author_clientMessageId", [
      "conversationId",
      "authorSubjectId",
      "clientMessageId",
    ])
    .index("replyToMessageId", ["replyToMessageId"])
    .index("scope_author_createdAt", [
      "scopeId",
      "authorSubjectId",
      "createdAt",
    ]),

  messageReactions: defineTable({
    scopeId: v.string(),
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    subjectId: v.string(),
    reactionKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("message_subject", ["messageId", "subjectId"])
    .index("message_reactionKey", ["messageId", "reactionKey"])
    .index("scope_subject_updatedAt", ["scopeId", "subjectId", "updatedAt"]),
});
