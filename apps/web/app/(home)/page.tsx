import {
  ArrowRight,
  AtSign,
  Check,
  CircleDot,
  DatabaseZap,
  Fingerprint,
  MessageCircleMore,
  Radio,
  Reply,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { ChatPreview } from "@/components/chat-preview";

const features = [
  {
    icon: ShieldCheck,
    title: "Authorization at the boundary",
    description:
      "Host functions derive identity; the component independently enforces conversation membership.",
  },
  {
    icon: DatabaseZap,
    title: "Durable chat invariants",
    description:
      "Ordered, idempotent sends, monotonic read watermarks, and revision-safe message updates.",
  },
  {
    icon: Radio,
    title: "Reactive by default",
    description:
      "Conversations, unread counts, presence, typing, replies, and reactions update through Convex.",
  },
];

const capabilities = [
  "Direct and small-group conversations",
  "Replies, edits, tombstones, and reactions",
  "Online presence and typing indicators",
  "Provider-neutral attachment metadata",
];

export default function HomePage() {
  return (
    <main className="marketing-shell flex flex-1 flex-col">
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-glow hero-glow-one" aria-hidden="true" />
        <div className="hero-glow hero-glow-two" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">
              <CircleDot /> Open source · stable
            </div>
            <h1>
              Chat primitives
              <br />
              <span>built for Convex.</span>
            </h1>
            <p className="hero-lede">
              The authorization-aware component for direct and small-group
              messaging—without importing your app&apos;s identity model or
              product policy.
            </p>
            <div className="hero-actions">
              <Link className="primary-action" href="/docs">
                Get started <ArrowRight />
              </Link>
              <a
                className="secondary-action"
                href="https://github.com/dciccale/convex-chat"
              >
                View on GitHub
              </a>
            </div>
            <div className="install-command">
              <span>$</span>
              <code>pnpm add convex-chat convex</code>
            </div>
          </div>
          <ChatPreview />
        </div>
      </section>

      <section className="signal-strip">
        <span>
          <Fingerprint /> Host-owned identity
        </span>
        <span>
          <AtSign /> Opaque subject IDs
        </span>
        <span>
          <MessageCircleMore /> Human-first messaging
        </span>
        <span>
          <Reply /> Stable message relations
        </span>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <p>Small surface. Strong guarantees.</p>
          <h2>
            Your application decides who can talk.
            <br />
            convex-chat keeps the conversation correct.
          </h2>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => (
            <article key={feature.title}>
              <div className="feature-number">0{index + 1}</div>
              <feature.icon />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-band">
        <div className="architecture-copy">
          <p className="section-kicker">Clear ownership boundaries</p>
          <h2>
            Bring your users.
            <br />
            Keep your policy.
          </h2>
          <p>
            convex-chat owns reusable chat state. Authentication, relationships,
            tenancy, moderation, and business rules stay in the host application
            where they belong.
          </p>
          <Link href="/docs/concepts/architecture">
            Explore the architecture <ArrowRight />
          </Link>
        </div>
        <div
          className="boundary-diagram"
          aria-label="Application and convex-chat ownership boundary"
        >
          <div className="boundary-app">
            <span>Your application</span>
            <div>Authentication</div>
            <div>Relationships</div>
            <div>Product policy</div>
          </div>
          <div className="boundary-line">
            <span>actor</span>
          </div>
          <div className="boundary-component">
            <span>convex-chat</span>
            <div>Membership</div>
            <div>Message order</div>
            <div>Unread state</div>
          </div>
        </div>
      </section>

      <section className="capabilities-section">
        <div>
          <p className="section-kicker">The useful core</p>
          <h2>
            Everything a conversation needs.
            <br />
            Nothing your product should own.
          </h2>
        </div>
        <div className="capability-list">
          {capabilities.map((capability) => (
            <div key={capability}>
              <Check /> {capability}
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-mark">
          <MessageCircleMore />
        </div>
        <h2>
          Build the product.
          <br />
          Don&apos;t rebuild chat.
        </h2>
        <p>
          Start with the example, then adapt the host boundary to your
          application.
        </p>
        <div className="hero-actions">
          <Link
            className="primary-action"
            href="/docs/getting-started/installation"
          >
            Read the installation guide <ArrowRight />
          </Link>
          <a
            className="secondary-action"
            href="https://github.com/dciccale/convex-chat/tree/main/apps/example"
          >
            Browse the example
          </a>
        </div>
      </section>
    </main>
  );
}
