import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { mutation, query } from "./_generated/server.js";
import { chatError, previewText, requireMembership } from "./model.js";
import { attachmentDescriptor, messagePart } from "./validators.js";

const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

const reactionSummary = v.object({
  key: v.string(),
  count: v.number(),
  reactedByMe: v.boolean(),
});

const publicMessage = v.object({
  id: v.string(),
  sequence: v.number(),
  authorSubjectId: v.optional(v.string()),
  parts: v.array(messagePart),
  reply: v.optional(
    v.object({
      messageId: v.string(),
      authorSubjectId: v.optional(v.string()),
      fallbackText: v.optional(v.string()),
      sourceRevision: v.number(),
      sourceDeleted: v.boolean(),
    }),
  ),
  reactions: v.array(reactionSummary),
  status: v.union(v.literal("published"), v.literal("redacted")),
  revision: v.number(),
  editedAt: v.optional(v.number()),
  redactedAt: v.optional(v.number()),
  createdAt: v.number(),
});

export const sendText = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    clientMessageId: v.string(),
    text: v.string(),
    replyToMessageId: v.optional(v.string()),
  },
  returns: publicMessage,
  handler: async (ctx, args) => {
    const text = args.text.trim();
    validateText(text);
    const parts = [{ type: "text" as const, id: "text", text }];
    return insertMessage(ctx, {
      ...args,
      parts,
      searchText: text,
      fallbackText: text,
    });
  },
});

export const sendAttachment = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    clientMessageId: v.string(),
    attachment: attachmentDescriptor,
    caption: v.optional(v.string()),
    replyToMessageId: v.optional(v.string()),
  },
  returns: publicMessage,
  handler: async (ctx, args) => {
    validateAttachment(args.attachment);
    const caption = args.caption?.trim();
    if (caption) validateText(caption);
    const parts = [
      {
        type: "attachment" as const,
        id: "attachment",
        ...args.attachment,
      },
      ...(caption
        ? [{ type: "text" as const, id: "caption", text: caption }]
        : []),
    ];
    return insertMessage(ctx, {
      ...args,
      parts,
      searchText: caption,
      fallbackText: caption ?? args.attachment.fallbackText,
    });
  },
});

export const list = query({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    beforeSequence: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(publicMessage),
  handler: async (ctx, args) => {
    const { conversationId, membership } = await requireMembership(ctx, args);
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    const messages = await ctx.db
      .query("messages")
      .withIndex("conversation_sequence", (q) => {
        const inConversation = q.eq("conversationId", conversationId);
        return args.beforeSequence === undefined
          ? inConversation
          : inConversation.lt("sequence", args.beforeSequence);
      })
      .order("desc")
      .take(limit);
    return Promise.all(
      messages
        .filter(
          (message) => message.sequence >= membership.historyStartsAtSequence,
        )
        .reverse()
        .map((message) =>
          projectMessage(
            ctx,
            message,
            args.subjectId,
            membership.historyStartsAtSequence,
          ),
        ),
    );
  },
});

export const editOwnTextPart = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    messageId: v.string(),
    partId: v.string(),
    expectedRevision: v.number(),
    text: v.string(),
  },
  returns: publicMessage,
  handler: async (ctx, args) => {
    const { message, conversation, membership } = await requireMessage(
      ctx,
      args,
      true,
    );
    if (message.authorSubjectId !== args.subjectId) {
      chatError("NOT_ALLOWED", "Only the author can edit this message");
    }
    if (message.status !== "published") {
      chatError("NOT_ALLOWED", "Deleted messages cannot be edited");
    }
    if (message.revision !== args.expectedRevision) {
      chatError("REVISION_CONFLICT", "The message changed before this edit");
    }
    const text = args.text.trim();
    validateText(text);
    let found = false;
    const parts = message.parts.map((part) => {
      if (part.type === "text" && part.id === args.partId) {
        found = true;
        return { ...part, text };
      }
      return part;
    });
    if (!found) chatError("INVALID_ARGUMENT", "Text part not found");
    const now = Date.now();
    await ctx.db.patch(message._id, {
      parts,
      searchText: parts
        .filter((part) => part.type === "text")
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n"),
      revision: message.revision + 1,
      editedAt: now,
      editedBySubjectId: args.subjectId,
    });
    if (conversation.lastMessageId === message._id) {
      await ctx.db.patch(conversation._id, {
        lastMessagePreview: previewText(text),
        updatedAt: now,
        revision: conversation.revision + 1,
      });
    }
    return projectMessage(
      ctx,
      { ...message, parts, revision: message.revision + 1, editedAt: now },
      args.subjectId,
      membership.historyStartsAtSequence,
    );
  },
});

export const deleteOwnMessage = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    messageId: v.string(),
    expectedRevision: v.number(),
  },
  returns: v.object({
    message: publicMessage,
    attachmentStorageKeys: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const { message, conversation, membership } = await requireMessage(
      ctx,
      args,
      true,
    );
    if (message.authorSubjectId !== args.subjectId) {
      chatError("NOT_ALLOWED", "Only the author can delete this message");
    }
    if (message.status !== "published") {
      chatError("NOT_ALLOWED", "Message is already deleted");
    }
    if (message.revision !== args.expectedRevision) {
      chatError("REVISION_CONFLICT", "The message changed before deletion");
    }
    const attachmentStorageKeys = message.parts
      .filter((part) => part.type === "attachment")
      .map((part) => (part.type === "attachment" ? part.storageKey : ""));
    const now = Date.now();
    const reactions = await ctx.db
      .query("messageReactions")
      .withIndex("message_reactionKey", (q) => q.eq("messageId", message._id))
      .collect();
    for (const reaction of reactions) await ctx.db.delete(reaction._id);
    await ctx.db.patch(message._id, {
      parts: [],
      searchText: undefined,
      status: "redacted",
      revision: message.revision + 1,
      redactedAt: now,
      redactedBySubjectId: args.subjectId,
    });
    if (conversation.lastMessageId === message._id) {
      await ctx.db.patch(conversation._id, {
        lastMessagePreview: "Deleted message",
        updatedAt: now,
        revision: conversation.revision + 1,
      });
    }
    return {
      message: await projectMessage(
        ctx,
        {
          ...message,
          parts: [],
          searchText: undefined,
          status: "redacted",
          revision: message.revision + 1,
          redactedAt: now,
        },
        args.subjectId,
        membership.historyStartsAtSequence,
      ),
      attachmentStorageKeys,
    };
  },
});

export const setReaction = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    messageId: v.string(),
    reactionKey: v.optional(v.string()),
  },
  returns: v.array(reactionSummary),
  handler: async (ctx, args) => {
    const { message } = await requireMessage(ctx, args, true);
    if (message.status !== "published") {
      chatError("NOT_ALLOWED", "Deleted messages cannot receive reactions");
    }
    if (
      args.reactionKey !== undefined &&
      !ALLOWED_REACTIONS.includes(
        args.reactionKey as (typeof ALLOWED_REACTIONS)[number],
      )
    ) {
      chatError("INVALID_ARGUMENT", "Reaction is not allowed");
    }
    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("message_subject", (q) =>
        q.eq("messageId", message._id).eq("subjectId", args.subjectId),
      )
      .unique();
    const now = Date.now();
    if (!args.reactionKey || existing?.reactionKey === args.reactionKey) {
      if (existing) await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, {
        reactionKey: args.reactionKey,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("messageReactions", {
        scopeId: args.scopeId,
        conversationId: message.conversationId,
        messageId: message._id,
        subjectId: args.subjectId,
        reactionKey: args.reactionKey,
        createdAt: now,
        updatedAt: now,
      });
    }
    return getReactionSummary(ctx, message._id, args.subjectId);
  },
});

export const getAttachment = query({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    messageId: v.string(),
    partId: v.string(),
  },
  returns: v.object({
    storageProvider: v.string(),
    storageKey: v.string(),
    mediaType: v.string(),
    filename: v.string(),
  }),
  handler: async (ctx, args) => {
    const { message } = await requireMessage(ctx, args, false);
    if (message.status !== "published") {
      chatError("CHAT_NOT_FOUND", "Attachment not found");
    }
    const part = message.parts.find(
      (candidate) =>
        candidate.type === "attachment" && candidate.id === args.partId,
    );
    if (!part || part.type !== "attachment") {
      chatError("CHAT_NOT_FOUND", "Attachment not found");
    }
    return {
      storageProvider: part.storageProvider,
      storageKey: part.storageKey,
      mediaType: part.mediaType,
      filename: part.filename,
    };
  },
});

export const assertCanWrite = query({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireMembership(ctx, { ...args, write: true });
    return null;
  },
});

export const markReadThrough = mutation({
  args: {
    scopeId: v.string(),
    subjectId: v.string(),
    conversationId: v.string(),
    sequence: v.number(),
  },
  returns: v.object({ sequence: v.number(), unreadOrdinal: v.number() }),
  handler: async (ctx, args) => {
    const { conversation, conversationId, membership } =
      await requireMembership(ctx, args);
    const sequence = Math.max(
      membership.lastReadSequence,
      Math.min(Math.floor(args.sequence), conversation.nextSequence - 1),
    );
    const message = await ctx.db
      .query("messages")
      .withIndex("conversation_sequence", (q) =>
        q.eq("conversationId", conversationId).lte("sequence", sequence),
      )
      .order("desc")
      .first();
    const unreadOrdinal = Math.max(
      membership.lastReadUnreadOrdinal,
      message?.unreadOrdinal ?? membership.lastReadUnreadOrdinal,
    );
    const now = Date.now();
    await ctx.db.patch(membership._id, {
      lastDeliveredSequence: Math.max(
        membership.lastDeliveredSequence,
        sequence,
      ),
      lastDeliveredAt: now,
      lastReadSequence: sequence,
      lastReadUnreadOrdinal: unreadOrdinal,
      lastReadAt: now,
      updatedAt: now,
    });
    return { sequence, unreadOrdinal };
  },
});

async function insertMessage(
  ctx: MutationCtx,
  args: {
    scopeId: string;
    subjectId: string;
    conversationId: string;
    clientMessageId: string;
    replyToMessageId?: string;
    parts: Doc<"messages">["parts"];
    searchText?: string;
    fallbackText: string;
  },
) {
  validateClientMessageId(args.clientMessageId);
  const { conversation, conversationId, membership } = await requireMembership(
    ctx,
    { ...args, write: true },
  );
  if (conversation.state !== "active") {
    chatError("READ_ONLY", "Conversation is not active");
  }
  const existing = await ctx.db
    .query("messages")
    .withIndex("conversation_author_clientMessageId", (q) =>
      q
        .eq("conversationId", conversationId)
        .eq("authorSubjectId", args.subjectId)
        .eq("clientMessageId", args.clientMessageId),
    )
    .unique();
  if (existing) {
    if (stableStringify(existing.parts) !== stableStringify(args.parts)) {
      chatError(
        "IDEMPOTENCY_CONFLICT",
        "clientMessageId was already used for a different message",
      );
    }
    return projectMessage(
      ctx,
      existing,
      args.subjectId,
      membership.historyStartsAtSequence,
    );
  }

  const reply = args.replyToMessageId
    ? await createReplySnapshot(
        ctx,
        conversationId,
        args.replyToMessageId,
        membership.historyStartsAtSequence,
      )
    : undefined;
  const now = Date.now();
  const sequence = conversation.nextSequence;
  const unreadOrdinal = conversation.lastUnreadOrdinal + 1;
  const messageId = await ctx.db.insert("messages", {
    scopeId: args.scopeId,
    conversationId,
    sequence,
    unreadOrdinal,
    authorSubjectId: args.subjectId,
    clientMessageId: args.clientMessageId,
    parts: args.parts,
    searchText: args.searchText,
    replyToMessageId: reply?.messageId,
    quoteSnapshot: reply?.quoteSnapshot,
    status: "published",
    revision: 1,
    createdAt: now,
  });
  await ctx.db.patch(conversationId, {
    nextSequence: sequence + 1,
    lastUnreadOrdinal: unreadOrdinal,
    lastMessageId: messageId,
    lastMessageSequence: sequence,
    lastMessageAt: now,
    lastMessagePreview: previewText(args.fallbackText),
    revision: conversation.revision + 1,
    updatedAt: now,
  });
  const members = await ctx.db
    .query("memberships")
    .withIndex("conversation_state_role", (q) =>
      q.eq("conversationId", conversationId).eq("state", "active"),
    )
    .collect();
  for (const member of members) {
    await ctx.db.patch(member._id, {
      inboxUpdatedAt: now,
      ...(member.subjectId === args.subjectId
        ? {
            lastDeliveredSequence: sequence,
            lastDeliveredAt: now,
            lastReadSequence: sequence,
            lastReadUnreadOrdinal: unreadOrdinal,
            lastReadAt: now,
          }
        : {}),
      updatedAt: now,
    });
  }
  const stored = await ctx.db.get(messageId);
  if (!stored) throw new Error("Message insert failed");
  return projectMessage(
    ctx,
    stored,
    args.subjectId,
    membership.historyStartsAtSequence,
  );
}

async function requireMessage(
  ctx: QueryCtx | MutationCtx,
  args: { scopeId: string; subjectId: string; messageId: string },
  write: boolean,
) {
  const messageId = ctx.db.normalizeId("messages", args.messageId);
  if (!messageId) chatError("CHAT_NOT_FOUND", "Message not found");
  const message = await ctx.db.get(messageId);
  if (!message || message.scopeId !== args.scopeId) {
    chatError("CHAT_NOT_FOUND", "Message not found");
  }
  const access = await requireMembership(ctx, {
    scopeId: args.scopeId,
    subjectId: args.subjectId,
    conversationId: message.conversationId,
    write,
  });
  if (message.sequence < access.membership.historyStartsAtSequence) {
    chatError("CHAT_NOT_FOUND", "Message not found");
  }
  return { message, ...access };
}

async function createReplySnapshot(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  replyToMessageId: string,
  historyStartsAtSequence: number,
) {
  const messageId = ctx.db.normalizeId("messages", replyToMessageId);
  if (!messageId) chatError("INVALID_ARGUMENT", "Reply target not found");
  const source = await ctx.db.get(messageId);
  if (
    !source ||
    source.conversationId !== conversationId ||
    source.sequence < historyStartsAtSequence ||
    source.status !== "published"
  ) {
    chatError("INVALID_ARGUMENT", "Reply target not found");
  }
  const fallbackText = source.parts
    .map((part) =>
      part.type === "text"
        ? part.text
        : "fallbackText" in part
          ? part.fallbackText
          : "",
    )
    .join(" ")
    .slice(0, 240);
  return {
    messageId,
    quoteSnapshot: {
      authorSubjectId: source.authorSubjectId,
      fallbackText,
      sourceRevision: source.revision,
    },
  };
}

async function projectMessage(
  ctx: QueryCtx | MutationCtx,
  message: Doc<"messages">,
  subjectId: string,
  historyStartsAtSequence: number,
) {
  const reactions =
    message.status === "published"
      ? await getReactionSummary(ctx, message._id, subjectId)
      : [];
  let reply:
    | {
        messageId: string;
        authorSubjectId?: string;
        fallbackText?: string;
        sourceRevision: number;
        sourceDeleted: boolean;
      }
    | undefined;
  if (
    message.status === "published" &&
    message.replyToMessageId &&
    message.quoteSnapshot
  ) {
    const source = await ctx.db.get(message.replyToMessageId);
    const sourceDeleted = !source || source.status === "redacted";
    const outsideHistory =
      source !== null && source.sequence < historyStartsAtSequence;
    reply = {
      messageId: String(message.replyToMessageId),
      authorSubjectId: message.quoteSnapshot.authorSubjectId,
      // A reply owns its quote snapshot. Redacting the source prevents
      // navigation back to it, but does not rewrite already-sent replies.
      fallbackText: outsideHistory
        ? undefined
        : message.quoteSnapshot.fallbackText,
      sourceRevision: message.quoteSnapshot.sourceRevision,
      sourceDeleted: sourceDeleted || outsideHistory,
    };
  }
  return {
    id: String(message._id),
    sequence: message.sequence,
    authorSubjectId: message.authorSubjectId,
    parts: message.status === "published" ? message.parts : [],
    reply,
    reactions,
    status: message.status,
    revision: message.revision,
    editedAt: message.editedAt,
    redactedAt: message.redactedAt,
    createdAt: message.createdAt,
  };
}

async function getReactionSummary(
  ctx: QueryCtx | MutationCtx,
  messageId: Id<"messages">,
  subjectId: string,
) {
  const reactions = await ctx.db
    .query("messageReactions")
    .withIndex("message_reactionKey", (q) => q.eq("messageId", messageId))
    .collect();
  return ALLOWED_REACTIONS.flatMap((key) => {
    const matching = reactions.filter(
      (reaction) => reaction.reactionKey === key,
    );
    return matching.length
      ? [
          {
            key,
            count: matching.length,
            reactedByMe: matching.some(
              (reaction) => reaction.subjectId === subjectId,
            ),
          },
        ]
      : [];
  });
}

function validateText(text: string) {
  const codePoints = [...text].length;
  if (codePoints === 0 || codePoints > 10_000) {
    chatError("INVALID_ARGUMENT", "Text must contain 1 to 10,000 code points");
  }
}

function validateClientMessageId(clientMessageId: string) {
  if (!clientMessageId || clientMessageId.length > 200) {
    chatError(
      "INVALID_ARGUMENT",
      "clientMessageId must contain 1 to 200 characters",
    );
  }
}

function validateAttachment(attachment: {
  storageProvider: string;
  storageKey: string;
  mediaType: string;
  filename: string;
  size: number;
  fallbackText: string;
}) {
  if (
    !attachment.storageProvider ||
    !attachment.storageKey ||
    !attachment.mediaType ||
    !attachment.filename ||
    !attachment.fallbackText ||
    !Number.isSafeInteger(attachment.size) ||
    attachment.size <= 0 ||
    attachment.size > 25 * 1024 * 1024
  ) {
    chatError("INVALID_ARGUMENT", "Invalid attachment metadata");
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
