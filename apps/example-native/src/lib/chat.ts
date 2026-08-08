import type { api } from "@convex-chat/example-backend/api";
import type { FunctionReturnType } from "convex/server";
import type { Subject } from "./subjects";

export type DemoConversation = FunctionReturnType<
  typeof api.chat.listConversations
>[number];

export type DemoMessage = FunctionReturnType<
  typeof api.chat.listMessages
>[number];

export const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export function attachmentUploadMediaType(
  declaredMediaType: string,
  fileMediaType: string,
) {
  if (declaredMediaType.startsWith("audio/")) return declaredMediaType;
  if (fileMediaType.startsWith("image/")) return fileMediaType;
  return declaredMediaType;
}

export function conversationLabel(
  conversation: DemoConversation,
  subjectId: Subject,
) {
  return (
    conversation.title ??
    conversation.memberSubjectIds
      .filter((member) => member !== subjectId)
      .map((member) => member.charAt(0).toUpperCase() + member.slice(1))
      .join(", ")
  );
}

export function messageText(message: DemoMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

export function messagePreview(message: DemoMessage) {
  if (message.status === "redacted") return "Deleted message";
  const text = messageText(message).trim();
  if (text) return text;
  const attachment = message.parts.find((part) => part.type === "attachment");
  return attachment?.fallbackText ?? "Message";
}

export function errorMessage(cause: unknown) {
  if (!(cause instanceof Error))
    return "Something went wrong. Please try again.";

  const message = cause.message.trim();
  const serverMessage = message.match(
    /(?:^|\n)Uncaught (?:Error|ConvexError):\s*([^\n]+)/,
  )?.[1];
  const readableMessage = (serverMessage ?? message.split("\n", 1)[0]).trim();

  if (
    /Select an image smaller than 10 MB or record up to 2 minutes/i.test(
      readableMessage,
    )
  ) {
    return "Choose an image under 10 MB or record audio up to 2 minutes.";
  }
  if (/Microphone permission was denied/i.test(readableMessage)) {
    return "Microphone access is off. Enable it in Settings to record audio.";
  }
  if (/^\[CONVEX\b/i.test(readableMessage) || !readableMessage) {
    return "Something went wrong. Please try again.";
  }
  return readableMessage;
}

export function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function audioTimeLabel({
  currentTime,
  duration,
  playing,
}: {
  currentTime: number;
  duration: number;
  playing: boolean;
}) {
  return formatDuration((playing ? currentTime : duration) * 1000);
}
