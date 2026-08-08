import { R2 } from "@convex-dev/r2";
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
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_DURATION_MS = 2 * 60_000;
const STORAGE_PROVIDER = "cloudflare-r2";
const storage = new R2(components.r2);

const demoSubject = v.union(
  v.literal("alice"),
  v.literal("bob"),
  v.literal("charlie"),
);

export const generateAttachmentUploadUrl = mutation({
  args: {
    subjectId: demoSubject,
    conversationId: v.string(),
    filename: v.string(),
    mediaType: v.string(),
    size: v.number(),
    durationMs: v.optional(v.number()),
  },
  returns: v.object({
    grantId: v.id("pendingAttachments"),
    key: v.string(),
    url: v.string(),
  }),
  handler: async (ctx, args) => {
    validateAttachment(args);
    await ctx.runQuery(components.chat.messages.assertCanWrite, {
      scopeId: DEMO_SCOPE,
      subjectId: args.subjectId,
      conversationId: args.conversationId,
    });
    const key = `chat/${args.conversationId}/${crypto.randomUUID()}`;
    const upload = await storage.generateUploadUrl(key);
    const now = Date.now();
    const grantId = await ctx.db.insert("pendingAttachments", {
      scopeId: DEMO_SCOPE,
      subjectId: args.subjectId,
      conversationId: args.conversationId,
      storageProvider: STORAGE_PROVIDER,
      storageKey: upload.key,
      filename: args.filename.slice(0, 240),
      declaredMediaType: args.mediaType,
      declaredSize: args.size,
      declaredDurationMs: args.durationMs,
      state: "pending",
      createdAt: now,
      expiresAt: now + 15 * 60_000,
    });
    return { grantId, ...upload };
  },
});

export const commitAttachment = action({
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
    if (!metadata?.size || !metadata.contentType) {
      throw new Error("Uploaded attachment metadata is unavailable");
    }
    const mediaKind = attachmentKind(metadata.contentType);
    const maxBytes = mediaKind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
    const mismatchReasons = [
      !mediaKind ? "unsupported media type" : null,
      metadata.size > maxBytes ? "file exceeds size limit" : null,
      metadata.size !== grant.declaredSize
        ? `size ${metadata.size} != ${grant.declaredSize}`
        : null,
      canonicalMediaType(metadata.contentType) !==
      canonicalMediaType(grant.declaredMediaType)
        ? `type ${metadata.contentType} != ${grant.declaredMediaType}`
        : null,
      mediaKind === "audio" && !grant.declaredDurationMs
        ? "audio duration is missing"
        : null,
      mediaKind === "image" && grant.declaredDurationMs !== undefined
        ? "image has an audio duration"
        : null,
    ].filter((reason): reason is string => reason !== null);
    if (mismatchReasons.length > 0) {
      await storage.deleteObject(ctx, grant.storageKey);
      throw new Error(
        `Uploaded object does not match the authorized attachment (${mismatchReasons.join(", ")})`,
      );
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
          mediaType: metadata.contentType,
          filename: grant.filename,
          size: metadata.size,
          durationMs: grant.declaredDurationMs,
          fallbackText:
            mediaKind === "audio"
              ? `Voice message · ${formatDuration(grant.declaredDurationMs ?? 0)}`
              : `Image: ${grant.filename}`,
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

export const getAttachmentUrl = query({
  args: {
    subjectId: demoSubject,
    messageId: v.string(),
    partId: v.string(),
    urlVersion: v.optional(v.number()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const attachment = await ctx.runQuery(
      components.chat.messages.getAttachment,
      {
        scopeId: DEMO_SCOPE,
        subjectId: args.subjectId,
        messageId: args.messageId,
        partId: args.partId,
      },
    );
    if (attachment.storageProvider !== STORAGE_PROVIDER) return null;
    return storage.getUrl(attachment.storageKey, { expiresIn: 5 * 60 });
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
      await storage.deleteObject(ctx, key);
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

function validateAttachment(args: {
  filename: string;
  mediaType: string;
  size: number;
  durationMs?: number;
}) {
  const mediaKind = attachmentKind(args.mediaType);
  const maxBytes = mediaKind === "image" ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (
    !args.filename ||
    args.filename.length > 240 ||
    !mediaKind ||
    !Number.isSafeInteger(args.size) ||
    args.size <= 0 ||
    args.size > maxBytes ||
    (mediaKind === "audio" &&
      (!Number.isSafeInteger(args.durationMs) ||
        !args.durationMs ||
        args.durationMs > MAX_AUDIO_DURATION_MS)) ||
    (mediaKind === "image" && args.durationMs !== undefined)
  ) {
    throw new Error(
      "Select an image smaller than 10 MB or record up to 2 minutes of audio",
    );
  }
}

function attachmentKind(mediaType: string): "image" | "audio" | null {
  if (baseMediaType(mediaType).startsWith("image/")) return "image";
  const normalizedMediaType = baseMediaType(mediaType);
  if (
    [
      "audio/webm",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/aac",
      "audio/ogg",
    ].includes(normalizedMediaType)
  ) {
    return "audio";
  }
  return null;
}

function baseMediaType(mediaType: string) {
  return mediaType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function canonicalMediaType(mediaType: string) {
  const normalized = baseMediaType(mediaType);
  if (normalized === "audio/m4a" || normalized === "audio/x-m4a") {
    return "audio/mp4";
  }
  return normalized;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
