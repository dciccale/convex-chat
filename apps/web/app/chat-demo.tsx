"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import {
  FormEvent,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../convex/_generated/api";
import {
  type DemoMessage,
  MessageBubble,
  messagePreview,
} from "./message-bubble";
import { subjects, type Subject } from "./subjects";
import { useChatPresence } from "./use-chat-presence";

export function ChatDemo({ initialSubjectId }: { initialSubjectId: Subject }) {
  const router = useRouter();
  const pathname = usePathname();
  const [subjectId, setSubjectId] = useState<Subject>(initialSubjectId);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<DemoMessage | null>(null);
  const [editing, setEditing] = useState<DemoMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const composerInput = useRef<HTMLInputElement>(null);
  const [booting, setBooting] = useState(true);
  const ensureDemo = useMutation(api.chat.ensureDemo);
  const sendText = useMutation(api.chat.sendText);
  const editMessage = useMutation(api.chat.editMessage);
  const setReaction = useMutation(api.chat.setReaction);
  const deleteMessage = useMutation(api.attachments.deleteMessage);
  const generateImageUploadUrl = useMutation(
    api.attachments.generateImageUploadUrl,
  );
  const commitImage = useAction(api.attachments.commitImage);
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

  useEffect(() => {
    ensureDemo().finally(() => setBooting(false));
  }, [ensureDemo]);

  useEffect(() => {
    setSubjectId(initialSubjectId);
    setConversationId(null);
  }, [initialSubjectId]);

  useEffect(() => {
    if (
      conversations?.length &&
      !conversations.some((conversation) => conversation.id === conversationId)
    ) {
      setConversationId(conversations[0].id);
    }
  }, [conversationId, conversations]);

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
        await sendText({
          subjectId,
          conversationId,
          clientMessageId: crypto.randomUUID(),
          text: value,
          replyToMessageId: replyTo?.id,
        });
        setReplyTo(null);
      }
      setText("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function uploadImage(file: File) {
    if (!conversationId) return;
    clearTyping();
    setUploading(true);
    setError(null);
    try {
      const upload = await generateImageUploadUrl({
        subjectId,
        conversationId,
        filename: file.name,
        mediaType: file.type,
        size: file.size,
      });
      const response = await fetch(upload.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      await commitImage({
        grantId: upload.grantId,
        subjectId,
        clientMessageId: crypto.randomUUID(),
        caption: text.trim() || undefined,
        replyToMessageId: replyTo?.id,
      });
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">c</span>
          <div>
            <strong>convex-chat</strong>
            <span>first vertical slice</span>
          </div>
        </div>
        <label className="identity-picker">
          <span>Viewing as</span>
          <select
            value={subjectId}
            onChange={(event) => {
              clearTyping();
              const subject = event.target.value as Subject;
              setSubjectId(subject);
              setConversationId(null);
              setReplyTo(null);
              setEditing(null);
              setText("");
              setError(null);

              const params = new URLSearchParams(window.location.search);
              params.set("as", subject);
              const query = params.toString();
              router.replace(
                `${pathname}${query ? `?${query}` : ""}${window.location.hash}`,
                { scroll: false },
              );
            }}
          >
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {capitalize(subject)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="demo-warning">
        The identity switcher is intentionally insecure demo plumbing.
        Production apps derive identity from authenticated host functions.
      </section>

      <div className="chat-grid">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <span>Conversations</span>
            <span className="live-dot">live</span>
          </div>
          {booting || conversations === undefined ? (
            <p className="muted">Preparing the demo…</p>
          ) : (
            conversations.map((conversation) => {
              const label =
                conversation.title ??
                conversation.memberSubjectIds
                  .filter((member) => member !== subjectId)
                  .map(capitalize)
                  .join(", ");
              return (
                <button
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
                  <span className="avatar">{label.slice(0, 1)}</span>
                  <span className="conversation-copy">
                    <strong>{label}</strong>
                    <small>
                      {conversation.lastMessagePreview ?? "No messages yet"}
                    </small>
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="unread">{conversation.unreadCount}</span>
                  )}
                </button>
              );
            })
          )}
        </aside>

        <section className="chat-panel">
          {activeConversation ? (
            <>
              <div className="chat-heading">
                <div>
                  <span className="eyebrow">{activeConversation.kind}</span>
                  <h1>
                    {activeConversation.title ??
                      activeConversation.memberSubjectIds
                        .filter((member) => member !== subjectId)
                        .map(capitalize)
                        .join(", ")}
                  </h1>
                </div>
                <span
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
                </span>
              </div>

              <div className="message-list">
                {messages?.length === 0 && (
                  <div className="empty-state">
                    <span>✦</span>
                    <h2>Start the conversation</h2>
                    <p>Messages are ordered and synchronized through Convex.</p>
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
                        onReply={(selected) => {
                          setEditing(null);
                          setReplyTo(selected);
                          composerInput.current?.focus();
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
                    <button
                      type="button"
                      aria-label="Cancel"
                      onClick={() => {
                        clearTyping();
                        setReplyTo(null);
                        setEditing(null);
                        setText("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                {error && <div className="composer-error">{error}</div>}
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
                  <button
                    className="attach-button"
                    type="button"
                    aria-label={uploading ? "Uploading image" : "Attach image"}
                    aria-busy={uploading}
                    disabled={uploading || Boolean(editing)}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploading ? (
                      <span className="upload-spinner" aria-hidden="true" />
                    ) : (
                      "+"
                    )}
                  </button>
                  <input
                    ref={composerInput}
                    aria-label="Message"
                    placeholder={
                      editing
                        ? "Edit message…"
                        : `Message as ${capitalize(subjectId)}…`
                    }
                    value={text}
                    onChange={(event) => {
                      const value = event.target.value;
                      setText(value);
                      if (value.trim()) noteTyping();
                      else clearTyping();
                    }}
                  />
                  <button disabled={!text.trim()} type="submit">
                    {editing ? "Save" : "Send"} <span>↗</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="empty-state centered">
              <span>✦</span>
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
