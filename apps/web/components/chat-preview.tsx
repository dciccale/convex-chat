"use client";

import { CheckCheck, Mic, MoreHorizontal, Paperclip, Send } from "lucide-react";
import NextImage from "next/image";
import { type FormEvent, useEffect, useRef, useState } from "react";

type PreviewMessage = {
  id: number;
  text: string;
  time: string;
};

export function ChatPreview() {
  const [hasHearted, setHasHearted] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<PreviewMessage[]>([]);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) return;

    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        text,
        time: new Intl.DateTimeFormat(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
      },
    ]);
    setDraft("");
  }

  return (
    <div
      className="chat-preview"
      aria-label="Preview of a realtime group conversation"
    >
      <div className="preview-topbar">
        <div className="preview-avatar">A</div>
        <div>
          <strong>Weekend plans</strong>
          <span>
            <i /> 3 members online
          </span>
        </div>
        <MoreHorizontal />
      </div>
      <div className="preview-messages" ref={messageListRef}>
        <div className="preview-date">TODAY</div>
        <div className="preview-row">
          <div className="tiny-avatar coral">B</div>
          <div className="bubble received">
            <b>Bob</b>
            <p>Found a quiet spot by the coast for Saturday.</p>
            <time>10:24</time>
          </div>
        </div>
        <div className="bubble sent">
          <div className="quoted">
            <b>Bob</b>
            <span>Found a quiet spot by the coast…</span>
          </div>
          <p>Perfect. I&apos;ll bring lunch 🌊</p>
          <time>
            10:26 <CheckCheck />
          </time>
          <button
            className="reaction"
            type="button"
            aria-label={
              hasHearted ? "Remove heart reaction" : "Add heart reaction"
            }
            aria-pressed={hasHearted}
            onClick={() => setHasHearted((current) => !current)}
          >
            <span aria-hidden="true">❤️</span> {hasHearted ? 3 : 2}
          </button>
        </div>
        <div className="preview-row">
          <div className="tiny-avatar violet">C</div>
          <div className="bubble received media">
            <b>Charlie</b>
            <NextImage
              className="preview-photo"
              src="/chat-cove.svg"
              alt="An illustrated Mediterranean cove with a small red boat"
              width={400}
              height={180}
              sizes="200px"
            />
            <p>This is the place.</p>
            <time>10:28</time>
          </div>
        </div>
        <div className="typing">
          <span>
            <i />
            <i />
            <i />
          </span>{" "}
          Bob is typing
        </div>
        {messages.map((message) => (
          <div className="bubble sent preview-new-message" key={message.id}>
            <p>{message.text}</p>
            <time>
              {message.time} <CheckCheck />
            </time>
          </div>
        ))}
      </div>
      <form className="preview-composer" onSubmit={sendMessage}>
        <button type="button" aria-label="Attach a file">
          <Paperclip />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Message"
          placeholder="Write a message…"
        />
        <button type="button" aria-label="Record a voice message">
          <Mic />
        </button>
        <button className="send" type="submit" aria-label="Send message">
          <Send />
        </button>
      </form>
    </div>
  );
}
