import { R2ChatStorage } from "@convex-chat/r2";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

const DEMO_SCOPE = "convex-chat-demo";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const storage = new R2ChatStorage(components.r2);

const demoSubject = v.union(
  v.literal("alice"),
  v.literal("bob"),
  v.literal("charlie"),
);

export const generateImageUploadUrl = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    filename: v.string(),
    mediaType: v.string(),
    size: v.number(),
  },
  returns: v.object({
    grantId: v.id("pendingAttachments"),
    key: v.string(),
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    validateImage(args);
    await ctx.runQuery(components.chat.messages.assertCanWrite, {
      scopeId: DEMO_SCOPE,
      subjectId: args.subjectId,
      conversationId: args.conversationId,
    });
    const key = `chat/${args.conversationId}/${crypto.randomUUID()}`;
    const upload = await storage.createUploadUrl(key);
    const now = Date.now();
    const grantId = await ctx.db.insert("pendingAttachments", {
      scopeId: DEMO_SCOPE,
      subjectId: args.subjectId,
      conversationId: args.conversationId,
      storageProvider: storage.provider,
      storageKey: upload.key,
      filename: args.filename.slice(0, 240),
      declaredMediaType: args.mediaType,
      declaredSize: args.size,
      state: "pending",
      createdAt: now,
      expiresAt: now + 15 * 60_000,
    });
    return { grantId, ...upload };
  },
});

export const commitImage = action({
  args: {
    grantId: v.id("pendingAttachments"),
    subjectId: demoSubject,
    clientMessageId: v.string(),
    caption: v.optional(v.string()),
    replyToMessageId: v.optional(v.string()),
  },
  returns: v.object({ messageId: v.string() }),
  handler: async (ctx, args): Promise<{ messageId: string }> => {
    const grant: Doc<"pendingAttachments"> = await ctx.runQuery(
      internal.attachments.getPendingGrant,
      {
        grantId: args.grantId,
        subjectId: args.subjectId,
      },
    );
    await storage.syncMetadata(ctx, grant.storageKey);
    const metadata = await storage.getMetadata(ctx, grant.storageKey);
    if (!metadata?.size || !metadata.mediaType) {
      throw new Error("Uploaded image metadata is unavailable");
    }
    if (
      metadata.size > MAX_IMAGE_BYTES ||
      metadata.size !== grant.declaredSize ||
      metadata.mediaType !== grant.declaredMediaType ||
      !metadata.mediaType.startsWith("image/")
    ) {
      await storage.delete(ctx, grant.storageKey);
      throw new Error("Uploaded object does not match the authorized image");
    }
    const message: { id: string } = await ctx.runMutation(
      components.chat.messages.sendAttachment,
      {
        scopeId: grant.scopeId,
        subjectId: args.subjectId,
        conversationId: grant.conversationId,
        clientMessageId: args.clientMessageId,
        caption: args.caption,
        replyToMessageId: args.replyToMessageId,
        attachment: {
          storageProvider: grant.storageProvider,
          storageKey: grant.storageKey,
          mediaType: metadata.mediaType,
          filename: grant.filename,
          size: metadata.size,
          fallbackText: `Image: ${grant.filename}`,
        },
      },
    );
    await ctx.runMutation(internal.attachments.markGrantCommitted, {
      grantId: args.grantId,
      messageId: message.id,
    });
    return { messageId: message.id };
  },
});

export const getImageUrl = query({
  args: {
    subjectId: demoSubject,
    messageId: v.string(),
    partId: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const attachment = await ctx.runQuery(
      components.chat.messages.getAttachment,
      { scopeId: DEMO_SCOPE, ...args },
    );
    if (attachment.storageProvider !== storage.provider) return null;
    return storage.getDownloadUrl(attachment.storageKey, 5 * 60);
  },
});

export const deleteMessage = mutation({
  args: {
    subjectId: demoSubject,
    messageId: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deleted = await ctx.runMutation(
      components.chat.messages.deleteOwnMessage,
      { scopeId: DEMO_SCOPE, ...args },
    );
    for (const key of deleted.attachmentStorageKeys) {
      await storage.delete(ctx, key);
    }
    return null;
  },
});

export const getPendingGrant = internalQuery({
  args: {
    grantId: v.id("pendingAttachments"),
    subjectId: v.string(),
  },
  handler: async (ctx, args) => {
    const grant = await ctx.db.get(args.grantId);
    if (
      !grant ||
      grant.subjectId !== args.subjectId ||
      grant.state !== "pending" ||
      grant.expiresAt < Date.now()
    ) {
      throw new Error("Upload grant is invalid or expired");
    }
    return grant;
  },
});

export const markGrantCommitted = internalMutation({
  args: {
    grantId: v.id("pendingAttachments"),
    messageId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const grant = await ctx.db.get(args.grantId);
    if (!grant) throw new Error("Upload grant not found");
    await ctx.db.patch(grant._id, {
      state: "committed",
      committedAt: Date.now(),
      messageId: args.messageId,
    });
    return null;
  },
});

function validateImage(args: {
  filename: string;
  mediaType: string;
  size: number;
}) {
  if (
    !args.filename ||
    args.filename.length > 240 ||
    !args.mediaType.startsWith("image/") ||
    !Number.isSafeInteger(args.size) ||
    args.size <= 0 ||
    args.size > MAX_IMAGE_BYTES
  ) {
    throw new Error("Select an image smaller than 10 MB");
  }
}
