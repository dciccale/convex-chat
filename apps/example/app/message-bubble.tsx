"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Ban,
  Copy,
  Download,
  Edit3,
  FileText,
  MoreHorizontal,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex-chat/example-backend/api";
import { AudioPlayer } from "@/components/audio-player";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { Subject } from "./subjects";

export type DemoMessage = FunctionReturnType<
  typeof api.chat.listMessages
>[number];

const reactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  subjectId,
  showAuthor,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: {
  message: DemoMessage;
  subjectId: Subject;
  showAuthor: boolean;
  onReply: (message: DemoMessage) => void;
  onEdit: (message: DemoMessage) => void;
  onDelete: (message: DemoMessage) => Promise<void>;
  onReact: (message: DemoMessage, key?: string) => Promise<void>;
}) {
  const mine = message.authorSubjectId === subjectId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuReactionsOpen, setMenuReactionsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
  const hasImage =
    message.status === "published" &&
    message.parts.some(
      (part) =>
        part.type === "attachment" && part.mediaType.startsWith("image/"),
    );

  async function copyText() {
    if (text) await navigator.clipboard.writeText(text);
    setMenuOpen(false);
  }

  return (
    <div className={`message-row ${mine ? "mine" : ""}`}>
      {showAuthor && !mine && (
        <Avatar className="message-avatar">
          <AvatarFallback>
            {capitalize(message.authorSubjectId ?? "system").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="message-stack">
        <article
          className={`message ${mine ? "mine" : ""} ${hasImage ? "image-message" : ""} ${message.status === "redacted" ? "deleted" : ""}`}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuOpen(true);
            setPickerOpen(false);
          }}
        >
          {showAuthor && !mine && (
            <span className="message-author">
              {capitalize(message.authorSubjectId ?? "system")}
            </span>
          )}

          {message.reply && (
            <div className="reply-quote" aria-label="Quoted message">
              <strong>
                {message.reply.authorSubjectId
                  ? capitalize(message.reply.authorSubjectId)
                  : "System"}
              </strong>
              <span>{message.reply.fallbackText ?? "Message unavailable"}</span>
            </div>
          )}

          {message.status === "redacted" ? (
            <p className="deleted-copy">
              <Ban />
              {mine ? "You deleted this message." : "This message was deleted."}
            </p>
          ) : (
            message.parts.map((part) => {
              if (part.type === "text") return <p key={part.id}>{part.text}</p>;
              if (part.type === "attachment") {
                return (
                  <Attachment
                    key={part.id}
                    message={message}
                    messageId={message.id}
                    partId={part.id}
                    subjectId={subjectId}
                    fallbackText={part.fallbackText}
                    mediaType={part.mediaType}
                    durationMs={part.durationMs}
                    onReply={onReply}
                    onReact={onReact}
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
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="React to message"
                  >
                    <SmilePlus />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="reaction-picker"
                  side="top"
                  align={mine ? "end" : "start"}
                >
                  {reactions.map((reaction) => (
                    <Button
                      variant="ghost"
                      size="icon"
                      key={reaction}
                      onClick={() => {
                        void onReact(message, reaction);
                        setPickerOpen(false);
                      }}
                    >
                      {reaction}
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>
              <DropdownMenu
                open={menuOpen}
                onOpenChange={(open) => {
                  setMenuOpen(open);
                  if (!open) setMenuReactionsOpen(false);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Message actions"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={mine ? "end" : "start"}
                  className="message-menu"
                >
                  <DropdownMenuItem onSelect={() => onReply(message)}>
                    <Reply /> Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    aria-expanded={menuReactionsOpen}
                    onSelect={(event) => {
                      event.preventDefault();
                      setMenuReactionsOpen((open) => !open);
                    }}
                  >
                    <SmilePlus /> React
                  </DropdownMenuItem>
                  {menuReactionsOpen && (
                    <div
                      className="menu-reactions"
                      role="group"
                      aria-label="Choose a reaction"
                    >
                      {reactions.map((reaction) => (
                        <DropdownMenuItem
                          className="menu-reaction"
                          key={reaction}
                          aria-label={`React with ${reaction}`}
                          onSelect={() => void onReact(message, reaction)}
                        >
                          {reaction}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                  {text && (
                    <DropdownMenuItem onSelect={() => void copyText()}>
                      <Copy /> Copy
                    </DropdownMenuItem>
                  )}
                  {mine && text && (
                    <DropdownMenuItem onSelect={() => onEdit(message)}>
                      <Edit3 /> Edit
                    </DropdownMenuItem>
                  )}
                  {mine && <DropdownMenuSeparator />}
                  {mine && (
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void onDelete(message)}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </article>

        {message.reactions.length > 0 && (
          <div className="reaction-summary">
            {message.reactions.map((reaction) => (
              <Button
                variant="outline"
                size="xs"
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
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Attachment({
  message,
  subjectId,
  messageId,
  partId,
  fallbackText,
  mediaType,
  durationMs,
  onReply,
  onReact,
}: {
  message: DemoMessage;
  subjectId: Subject;
  messageId: string;
  partId: string;
  fallbackText: string;
  mediaType: string;
  durationMs?: number;
  onReply: (message: DemoMessage) => void;
  onReact: (message: DemoMessage, key?: string) => Promise<void>;
}) {
  const url = useQuery(api.attachments.getAttachmentUrl, {
    subjectId,
    messageId,
    partId,
  });

  if (url === undefined) {
    return <AttachmentPlaceholder mediaType={mediaType} />;
  }
  if (url === null) {
    return (
      <div className="attachment-unavailable">
        <FileText />
        <span>{fallbackText} is unavailable</span>
      </div>
    );
  }
  if (mediaType.startsWith("audio/")) {
    return (
      <AudioPlayer
        src={url}
        label={fallbackText}
        declaredDurationMs={durationMs}
      />
    );
  }
  if (mediaType.startsWith("image/")) {
    return (
      <ImageAttachment
        fallbackText={fallbackText}
        message={message}
        onReact={onReact}
        onReply={onReply}
        url={url}
      />
    );
  }
  return (
    <Button className="message-attachment" variant="secondary" asChild>
      <a href={url} download>
        <FileText /> <span>{fallbackText}</span> <Download />
      </a>
    </Button>
  );
}

function AttachmentPlaceholder({ mediaType }: { mediaType: string }) {
  if (mediaType.startsWith("image/")) {
    return (
      <div
        className="attachment-placeholder image"
        role="status"
        aria-label="Loading image"
      >
        <Skeleton className="attachment-skeleton" />
      </div>
    );
  }

  if (mediaType.startsWith("audio/")) {
    return (
      <div
        className="attachment-placeholder audio"
        role="status"
        aria-label="Loading voice message"
      >
        <Skeleton className="attachment-skeleton-audio-button" />
        <div className="attachment-skeleton-audio-track">
          <Skeleton className="attachment-skeleton-audio-label" />
          <Skeleton className="attachment-skeleton-audio-line" />
          <Skeleton className="attachment-skeleton-audio-time" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="attachment-placeholder file"
      role="status"
      aria-label="Loading attachment"
    >
      <Skeleton className="attachment-skeleton-line" />
    </div>
  );
}

function ImageAttachment({
  fallbackText,
  message,
  onReact,
  onReply,
  url,
}: {
  fallbackText: string;
  message: DemoMessage;
  onReact: (message: DemoMessage, key?: string) => Promise<void>;
  onReply: (message: DemoMessage) => void;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const replyAfterClose = useRef(false);

  function closeAndReply() {
    replyAfterClose.current = true;
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setShowReactions(false);
      }}
    >
      <DialogTrigger asChild>
        <button
          className="message-image-trigger"
          type="button"
          aria-label={`Open ${fallbackText}`}
          disabled={loadState !== "loaded"}
        >
          {loadState === "loading" && (
            <div className="message-image-loading" aria-hidden="true">
              <Skeleton />
            </div>
          )}
          {loadState === "error" && (
            <span className="message-image-error">Image unavailable</span>
          )}
          <img
            className={`message-image ${loadState === "loaded" ? "loaded" : ""}`}
            src={url}
            alt={fallbackText}
            decoding="async"
            onLoad={(event) => {
              const image = event.currentTarget;
              void image
                .decode()
                .catch(() => undefined)
                .then(() => setLoadState("loaded"));
            }}
            onError={() => setLoadState("error")}
          />
        </button>
      </DialogTrigger>
      <DialogContent
        className="image-lightbox top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none"
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!replyAfterClose.current) return;
          event.preventDefault();
          replyAfterClose.current = false;
          window.requestAnimationFrame(() => onReply(message));
        }}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest(".image-lightbox-image, .image-lightbox-footer")) {
            return;
          }
          setOpen(false);
        }}
      >
        <DialogTitle className="sr-only">{fallbackText}</DialogTitle>
        <div className="image-lightbox-stage">
          <img className="image-lightbox-image" src={url} alt={fallbackText} />
        </div>
        <div className="image-lightbox-footer">
          {showReactions && (
            <div className="image-lightbox-reactions" aria-label="React">
              {reactions.map((reaction) => {
                const reactedByMe = message.reactions.some(
                  (item) => item.key === reaction && item.reactedByMe,
                );
                return (
                  <Button
                    variant={reactedByMe ? "secondary" : "ghost"}
                    size="icon"
                    key={reaction}
                    aria-label={`React with ${reaction}`}
                    onClick={() => {
                      void onReact(message, reactedByMe ? undefined : reaction);
                      setShowReactions(false);
                    }}
                  >
                    {reaction}
                  </Button>
                );
              })}
            </div>
          )}
          <div className="image-lightbox-actions">
            <Button
              variant="outline"
              onClick={() => setShowReactions((visible) => !visible)}
              aria-expanded={showReactions}
            >
              <SmilePlus /> React
            </Button>
            <Button variant="outline" onClick={closeAndReply}>
              <Reply /> Reply
            </Button>
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
