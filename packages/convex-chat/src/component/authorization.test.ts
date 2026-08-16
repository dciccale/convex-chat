/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import {
  createConversation,
  patchMembership,
  sendText,
} from "./_test/chat.helpers.js";
import { initConvexTest } from "./test.setup.js";

describe("authorization matrix", () => {
  test("projects membership access with optimistic concurrency", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const initial = await t.query(api.conversations.getMemberAccess, {
      scopeId: "test",
      conversationId: conversation.id,
      subjectId: "bob",
    });

    expect(initial).toEqual({ access: "read_write", revision: 1 });
    await expect(
      t.mutation(api.conversations.setMemberAccess, {
        scopeId: "test",
        conversationId: conversation.id,
        subjectId: "bob",
        access: "read_only",
        expectedRevision: initial.revision,
      }),
    ).resolves.toEqual({ access: "read_only", revision: 2, changed: true });
    await expect(
      t.mutation(api.conversations.setMemberAccess, {
        scopeId: "test",
        conversationId: conversation.id,
        subjectId: "bob",
        access: "read_write",
        expectedRevision: initial.revision,
      }),
    ).rejects.toThrow("Membership revision conflict");
    await expect(
      t.mutation(api.conversations.setMemberAccess, {
        scopeId: "test",
        conversationId: conversation.id,
        subjectId: "bob",
        access: "read_only",
        expectedRevision: 2,
      }),
    ).resolves.toEqual({ access: "read_only", revision: 2, changed: false });

    const inbox = await t.query(api.conversations.list, {
      scopeId: "test",
      subjectId: "bob",
    });
    expect(inbox[0]?.access).toBe("read_only");
  });

  test("allows read-only members to read and acknowledge but not write", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const message = await sendText(t, conversation.id);
    await patchMembership(t, conversation.id, "bob", { access: "read_only" });

    await expect(
      t.query(api.messages.list, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
      }),
    ).resolves.toHaveLength(1);
    await expect(
      t.mutation(api.messages.markReadThrough, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
        sequence: message.sequence,
      }),
    ).resolves.toMatchObject({ sequence: message.sequence });

    const writeAttempts = [
      t.mutation(api.messages.sendText, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
        clientMessageId: "read-only-send",
        text: "blocked",
      }),
      t.mutation(api.messages.setReaction, {
        scopeId: "test",
        subjectId: "bob",
        messageId: message.id,
        reactionKey: "👍",
      }),
      t.mutation(api.presence.setTyping, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
        typing: true,
      }),
    ];
    for (const attempt of writeAttempts) {
      await expect(attempt).rejects.toThrow("read-only");
    }
  });

  test("removes and restores visibility through supported access changes", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);

    const hidden = await t.mutation(api.conversations.setMemberAccess, {
      scopeId: "test",
      conversationId: conversation.id,
      subjectId: "bob",
      access: "none",
      expectedRevision: 1,
    });
    await expect(
      t.query(api.conversations.list, {
        scopeId: "test",
        subjectId: "bob",
      }),
    ).resolves.toEqual([]);
    await expect(
      t.query(api.messages.list, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
      }),
    ).rejects.toThrow("Conversation not found");

    await t.mutation(api.conversations.setMemberAccess, {
      scopeId: "test",
      conversationId: conversation.id,
      subjectId: "bob",
      access: "read_write",
      expectedRevision: hidden.revision,
    });
    await expect(
      t.query(api.conversations.list, {
        scopeId: "test",
        subjectId: "bob",
      }),
    ).resolves.toHaveLength(1);
  });

  test.each([
    ["none access", { access: "none" as const }],
    ["invited", { state: "invited" as const }],
    ["left", { state: "left" as const }],
    ["removed", { state: "removed" as const }],
  ])("hides all conversation paths from a member with %s", async (_, patch) => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const message = await sendText(t, conversation.id);
    await patchMembership(t, conversation.id, "bob", patch);

    await expect(
      t.query(api.conversations.list, {
        scopeId: "test",
        subjectId: "bob",
      }),
    ).resolves.toEqual([]);
    await expect(
      t.query(api.messages.list, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
      }),
    ).rejects.toThrow("Conversation not found");
    await expect(
      t.mutation(api.messages.setReaction, {
        scopeId: "test",
        subjectId: "bob",
        messageId: message.id,
        reactionKey: "👍",
      }),
    ).rejects.toThrow("Conversation not found");
    await expect(
      t.mutation(api.presence.heartbeat, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
        sessionId: "hidden-user-session",
        interval: 10_000,
      }),
    ).rejects.toThrow("Conversation not found");
  });

  test("does not leak conversations, messages, or attachments across scopes", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const message = await t.mutation(api.messages.sendAttachment, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      clientMessageId: "cross-scope-attachment",
      attachment: {
        storageProvider: "storage",
        storageKey: "private-key",
        mediaType: "image/png",
        filename: "private.png",
        size: 100,
        fallbackText: "private image",
      },
    });

    await expect(
      t.query(api.messages.list, {
        scopeId: "other",
        subjectId: "alice",
        conversationId: conversation.id,
      }),
    ).rejects.toThrow("Conversation not found");
    await expect(
      t.query(api.messages.getAttachment, {
        scopeId: "other",
        subjectId: "alice",
        messageId: message.id,
        partId: "attachment",
      }),
    ).rejects.toThrow("Message not found");
    await expect(
      t.query(api.presence.listOnline, {
        scopeId: "other",
        subjectId: "alice",
        conversationId: conversation.id,
      }),
    ).rejects.toThrow("Conversation not found");
  });

  test("limits edits and deletion to the message author", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const message = await sendText(t, conversation.id);

    await expect(
      t.mutation(api.messages.editOwnTextPart, {
        scopeId: "test",
        subjectId: "bob",
        messageId: message.id,
        partId: "text",
        expectedRevision: message.revision,
        text: "impersonated edit",
      }),
    ).rejects.toThrow("Only the author");
    await expect(
      t.mutation(api.messages.deleteOwnMessage, {
        scopeId: "test",
        subjectId: "bob",
        messageId: message.id,
        expectedRevision: message.revision,
      }),
    ).rejects.toThrow("Only the author");
  });

  test("enforces history boundaries for reads, replies, and message mutations", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const first = await sendText(t, conversation.id, {
      clientMessageId: "history-first",
    });
    const second = await sendText(t, conversation.id, {
      clientMessageId: "history-second",
    });
    await patchMembership(t, conversation.id, "bob", {
      historyStartsAtSequence: second.sequence,
    });

    const visible = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
    });
    expect(visible.map((message) => message.id)).toEqual([second.id]);
    await expect(
      t.mutation(api.messages.sendText, {
        scopeId: "test",
        subjectId: "bob",
        conversationId: conversation.id,
        clientMessageId: "hidden-reply",
        text: "cannot reply",
        replyToMessageId: first.id,
      }),
    ).rejects.toThrow("Reply target not found");
    await expect(
      t.mutation(api.messages.setReaction, {
        scopeId: "test",
        subjectId: "bob",
        messageId: first.id,
        reactionKey: "👍",
      }),
    ).rejects.toThrow("Message not found");
  });
});
