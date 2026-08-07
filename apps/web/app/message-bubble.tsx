"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Subject } from "./subjects";

export type DemoMessage = FunctionReturnType<
  typeof api.chat.listMessages
>[number];

const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  subjectId,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  message: DemoMessage;
  subjectId: Subject;
  onReply: (message: DemoMessage) => void;
  onEdit: (message: DemoMessage) => void;
  onDelete: (message: DemoMessage) => Promise<void>;
  onReact: (message: DemoMessage, key?: string) => Promise<void>;
}) {
  const mine = message.authorSubjectId === subjectId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");

  function closeOverlays() {
    setMenuOpen(false);
    setPickerOpen(false);
  }

  useEffect(() => {
    if (!menuOpen && !pickerOpen) return;

    function dismissOnOutsidePointer(event: PointerEvent) {
      if (overlayRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
      setPickerOpen(false);
    }

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
  }, [menuOpen, pickerOpen]);

  async function copyText() {
    if (text) await navigator.clipboard.writeText(text);
    closeOverlays();
  }

  return (
    <div className={`message-row ${mine ? "mine" : ""}`}>
      <article
        className={`message ${mine ? "mine" : ""} ${message.status === "redacted" ? "deleted" : ""}`}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuOpen(true);
          setPickerOpen(false);
        }}
      >
        {!mine && message.status === "published" && (
          <span className="message-author">
            {capitalize(message.authorSubjectId ?? "system")}
          </span>
        )}

        {message.reply && (
          <button
            className="reply-quote"
            type="button"
            aria-label="Quoted message"
          >
            <strong>
              {message.reply.authorSubjectId
                ? capitalize(message.reply.authorSubjectId)
                : "System"}
            </strong>
            <span>{message.reply.fallbackText ?? "Message unavailable"}</span>
          </button>
        )}

        {message.status === "redacted" ? (
          <p className="deleted-copy">⊘ This message was deleted</p>
        ) : (
          message.parts.map((part) => {
            if (part.type === "text") return <p key={part.id}>{part.text}</p>;
            if (part.type === "attachment") {
              return (
                <AttachmentImage
                  key={part.id}
                  messageId={message.id}
                  partId={part.id}
                  subjectId={subjectId}
                  fallbackText={part.fallbackText}
                />
              );
            }
            return <p key={part.id}>{part.fallbackText}</p>;
          })
        )}

        <span className="message-meta">
          {message.editedAt && <span>edited</span>}
          <time dateTime={new Date(message.createdAt).toISOString()}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </span>

        {message.status === "published" && (
          <div className="message-hover-actions">
            <button
              type="button"
              aria-label="React to message"
              onClick={() => {
                setPickerOpen(!pickerOpen);
                setMenuOpen(false);
              }}
            >
              ☺
            </button>
            <button
              type="button"
              aria-label="Message actions"
              onClick={() => {
                setMenuOpen(!menuOpen);
                setPickerOpen(false);
              }}
            >
              ▾
            </button>
          </div>
        )}

        {pickerOpen && (
          <div ref={overlayRef} className="reaction-picker" role="menu">
            {reactions.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => {
                  void onReact(message, reaction);
                  closeOverlays();
                }}
              >
                {reaction}
              </button>
            ))}
          </div>
        )}

        {menuOpen && (
          <div ref={overlayRef} className="message-menu" role="menu">
            <button
              type="button"
              onClick={() => {
                onReply(message);
                closeOverlays();
              }}
            >
              <span>↩</span> Reply
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerOpen(true);
                setMenuOpen(false);
              }}
            >
              <span>☺</span> React
            </button>
            {text && (
              <button type="button" onClick={() => void copyText()}>
                <span>▣</span> Copy
              </button>
            )}
            {mine && text && (
              <button
                type="button"
                onClick={() => {
                  onEdit(message);
                  closeOverlays();
                }}
              >
                <span>✎</span> Edit
              </button>
            )}
            {mine && (
              <button
                className="danger"
                type="button"
                onClick={() => {
                  void onDelete(message);
                  closeOverlays();
                }}
              >
                <span>♲</span> Delete
              </button>
            )}
          </div>
        )}
      </article>

      {message.reactions.length > 0 && (
        <div className="reaction-summary">
          {message.reactions.map((reaction) => (
            <button
              className={reaction.reactedByMe ? "mine" : ""}
              key={reaction.key}
              type="button"
              onClick={() =>
                void onReact(
                  message,
                  reaction.reactedByMe ? undefined : reaction.key,
                )
              }
            >
              {reaction.key} {reaction.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentImage({
  subjectId,
  messageId,
  partId,
  fallbackText,
}: {
  subjectId: Subject;
  messageId: string;
  partId: string;
  fallbackText: string;
}) {
  const url = useQuery(api.attachments.getImageUrl, {
    subjectId,
    messageId,
    partId,
  });

  if (!url) return <div className="image-placeholder">Loading image…</div>;
  return <img className="message-image" src={url} alt={fallbackText} />;
}

export function messagePreview(message: DemoMessage) {
  if (message.status === "redacted") return "Deleted message";
  return message.parts
    .map((part) => (part.type === "text" ? part.text : part.fallbackText))
    .join(" ")
    .slice(0, 140);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
