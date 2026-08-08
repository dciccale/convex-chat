"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  ImagePlus,
  LoaderCircle,
  MessageCircleMore,
  MessagesSquare,
  Mic,
  Send,
  ShieldAlert,
  UsersRound,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  FormEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@convex-chat/example-backend/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type DemoMessage,
  MessageBubble,
  messagePreview,
} from "./message-bubble";
import { buildDemoUrl } from "./demo-url";
import { isSubject, subjects, type Subject } from "./subjects";
import {
  audioFileExtension,
  formatRecordingDuration,
  useAudioRecorder,
} from "./use-audio-recorder";
import { useChatPresence } from "./use-chat-presence";

export function ChatDemo({
  initialConversationId,
  initialSubjectId,
}: {
  initialConversationId: string | null;
  initialSubjectId: Subject;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [subjectId, setSubjectId] = useState<Subject>(initialSubjectId);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DemoMessage | null>(null);
  const [editing, setEditing] = useState<DemoMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const composerInput = useRef<HTMLInputElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const lastOpenedConversation = useRef<string | null>(null);
  const pinConversationToBottom = useRef(false);
  const [booting, setBooting] = useState(true);
  const ensureDemo = useMutation(api.chat.ensureDemo);
  const sendText = useMutation(api.chat.sendText);
  const editMessage = useMutation(api.chat.editMessage);
  const setReaction = useMutation(api.chat.setReaction);
  const deleteMessage = useMutation(api.attachments.deleteMessage);
  const generateAttachmentUploadUrl = useMutation(
    api.attachments.generateAttachmentUploadUrl,
  );
  const commitAttachment = useAction(api.attachments.commitAttachment);
  const markRead = useMutation(api.chat.markReadThrough);
  const conversations = useQuery(api.chat.listConversations, { subjectId });
  const messages = useQuery(
    api.chat.listMessages,
    conversationId ? { subjectId, conversationId } : "skip",
  );
  const { presence, noteTyping, clearTyping } = useChatPresence({
    subjectId,
    conversationId,
  });
  const activeConversation = useMemo(
    () =>
      conversations?.find((conversation) => conversation.id === conversationId),
    [conversationId, conversations],
  );
  const onlineOthers =
    presence?.filter(
      (entry) => entry.online && entry.subjectId !== subjectId,
    ) ?? [];
  const typingSubjects = onlineOthers
    .filter((entry) => entry.typing)
    .map((entry) => capitalize(entry.subjectId));
  const {
    cancel: cancelAudioRecording,
    elapsedMs: recordingElapsedMs,
    start: startAudioRecording,
    status: audioRecordingStatus,
    stop: stopAudioRecording,
  } = useAudioRecorder({
    onError: (cause) => setError(recordingErrorMessage(cause)),
    onRecorded: uploadAudio,
  });

  useEffect(() => {
    ensureDemo().finally(() => setBooting(false));
  }, [ensureDemo]);

  useEffect(() => {
    setSubjectId(initialSubjectId);
    setConversationId(initialConversationId);
  }, [initialConversationId, initialSubjectId]);

  useEffect(() => {
    if (conversations === undefined) return;
    const nextConversationId = conversations.some(
      (conversation) => conversation.id === conversationId,
    )
      ? conversationId
      : (conversations[0]?.id ?? null);
    if (nextConversationId !== conversationId) {
      setConversationId(nextConversationId);
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    const nextUrl = buildDemoUrl({
      conversationId,
      hash: window.location.hash,
      pathname,
      search: window.location.search,
      subjectId,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [conversationId, pathname, router, subjectId]);

  useEffect(() => {
    const last = messages?.at(-1);
    if (conversationId && last && activeConversation?.unreadCount) {
      void markRead({ subjectId, conversationId, sequence: last.sequence });
    }
  }, [
    activeConversation?.unreadCount,
    conversationId,
    markRead,
    messages,
    subjectId,
  ]);

  useEffect(() => {
    cancelAudioRecording();
  }, [cancelAudioRecording, conversationId, subjectId]);

  useEffect(() => {
    if (
      !conversationId ||
      messages === undefined ||
      lastOpenedConversation.current === conversationId
    ) {
      return;
    }
    pinConversationToBottom.current = true;
    const frame = window.requestAnimationFrame(() => {
      lastOpenedConversation.current = conversationId;
      scrollMessagesToBottom("auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversationId, messages]);

  useEffect(() => {
    if (
      !scrollToMessageId ||
      !messages?.some((message) => message.id === scrollToMessageId)
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      scrollMessagesToBottom();
      setScrollToMessageId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, scrollToMessageId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || !conversationId) return;
    setError(null);
    try {
      if (editing) {
        clearTyping();
        await editMessage({
          subjectId,
          messageId: editing.id,
          partId:
            editing.parts.find((part) => part.type === "text")?.id ?? "text",
          expectedRevision: editing.revision,
          text: value,
        });
        setEditing(null);
      } else {
        clearTyping();
        pinConversationToBottom.current = true;
        scrollMessagesToBottom();
        const message = await sendText({
          subjectId,
          conversationId,
          clientMessageId: crypto.randomUUID(),
          text: value,
          replyToMessageId: replyTo?.id,
        });
        setScrollToMessageId(message.id);
        setReplyTo(null);
      }
      setText("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function uploadAttachment(
    file: Blob,
    filename: string,
    durationMs?: number,
  ) {
    if (!conversationId) return;
    clearTyping();
    setUploading(true);
    setError(null);
    try {
      const upload = await generateAttachmentUploadUrl({
        subjectId,
        conversationId,
        filename,
        mediaType: file.type,
        size: file.size,
        durationMs,
      });
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      pinConversationToBottom.current = true;
      scrollMessagesToBottom();
      const { messageId } = await commitAttachment({
        grantId: upload.grantId,
        subjectId,
        clientMessageId: crypto.randomUUID(),
        caption: text.trim() || undefined,
        replyToMessageId: replyTo?.id,
      });
      setScrollToMessageId(messageId);
      setText("");
      setReplyTo(null);
    } catch (cause) {
      setError(
        `${errorMessage(cause)} Check the R2 Convex environment and bucket CORS configuration.`,
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function uploadAudio(audio: Blob, durationMs: number) {
    const extension = audioFileExtension(audio.type);
    await uploadAttachment(
      audio,
      `voice-message-${Date.now()}.${extension}`,
      durationMs,
    );
  }

  async function uploadImage(file: File) {
    await uploadAttachment(file, file.name);
  }

  function changeSubject(value: string) {
    if (!isSubject(value)) return;
    clearTyping();
    setSubjectId(value);
    setConversationId(null);
    setReplyTo(null);
    setEditing(null);
    setText("");
    setError(null);
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = "smooth") {
    const list = messageList.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <MessageCircleMore />
          </span>
          <strong>convex-chat</strong>
        </div>
        <div className="identity-picker">
          <span>Demo identity</span>
          <Select value={subjectId} onValueChange={changeSubject}>
            <SelectTrigger aria-label="Viewing as">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {capitalize(subject)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="chat-grid">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="sidebar-kicker">Inbox</span>
              <h2>Conversations</h2>
            </div>
            <Badge variant="secondary">{conversations?.length ?? 0}</Badge>
          </div>
          <div className="conversation-list">
            {booting || conversations === undefined
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div className="conversation-skeleton" key={index}>
                    <Skeleton className="skeleton-avatar" />
                    <div>
                      <Skeleton className="skeleton-title" />
                      <Skeleton className="skeleton-preview" />
                    </div>
                  </div>
                ))
              : conversations.map((conversation) => {
                  const label =
                    conversation.title ??
                    conversation.memberSubjectIds
                      .filter((member) => member !== subjectId)
                      .map(capitalize)
                      .join(", ");
                  return (
                    <Button
                      variant="ghost"
                      className={`conversation ${conversation.id === conversationId ? "active" : ""}`}
                      key={conversation.id}
                      onClick={() => {
                        clearTyping();
                        setConversationId(conversation.id);
                        setReplyTo(null);
                        setEditing(null);
                        setText("");
                        setError(null);
                      }}
                    >
                      <Avatar className="conversation-avatar">
                        <AvatarFallback>{label.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <span className="conversation-copy">
                        <span className="conversation-title">
                          <strong>{label}</strong>
                          <small>{conversation.kind}</small>
                        </span>
                        <span className="conversation-preview">
                          {conversation.lastMessagePreview ?? "No messages yet"}
                        </span>
                      </span>
                      {conversation.unreadCount > 0 && (
                        <Badge className="unread">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
          </div>
          <Alert className="demo-warning">
            <ShieldAlert />
            <AlertTitle>Demo identity</AlertTitle>
            <AlertDescription>
              Production apps derive identity from authenticated host functions.
            </AlertDescription>
          </Alert>
        </aside>

        <section className="chat-panel">
          {activeConversation ? (
            <>
              <div className="chat-heading">
                <div className="chat-heading-identity">
                  <Avatar className="chat-avatar">
                    <AvatarFallback>
                      {(
                        activeConversation.title ??
                        activeConversation.memberSubjectIds
                          .filter((member) => member !== subjectId)
                          .map(capitalize)
                          .join(", ")
                      ).slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1>
                      {activeConversation.title ??
                        activeConversation.memberSubjectIds
                          .filter((member) => member !== subjectId)
                          .map(capitalize)
                          .join(", ")}
                    </h1>
                    <span className="conversation-members">
                      <UsersRound />
                      {activeConversation.kind === "direct"
                        ? "Direct conversation"
                        : `${activeConversation.memberSubjectIds.length} members`}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`member-count ${onlineOthers.length > 0 ? "online" : ""}`}
                >
                  <span className="presence-dot" aria-hidden="true" />
                  {presence === undefined
                    ? "Connecting…"
                    : activeConversation.kind === "direct"
                      ? onlineOthers.length > 0
                        ? "Online"
                        : "Offline"
                      : `${presence.filter((entry) => entry.online).length} online · ${activeConversation.memberSubjectIds.length} members`}
                </Badge>
              </div>

              <div
                className="message-list"
                ref={messageList}
                onLoadCapture={(event) => {
                  if (
                    pinConversationToBottom.current &&
                    event.target instanceof HTMLImageElement
                  ) {
                    window.requestAnimationFrame(() =>
                      scrollMessagesToBottom("auto"),
                    );
                  }
                }}
                onPointerDown={() => {
                  pinConversationToBottom.current = false;
                }}
                onTouchMove={() => {
                  pinConversationToBottom.current = false;
                }}
                onWheel={() => {
                  pinConversationToBottom.current = false;
                }}
              >
                {messages?.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <MessagesSquare />
                    </span>
                    <h2>Start the conversation</h2>
                    <p>Send a message and watch it sync through Convex.</p>
                  </div>
                )}
                {messages?.map((message, index) => {
                  const previous = messages[index - 1];
                  const showDate =
                    !previous ||
                    dateKey(previous.createdAt) !== dateKey(message.createdAt);
                  return (
                    <Fragment key={message.id}>
                      {showDate && (
                        <div className="date-separator">
                          {formatMessageDate(message.createdAt)}
                        </div>
                      )}
                      <MessageBubble
                        message={message}
                        subjectId={subjectId}
                        showAuthor={activeConversation.kind === "group"}
                        onReply={(selected) => {
                          setEditing(null);
                          setReplyTo(selected);
                          window.requestAnimationFrame(() =>
                            composerInput.current?.focus(),
                          );
                        }}
                        onEdit={(selected) => {
                          const caption = selected.parts.find(
                            (part) => part.type === "text",
                          );
                          setReplyTo(null);
                          setEditing(selected);
                          setText(caption?.type === "text" ? caption.text : "");
                        }}
                        onDelete={async (selected) => {
                          setError(null);
                          try {
                            await deleteMessage({
                              subjectId,
                              messageId: selected.id,
                              expectedRevision: selected.revision,
                            });
                          } catch (cause) {
                            setError(errorMessage(cause));
                          }
                        }}
                        onReact={async (selected, reactionKey) => {
                          setError(null);
                          try {
                            await setReaction({
                              subjectId,
                              messageId: selected.id,
                              reactionKey,
                            });
                          } catch (cause) {
                            setError(errorMessage(cause));
                          }
                        }}
                      />
                    </Fragment>
                  );
                })}
              </div>

              <div className="composer-shell">
                {typingSubjects.length > 0 && (
                  <div className="typing-indicator" aria-live="polite">
                    <span aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    {formatTypingLabel(typingSubjects)}
                  </div>
                )}
                {(replyTo || editing) && (
                  <div className="composer-context">
                    <div>
                      <strong>
                        {editing ? "Editing message" : "Replying to"}
                      </strong>
                      <span>
                        {editing
                          ? messagePreview(editing)
                          : `${capitalize(replyTo?.authorSubjectId ?? "system")}: ${replyTo ? messagePreview(replyTo) : ""}`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      type="button"
                      aria-label="Cancel"
                      onClick={() => {
                        clearTyping();
                        setReplyTo(null);
                        setEditing(null);
                        setText("");
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                )}
                {error && (
                  <Alert variant="destructive" className="composer-error">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <form className="composer" onSubmit={submit}>
                  <input
                    ref={fileInput}
                    className="file-input"
                    type="file"
                    accept="image/*"
                    aria-label="Attach image"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file);
                    }}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="attach-button"
                        variant="outline"
                        size="icon-lg"
                        type="button"
                        aria-label={
                          uploading ? "Uploading image" : "Attach image"
                        }
                        aria-busy={uploading}
                        disabled={
                          uploading ||
                          Boolean(editing) ||
                          audioRecordingStatus !== "idle"
                        }
                        onClick={() => fileInput.current?.click()}
                      >
                        {uploading ? (
                          <LoaderCircle className="upload-spinner" />
                        ) : (
                          <ImagePlus />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Attach image</TooltipContent>
                  </Tooltip>
                  <Input
                    ref={composerInput}
                    aria-label="Message"
                    placeholder={
                      audioRecordingStatus === "recording"
                        ? "Recording voice message…"
                        : editing
                          ? "Edit message…"
                          : `Message as ${capitalize(subjectId)}…`
                    }
                    disabled={audioRecordingStatus !== "idle" || uploading}
                    value={text}
                    onChange={(event) => {
                      const value = event.target.value;
                      setText(value);
                      if (value.trim()) noteTyping();
                      else clearTyping();
                    }}
                  />
                  {(!text.trim() || audioRecordingStatus !== "idle") &&
                    !editing && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className={`record-button ${audioRecordingStatus === "recording" ? "recording" : ""}`}
                            variant="outline"
                            size={
                              audioRecordingStatus === "recording"
                                ? "default"
                                : "icon-lg"
                            }
                            type="button"
                            aria-label={
                              audioRecordingStatus === "recording"
                                ? "Stop and send voice message"
                                : audioRecordingStatus === "requesting"
                                  ? "Requesting microphone access"
                                  : "Record voice message"
                            }
                            aria-pressed={audioRecordingStatus === "recording"}
                            disabled={
                              uploading || audioRecordingStatus === "requesting"
                            }
                            onClick={() => {
                              clearTyping();
                              if (audioRecordingStatus === "recording") {
                                stopAudioRecording();
                              } else {
                                setError(null);
                                void startAudioRecording();
                              }
                            }}
                          >
                            {audioRecordingStatus === "requesting" ||
                            uploading ? (
                              <LoaderCircle className="upload-spinner" />
                            ) : audioRecordingStatus === "recording" ? (
                              <>
                                <span
                                  className="recording-dot"
                                  aria-hidden="true"
                                />
                                {formatRecordingDuration(recordingElapsedMs)}
                              </>
                            ) : (
                              <Mic />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {audioRecordingStatus === "recording"
                            ? "Send voice message"
                            : "Record voice message"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  {(text.trim() || editing) && (
                    <Button
                      disabled={
                        !text.trim() ||
                        uploading ||
                        audioRecordingStatus !== "idle"
                      }
                      type="submit"
                    >
                      {editing ? "Save" : "Send"} <Send />
                    </Button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="empty-state centered">
              <span className="empty-icon">
                <MessagesSquare />
              </span>
              <h2>Select a conversation</h2>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTypingLabel(subjects: string[]) {
  if (subjects.length === 1) return `${subjects[0]} is typing…`;
  if (subjects.length === 2) {
    return `${subjects[0]} and ${subjects[1]} are typing…`;
  }
  return `${subjects[0]} and ${subjects.length - 1} others are typing…`;
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dateKey(timestamp) === dateKey(today.getTime())) return "Today";
  if (dateKey(timestamp) === dateKey(yesterday.getTime())) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Something went wrong";
}

function recordingErrorMessage(cause: unknown) {
  if (cause instanceof Error && cause.name === "NotAllowedError") {
    return "Microphone access was denied. Allow it in your browser settings to record audio.";
  }
  if (cause instanceof Error && cause.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  return errorMessage(cause);
}
