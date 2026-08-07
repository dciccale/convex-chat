# Presence and typing

`convex-chat` composes `@convex-dev/presence` as a child component. Presence is
ephemeral conversation state; it is not a message, read receipt, audit event,
or notification trigger.

The chat conversation ID is the presence room ID. Public component operations
require an active membership before they create a session, list a room, update
typing state, or disconnect. The child component manages per-tab sessions,
heartbeats, multi-session online aggregation, and stale-session expiry.

## Component API

- `presence.heartbeat` creates or refreshes a session and returns room and
  session capability tokens. Heartbeat intervals must be between 5 and 60
  seconds.
- `presence.list` returns up to 100 small-room participants with `online`,
  `lastDisconnected`, and `typing` state.
- `presence.setTyping` stores the versioned presence data
  `{ version: 1, typing }` for a participant.
- `presence.disconnect` closes one session. A subject remains online while any
  of their sessions is still active.

`exposeChatApi` provides actor-derived host wrappers for all four operations.
Hosts should omit these wrappers when their product disables presence. More
granular privacy policy, such as hiding last-active state, belongs in the host
application and does not change the component's durable message model.

## Client behavior

The web example demonstrates a 10-second heartbeat, best-effort disconnect on
visibility changes and page unload, a 1.2-second typing idle timeout, direct-chat
online state, group online counts, and multi-user typing labels.

Typing is deliberately best-effort. Clients must only render typing for an
online participant, so a disconnected client cannot leave a permanent typing
indicator.
