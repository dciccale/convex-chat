import type { Doc } from "../_generated/dataModel.js";
import { api } from "../_generated/api.js";
import { initConvexTest } from "../test.setup.js";

export type ChatTest = ReturnType<typeof initConvexTest>;

export async function createConversation(
  t: ChatTest,
  overrides: Partial<{
    scopeId: string;
    createdBySubjectId: string;
    kind: "direct" | "group";
    externalKey: string;
    title: string;
    memberSubjectIds: string[];
  }> = {},
) {
  return t.mutation(api.conversations.create, {
    scopeId: "test",
    createdBySubjectId: "alice",
    kind: "direct",
    memberSubjectIds: ["alice", "bob"],
    ...overrides,
  });
}

export async function sendText(
  t: ChatTest,
  conversationId: string,
  overrides: Partial<{
    scopeId: string;
    subjectId: string;
    clientMessageId: string;
    text: string;
    replyToMessageId: string;
  }> = {},
) {
  return t.mutation(api.messages.sendText, {
    scopeId: "test",
    subjectId: "alice",
    conversationId,
    clientMessageId: crypto.randomUUID(),
    text: "hello",
    ...overrides,
  });
}

export async function patchMembership(
  t: ChatTest,
  conversationId: string,
  subjectId: string,
  patch: Partial<
    Pick<Doc<"memberships">, "access" | "state" | "historyStartsAtSequence">
  >,
) {
  await t.run(async (ctx) => {
    const id = ctx.db.normalizeId("conversations", conversationId);
    if (!id) throw new Error("Conversation not found in test");
    const membership = await ctx.db
      .query("memberships")
      .withIndex("conversation_subject", (q) =>
        q.eq("conversationId", id).eq("subjectId", subjectId),
      )
      .unique();
    if (!membership) throw new Error("Membership not found in test");
    await ctx.db.patch(membership._id, patch);
  });
}
