/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { CHAT_LIMITS } from "./limits.js";
import { createConversation, sendText } from "./_test/chat.helpers.js";
import { initConvexTest } from "./test.setup.js";

describe("public input and resource limits", () => {
  test.each([
    ["empty scope", { scopeId: "" }],
    ["empty creator", { createdBySubjectId: " " }],
    ["long member id", { memberSubjectIds: ["alice", "x".repeat(201)] }],
    ["long title", { title: "x".repeat(CHAT_LIMITS.titleCodePoints + 1) }],
    ["long external key", { externalKey: "x".repeat(501) }],
  ])("rejects conversation creation with %s", async (_, overrides) => {
    const t = initConvexTest();
    await expect(createConversation(t, overrides)).rejects.toThrow();
  });

  test("enforces conversation kind and membership limits", async () => {
    const t = initConvexTest();
    await expect(
      createConversation(t, { kind: "direct", memberSubjectIds: ["alice"] }),
    ).rejects.toThrow("two members");
    await expect(
      createConversation(t, {
        kind: "group",
        memberSubjectIds: ["alice"],
      }),
    ).rejects.toThrow("at least two");
    await expect(
      createConversation(t, {
        kind: "group",
        memberSubjectIds: Array.from(
          { length: CHAT_LIMITS.membersPerConversation + 1 },
          (_, index) => `member-${index}`,
        ),
      }),
    ).rejects.toThrow("at most 100");
  });

  test("enforces message, client id, pagination, and read limits", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    await expect(
      sendText(t, conversation.id, { text: " ", clientMessageId: "empty" }),
    ).rejects.toThrow("Text must contain");
    await expect(
      sendText(t, conversation.id, {
        text: "x".repeat(CHAT_LIMITS.messageCodePoints + 1),
        clientMessageId: "long-text",
      }),
    ).rejects.toThrow("Text must contain");
    await expect(
      sendText(t, conversation.id, {
        clientMessageId: "x".repeat(CHAT_LIMITS.identifierCodePoints + 1),
      }),
    ).rejects.toThrow("clientMessageId");
    await expect(
      t.query(api.messages.list, {
        scopeId: "test",
        subjectId: "alice",
        conversationId: conversation.id,
        limit: 101,
      }),
    ).rejects.toThrow("limit");
    await expect(
      t.query(api.messages.list, {
        scopeId: "test",
        subjectId: "alice",
        conversationId: conversation.id,
        beforeSequence: 0,
      }),
    ).rejects.toThrow("beforeSequence");
    await expect(
      t.mutation(api.messages.markReadThrough, {
        scopeId: "test",
        subjectId: "alice",
        conversationId: conversation.id,
        sequence: 1.5,
      }),
    ).rejects.toThrow("sequence");
  });

  test("enforces attachment descriptor limits", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t);
    const base = {
      storageProvider: "storage",
      storageKey: "key",
      mediaType: "image/png",
      filename: "image.png",
      size: 100,
      fallbackText: "image",
    };
    const invalid = [
      { ...base, storageProvider: "" },
      { ...base, storageKey: "x".repeat(CHAT_LIMITS.storageKeyCodePoints + 1) },
      { ...base, size: CHAT_LIMITS.attachmentBytes + 1 },
      { ...base, width: 0 },
      { ...base, height: CHAT_LIMITS.attachmentDimension + 1 },
      { ...base, durationMs: -1 },
    ];
    for (const [index, attachment] of invalid.entries()) {
      await expect(
        t.mutation(api.messages.sendAttachment, {
          scopeId: "test",
          subjectId: "alice",
          conversationId: conversation.id,
          clientMessageId: `invalid-attachment-${index}`,
          attachment,
        }),
      ).rejects.toThrow();
    }
  });

  test("accepts documented upper boundaries", async () => {
    const t = initConvexTest();
    const conversation = await createConversation(t, {
      title: "x".repeat(CHAT_LIMITS.titleCodePoints),
    });
    await expect(
      sendText(t, conversation.id, {
        clientMessageId: "x".repeat(CHAT_LIMITS.identifierCodePoints),
        text: "😀".repeat(CHAT_LIMITS.messageCodePoints),
      }),
    ).resolves.toMatchObject({ sequence: 1 });
  });
});
