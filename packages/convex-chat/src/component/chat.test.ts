/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import componentTest, { register } from "../test.js";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./test.setup.js";

describe("initial chat vertical slice", () => {
  test("exports a clean test registrar with nested components", () => {
    expect(Object.keys(componentTest.modules)).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining(".test."),
        expect.stringContaining("test.setup"),
      ]),
    );

    const componentPaths: string[] = [];
    register(
      {
        registerComponent: (path: string) => componentPaths.push(path),
      } as never,
      "customChat",
    );
    expect(componentPaths).toEqual([
      "customChat",
      "customChat/presence",
      "customChat/presence/batchWorker",
    ]);
  });

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

  test("keeps online app-wide while typing stays conversation-scoped", async () => {
    const t = initConvexTest();
    const aliceConversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });
    const charlieConversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "bob",
      kind: "direct",
      memberSubjectIds: ["bob", "charlie"],
    });

    await expect(
      t.mutation(api.presence.heartbeatOnline, {
        scopeId: "test",
        subjectId: "mallory",
        sessionId: "mallory-session",
        interval: 10_000,
      }),
    ).rejects.toThrow("Chat participant not found");

    await t.mutation(api.presence.heartbeatOnline, {
      scopeId: "test",
      subjectId: "alice",
      sessionId: "alice-app",
      interval: 10_000,
    });
    const bobAppFirst = await t.mutation(api.presence.heartbeatOnline, {
      scopeId: "test",
      subjectId: "bob",
      sessionId: "bob-phone-app",
      interval: 10_000,
    });
    const bobAppSecond = await t.mutation(api.presence.heartbeatOnline, {
      scopeId: "test",
      subjectId: "bob",
      sessionId: "bob-laptop-app",
      interval: 10_000,
    });
    const aliceRoom = await t.mutation(api.presence.heartbeat, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
      sessionId: "alice-room",
      interval: 10_000,
    });
    const bobAliceRoom = await t.mutation(api.presence.heartbeat, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: aliceConversation.id,
      sessionId: "bob-alice-room",
      interval: 10_000,
    });
    await t.mutation(api.presence.setTyping, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: aliceConversation.id,
      typing: true,
    });

    const online = await t.query(api.presence.listOnline, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
    });
    expect(online.find((entry) => entry.subjectId === "bob")?.online).toBe(
      true,
    );
    const typing = await t.query(api.presence.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
      roomToken: aliceRoom.roomToken,
    });
    expect(typing.find((entry) => entry.subjectId === "bob")?.typing).toBe(
      true,
    );

    await t.mutation(api.presence.disconnect, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: aliceConversation.id,
      sessionToken: bobAliceRoom.sessionToken,
    });
    await t.mutation(api.presence.heartbeat, {
      scopeId: "test",
      subjectId: "bob",
      conversationId: charlieConversation.id,
      sessionId: "bob-charlie-room",
      interval: 10_000,
    });
    const afterSwitchOnline = await t.query(api.presence.listOnline, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
    });
    expect(
      afterSwitchOnline.find((entry) => entry.subjectId === "bob")?.online,
    ).toBe(true);
    const afterSwitchTyping = await t.query(api.presence.list, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
      roomToken: aliceRoom.roomToken,
    });
    expect(
      afterSwitchTyping.find((entry) => entry.subjectId === "bob")?.typing,
    ).toBe(false);

    await t.mutation(api.presence.disconnectOnline, {
      scopeId: "test",
      subjectId: "bob",
      sessionToken: bobAppFirst.sessionToken,
    });
    const oneAppSessionLeft = await t.query(api.presence.listOnline, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
    });
    expect(
      oneAppSessionLeft.find((entry) => entry.subjectId === "bob")?.online,
    ).toBe(true);

    await t.mutation(api.presence.disconnectOnline, {
      scopeId: "test",
      subjectId: "bob",
      sessionToken: bobAppSecond.sessionToken,
    });
    const offline = await t.query(api.presence.listOnline, {
      scopeId: "test",
      subjectId: "alice",
      conversationId: aliceConversation.id,
    });
    expect(offline.find((entry) => entry.subjectId === "bob")?.online).toBe(
      false,
    );
  });

  test("authorizes app-wide presence by active scope participation", async () => {
    const t = initConvexTest();
    const conversation = await t.mutation(api.conversations.create, {
      scopeId: "test",
      createdBySubjectId: "alice",
      kind: "direct",
      memberSubjectIds: ["alice", "bob"],
    });

    await expect(
      t.mutation(api.presence.heartbeatOnline, {
        scopeId: "other-scope",
        subjectId: "alice",
        sessionId: "alice-app",
        interval: 10_000,
      }),
    ).rejects.toThrow("Chat participant not found");
    await expect(
      t.query(api.presence.listOnline, {
        scopeId: "test",
        subjectId: "mallory",
        conversationId: conversation.id,
      }),
    ).rejects.toThrow("Conversation not found");
    await expect(
      t.mutation(api.presence.heartbeatOnline, {
        scopeId: "test",
        subjectId: "alice",
        sessionId: "",
        interval: 10_000,
      }),
    ).rejects.toThrow("Invalid presence session");
    await expect(
      t.mutation(api.presence.heartbeatOnline, {
        scopeId: "test",
        subjectId: "alice",
        sessionId: "alice-app",
        interval: 4_999,
      }),
    ).rejects.toThrow("Invalid presence session");

    await t.run(async (ctx) => {
      const conversationId = ctx.db.normalizeId(
        "conversations",
        conversation.id,
      );
      if (!conversationId) throw new Error("Conversation not found in test");
      const membership = await ctx.db
        .query("memberships")
        .withIndex("conversation_subject", (q) =>
          q.eq("conversationId", conversationId).eq("subjectId", "alice"),
        )
        .unique();
      if (!membership) throw new Error("Membership not found in test");
      await ctx.db.patch(membership._id, { access: "read_only" });
    });
    await expect(
      t.mutation(api.presence.heartbeatOnline, {
        scopeId: "test",
        subjectId: "alice",
        sessionId: "alice-read-only",
        interval: 10_000,
      }),
    ).resolves.toEqual({ sessionToken: expect.any(String) });

    await t.run(async (ctx) => {
      const conversationId = ctx.db.normalizeId(
        "conversations",
        conversation.id,
      );
      if (!conversationId) throw new Error("Conversation not found in test");
      const membership = await ctx.db
        .query("memberships")
        .withIndex("conversation_subject", (q) =>
          q.eq("conversationId", conversationId).eq("subjectId", "alice"),
        )
        .unique();
      if (!membership) throw new Error("Membership not found in test");
      await ctx.db.patch(membership._id, { state: "left" });
    });
    await expect(
      t.mutation(api.presence.heartbeatOnline, {
        scopeId: "test",
        subjectId: "alice",
        sessionId: "alice-left",
        interval: 10_000,
      }),
    ).rejects.toThrow("Chat participant not found");
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
