/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./test.setup.js";

describe("initial chat vertical slice", () => {
  test("creates an idempotent direct conversation", async () => {
    const t = initConvexTest();
    const args = {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct" as const,
      externalKey: "dm:alice:bob",
      memberSubjectIds: ["alice", "bob"],
    };

    const first = await t.mutation(api.conversations.create, args);
    const retry = await t.mutation(api.conversations.create, args);

    expect(first.created).toBe(true);
    expect(retry).toEqual({ id: first.id, created: false });
  });

  test("deduplicates sends and maintains unread watermarks", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });
    const send = {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      clientMessageId: "client-1",
      text: "Hello Bob",
    };

    const first = await t.mutation(api.messages.sendText, send);
    const retry = await t.mutation(api.messages.sendText, send);
    expect(retry.id).toBe(first.id);

    const aliceInbox = await t.query(api.conversations.list, {
      scopeId: "test",
      subjectId: "alice",
    });
    const bobInbox = await t.query(api.conversations.list, {
      scopeId: "test",
      subjectId: "bob",
    });
    expect(aliceInbox[0].unreadCount).toBe(0);
    expect(bobInbox[0].unreadCount).toBe(1);

    await t.mutation(api.messages.markReadThrough, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      sequence: first.sequence,
    });
    const readInbox = await t.query(api.conversations.list, {
      scopeId: "test",
      subjectId: "bob",
    });
    expect(readInbox[0].unreadCount).toBe(0);
  });

  test("does not reveal a conversation to a non-member", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });

    await expect(
      t.query(api.messages.list, {
        scopeId: "test",
        subjectId: "mallory",
        conversationId: conversation.id,
      }),
    ).rejects.toThrow("Conversation not found");
  });

  test("supports reactions from participants and atomic replacement", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });
    const message = await t.mutation(api.messages.sendText, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      clientMessageId: "reaction-message",
      text: "React to this",
    });

    await t.mutation(api.messages.setReaction, {
      scopeId: "test",
      subjectId: "alice",
      messageId: message.id,
      reactionKey: "👍",
    });
    await t.mutation(api.messages.setReaction, {
      scopeId: "test",
      subjectId: "bob",
      messageId: message.id,
      reactionKey: "❤️",
    });
    await t.mutation(api.messages.setReaction, {
      scopeId: "test",
      subjectId: "alice",
      messageId: message.id,
      reactionKey: "😂",
    });

    const messages = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
    });
    expect(messages[0].reactions).toEqual([
      { key: "❤️", count: 1, reactedByMe: false },
      { key: "😂", count: 1, reactedByMe: true },
    ]);
  });

  test("scopes online and typing presence to conversation members", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });

    await expect(
      t.mutation(api.presence.heartbeat, {
        scopeId: "test",
        subjectId: "mallory",
        conversationId: conversation.id,
        sessionId: "mallory-session",
        interval: 10_000,
      }),
    ).rejects.toThrow("Conversation not found");

    const alice = await t.mutation(api.presence.heartbeat, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      sessionId: "alice-session",
      interval: 10_000,
    });
    const bobFirst = await t.mutation(api.presence.heartbeat, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      sessionId: "bob-phone",
      interval: 10_000,
    });
    const bobSecond = await t.mutation(api.presence.heartbeat, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      sessionId: "bob-laptop",
      interval: 10_000,
    });
    await t.mutation(api.presence.setTyping, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      typing: true,
    });

    const active = await t.query(api.presence.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      roomToken: alice.roomToken,
    });
    expect(active).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectId: "alice", online: true }),
        expect.objectContaining({
          subjectId: "bob",
          online: true,
          typing: true,
        }),
      ]),
    );

    await t.mutation(api.presence.disconnect, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      sessionToken: bobFirst.sessionToken,
    });
    const oneSessionLeft = await t.query(api.presence.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      roomToken: alice.roomToken,
    });
    expect(
      oneSessionLeft.find((entry) => entry.subjectId === "bob")?.online,
    ).toBe(true);

    await t.mutation(api.presence.disconnect, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      sessionToken: bobSecond.sessionToken,
    });
    const disconnected = await t.query(api.presence.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      roomToken: alice.roomToken,
    });
    expect(
      disconnected.find((entry) => entry.subjectId === "bob")?.online,
    ).toBe(false);
  });

  test("enforces revision-safe author edits and deletion-safe replies", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });
    const source = await t.mutation(api.messages.sendText, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      clientMessageId: "source",
      text: "Original text",
    });
    const reply = await t.mutation(api.messages.sendText, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
      clientMessageId: "reply",
      text: "Replying",
      replyToMessageId: source.id,
    });

    await expect(
      t.mutation(api.messages.editOwnTextPart, {
        scopeId: "test",
        subjectId: "bob",
        messageId: source.id,
        partId: "text",
        expectedRevision: source.revision,
        text: "Not mine",
      }),
    ).rejects.toThrow("Only the author");

    const edited = await t.mutation(api.messages.editOwnTextPart, {
      scopeId: "test",
      subjectId: "alice",
      messageId: source.id,
      partId: "text",
      expectedRevision: source.revision,
      text: "Edited text",
    });
    expect(edited.revision).toBe(2);
    await expect(
      t.mutation(api.messages.editOwnTextPart, {
        scopeId: "test",
        subjectId: "alice",
        messageId: source.id,
        partId: "text",
        expectedRevision: source.revision,
        text: "Stale edit",
      }),
    ).rejects.toThrow("changed before this edit");

    const beforeDelete = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
    });
    expect(
      beforeDelete.find((item) => item.id === reply.id)?.reply,
    ).toMatchObject({
      fallbackText: "Original text",
      sourceDeleted: false,
    });

    await t.mutation(api.messages.deleteOwnMessage, {
      scopeId: "test",
      subjectId: "alice",
      messageId: source.id,
      expectedRevision: edited.revision,
    });
    const afterDelete = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: conversation.id,
    });
    expect(afterDelete.find((item) => item.id === source.id)?.status).toBe(
      "redacted",
    );
    expect(
      afterDelete.find((item) => item.id === reply.id)?.reply,
    ).toMatchObject({
      sourceDeleted: true,
      fallbackText: "Original text",
    });

    await t.mutation(api.messages.deleteOwnMessage, {
      scopeId: "test",
      subjectId: "bob",
      messageId: reply.id,
      expectedRevision: reply.revision,
    });
    const afterReplyDelete = await t.query(api.messages.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
    });
    const deletedReply = afterReplyDelete.find((item) => item.id === reply.id);
    expect(deletedReply).toMatchObject({
      status: "redacted",
      parts: [],
    });
    expect(deletedReply?.reply).toBeUndefined();
  });

  test("stores provider-neutral attachments and returns cleanup keys", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });
    const message = await t.mutation(api.messages.sendAttachment, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: conversation.id,
      clientMessageId: "image",
      attachment: {
        storageProvider: "test-storage",
        storageKey: "opaque/image-key",
        mediaType: "image/png",
        filename: "photo.png",
        size: 1024,
        fallbackText: "Image: photo.png",
      },
    });
    const attachment = await t.query(api.messages.getAttachment, {
      scopeId: "test",
      subjectId: "bob",
      messageId: message.id,
      partId: "attachment",
    });
    expect(attachment.storageKey).toBe("opaque/image-key");

    const deleted = await t.mutation(api.messages.deleteOwnMessage, {
      scopeId: "test",
      subjectId: "alice",
      messageId: message.id,
      expectedRevision: message.revision,
    });
    expect(deleted.attachmentStorageKeys).toEqual(["opaque/image-key"]);
  });
});
