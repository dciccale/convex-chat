/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { createConversation, sendText } from "./_test/chat.helpers.js";
import { initConvexTest } from "./test.setup.js";

describe("conversation and message invariants", () => {
  test("deduplicates concurrent conversation creation by external key", async () => {
    const t = initConvexTest();
    const args = {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct" as const,
      externalKey: "dm:alice:bob",
      memberSubjectIds: ["alice", "bob"],
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        t.mutation(api.conversations.create, args),
      ),
    );
    expect(new Set(results.map((result) => result.id))).toHaveLength(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
  });

  test("rejects external-key retries with a different contract", async () => {
    const t = initConvexTest();
    await createConversation(t, { externalKey: "stable-key" });

    await expect(
      createConversation(t, {
        externalKey: "stable-key",
        kind: "group",
        title: "different",
        memberSubjectIds: ["alice", "bob", "charlie"],
      }),
    ).rejects.toThrow("different conversation");
  });

  test("allocates unique ordered sequences for concurrent sends", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const messages = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        sendText(t, conversation.id, {
          clientMessageId: `concurrent-${index}`,
          text: `message ${index}`,
        }),
      ),
    );
    expect(
      messages.map((message) => message.sequence).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
  });

  test("commits one message for concurrent retries", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        sendText(t, conversation.id, {
          clientMessageId: "same-retry",
          text: "same payload",
        }),
      ),
    );
    expect(new Set(results.map((message) => message.id))).toHaveLength(1);
    const stored = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
    });
    expect(stored).toHaveLength(1);
  });

  test("treats a changed reply target as an idempotency conflict", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const first = await sendText(t, conversation.id, {
      clientMessageId: "reply-source-1",
    });
    const second = await sendText(t, conversation.id, {
      clientMessageId: "reply-source-2",
    });
    await sendText(t, conversation.id, {
      subjectId: "bob",
      clientMessageId: "reply-idempotency",
      text: "reply",
      replyToMessageId: first.id,
    });

    await expect(
      sendText(t, conversation.id, {
        subjectId: "bob",
        clientMessageId: "reply-idempotency",
        text: "reply",
        replyToMessageId: second.id,
      }),
    ).rejects.toThrow("different message");
  });

  test("keeps read watermarks monotonic under concurrent acknowledgements", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const messages = [];
    for (let index = 0; index < 8; index += 1) {
      messages.push(
        await sendText(t, conversation.id, {
          clientMessageId: `watermark-${index}`,
        }),
      );
    }
    await Promise.all(
      [8, 2, 6, 1, 5].map((sequence) =>
        t.mutation(api.messages.markReadThrough, {
          scopeId: "test",
          subjectId: "bob",
          conversationId: conversation.id,
          sequence,
        }),
      ),
    );
    const inbox = await t.query(api.conversations.list, {
      scopeId: "test",
      subjectId: "bob",
    });
    expect(inbox[0].unreadCount).toBe(0);
    const result = await t.mutation(api.messages.markReadThrough, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      sequence: messages[1].sequence,
    });
    expect(result.sequence).toBe(messages.at(-1)?.sequence);
  });

  test("paginates without duplicates when new head messages arrive", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    for (let index = 1; index <= 6; index += 1) {
      await sendText(t, conversation.id, {
        clientMessageId: `page-${index}`,
        text: `message ${index}`,
      });
    }
    const newest = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      limit: 3,
    });
    expect(newest.map((message) => message.sequence)).toEqual([4, 5, 6]);

    await sendText(t, conversation.id, {
      clientMessageId: "page-new-head",
      text: "message 7",
    });
    const older = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      beforeSequence: newest[0].sequence,
      limit: 3,
    });
    expect(older.map((message) => message.sequence)).toEqual([1, 2, 3]);
    expect(
      new Set([...older, ...newest].map((message) => message.id)).size,
    ).toBe(6);
  });

  test("keeps reaction replacement atomic under contention", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const message = await sendText(t, conversation.id);
    await Promise.all(
      ["👍", "❤️", "😂", "🙏"].map((reactionKey) =>
        t.mutation(api.messages.setReaction, {
          scopeId: "test",
          subjectId: "bob",
          messageId: message.id,
          reactionKey,
        }),
      ),
    );
    const stored = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
    });
    expect(stored[0].reactions).toHaveLength(1);
    expect(stored[0].reactions[0]).toMatchObject({
      count: 1,
      reactedByMe: true,
    });
  });
});
