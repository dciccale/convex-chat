import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";

type ReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export function chatError(
  code:
    | "CHAT_NOT_FOUND"
    | "INVALID_ARGUMENT"
    | "READ_ONLY"
    | "IDEMPOTENCY_CONFLICT"
    | "REVISION_CONFLICT"
    | "NOT_ALLOWED",
  message: string,
): never {
  throw new ConvexError({ code, message });
}

export async function resolveConversationId(
  ctx: ReadCtx,
  conversationId: string,
) {
  const id = ctx.db.normalizeId("conversations", conversationId);
  if (!id) chatError("CHAT_NOT_FOUND", "Conversation not found");
  return id;
}

export async function requireMembership(
  ctx: ReadCtx,
  args: {
    scopeId: string;
    subjectId: string;
    conversationId: string | Id<"conversations">;
    write?: boolean;
  },
) {
  const conversationId =
    typeof args.conversationId === "string"
      ? await resolveConversationId(ctx, args.conversationId)
      : args.conversationId;
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

  if (
    !membership ||
    membership.scopeId !== args.scopeId ||
    membership.state !== "active" ||
    membership.access === "none"
  ) {
    chatError("CHAT_NOT_FOUND", "Conversation not found");
  }
  if (args.write && membership.access !== "read_write") {
    chatError("READ_ONLY", "Conversation is read-only");
  }

  return { conversation, conversationId, membership };
}

export function previewText(text: string) {
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}
