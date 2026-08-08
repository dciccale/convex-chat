import { describe, expect, it } from "vitest";
import type { DemoConversation, DemoMessage } from "./chat";
import {
  attachmentUploadMediaType,
  audioTimeLabel,
  conversationLabel,
  errorMessage,
  formatDuration,
  messagePreview,
  messageText,
} from "./chat";

function message(
  parts: DemoMessage["parts"],
  status: DemoMessage["status"] = "published",
) {
  return { parts, status } as DemoMessage;
}

describe("native chat presentation helpers", () => {
  it("uses the title or the other members for a conversation label", () => {
    const direct = {
      memberSubjectIds: ["alice", "bob"],
    } as DemoConversation;
    const titled = { ...direct, title: "Design team" } as DemoConversation;

    expect(conversationLabel(direct, "bob")).toBe("Alice");
    expect(conversationLabel(titled, "bob")).toBe("Design team");
  });

  it("combines text parts and falls back to attachment labels", () => {
    expect(
      messageText(
        message([
          { id: "part-1", type: "text", text: "first" },
          { id: "part-2", type: "text", text: "second" },
        ]),
      ),
    ).toBe("first\nsecond");
    expect(
      messagePreview(
        message([
          {
            id: "part-1",
            type: "attachment",
            fallbackText: "Voice message",
            filename: "voice.m4a",
            mediaType: "audio/mp4",
            size: 512,
            storageKey: "attachment-id",
            storageProvider: "r2",
          },
        ]),
      ),
    ).toBe("Voice message");
    expect(messagePreview(message([], "redacted"))).toBe("Deleted message");
  });

  it("formats recording duration and unknown errors", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_900)).toBe("1:05");
    expect(errorMessage(new Error("offline"))).toBe("offline");
    expect(errorMessage("offline")).toBe(
      "Something went wrong. Please try again.",
    );
    expect(
      errorMessage(
        new Error(
          "[CONVEX M(attachments:generateAttachmentUploadUrl)] [Request ID: abc] Server Error\n" +
            "Uncaught Error: Select an image smaller than 10 MB or record up to 2 minutes of audio\n" +
            "    at validateAttachment (../convex/attachments.ts:240:6)",
        ),
      ),
    ).toBe("Choose an image under 10 MB or record audio up to 2 minutes.");
    expect(errorMessage(new Error("Microphone permission was denied"))).toBe(
      "Microphone access is off. Enable it in Settings to record audio.",
    );
  });

  it("keeps the known recorder MIME type on Android", () => {
    expect(attachmentUploadMediaType("audio/mp4", "audio/mp4a-latm")).toBe(
      "audio/mp4",
    );
    expect(attachmentUploadMediaType("image/jpeg", "image/png")).toBe(
      "image/png",
    );
  });

  it("shows playback time only while audio is playing", () => {
    expect(audioTimeLabel({ currentTime: 2, duration: 8, playing: true })).toBe(
      "0:02",
    );
    expect(
      audioTimeLabel({ currentTime: 2, duration: 8, playing: false }),
    ).toBe("0:08");
  });
});
