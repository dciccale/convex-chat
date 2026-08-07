import { v } from "convex/values";

export const conversationKind = v.union(
  v.literal("direct"),
  v.literal("group"),
);
export const conversationState = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("deleting"),
);
export const membershipRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);
export const membershipState = v.union(
  v.literal("invited"),
  v.literal("active"),
  v.literal("left"),
  v.literal("removed"),
);
export const membershipAccess = v.union(
  v.literal("read_write"),
  v.literal("read_only"),
  v.literal("none"),
);

export const attachmentDescriptor = v.object({
  storageProvider: v.string(),
  storageKey: v.string(),
  mediaType: v.string(),
  filename: v.string(),
  size: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  fallbackText: v.string(),
});

export const messagePart = v.union(
  v.object({
    type: v.literal("text"),
    id: v.string(),
    text: v.string(),
  }),
  v.object({
    type: v.literal("data"),
    id: v.string(),
    dataType: v.string(),
    schemaVersion: v.number(),
    data: v.any(),
    fallbackText: v.string(),
  }),
  v.object({
    type: v.literal("system"),
    id: v.string(),
    eventType: v.string(),
    schemaVersion: v.number(),
    data: v.any(),
    fallbackText: v.string(),
  }),
  v.object({
    type: v.literal("attachment"),
    id: v.string(),
    ...attachmentDescriptor.fields,
  }),
);
