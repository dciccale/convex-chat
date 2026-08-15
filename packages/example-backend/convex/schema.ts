import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Chat state remains isolated in the component. This host table contains only
// short-lived, app-owned upload grants for host-managed attachment storage.
export default defineSchema({
  pendingAttachments: defineTable({
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    storageProvider: v.string(),
    storageKey: v.string(),
    filename: v.string(),
    declaredMediaType: v.string(),
    declaredSize: v.number(),
    declaredDurationMs: v.optional(v.number()),
    state: v.union(v.literal("pending"), v.literal("committed")),
    createdAt: v.number(),
    expiresAt: v.number(),
    committedAt: v.optional(v.number()),
    messageId: v.optional(v.string()),
    clientMessageId: v.optional(v.string()),
  })
    .index("storageKey", ["storageKey"])
    .index("subject_state", ["subjectId", "state"]),
});
