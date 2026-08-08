---
title: Presence and typing
description: Add membership-checked online and typing state to a conversation.
icon: Radio
---

`convex-chat` composes `@convex-dev/presence` as a child component. Presence is
ephemeral conversation state; it is not a message, read receipt, audit event,
or notification trigger.

Online and typing use separate presence scopes. Each visible app tab maintains
an app-level online session that survives conversation switches. The active
chat conversation ID is a second room used only for typing state. Public
component operations verify participation before creating sessions or exposing
another participant's status. The child component manages per-tab sessions,
heartbeats, multi-session online aggregation, and stale-session expiry.

## Component API

- `presence.heartbeatOnline` and `presence.disconnectOnline` maintain app-level
  availability. A subject is online while any visible app session remains
  connected.
- `presence.listOnline` returns app-level status only for active members of a
  conversation visible to the requesting member.
- `presence.heartbeat`, `presence.list`, and `presence.disconnect` maintain the
  active conversation room used for typing. Heartbeat intervals must be between
  5 and 60 seconds.
- `presence.setTyping` stores the versioned presence data
  `{ version: 1, typing }` for a participant.

`exposeChatApi` provides actor-derived host wrappers for these operations.
Hosts should omit these wrappers when their product disables presence. More
granular privacy policy, such as hiding last-active state, belongs in the host
application and does not change the component's durable message model.

## Client behavior

The runnable example demonstrates 10-second app and conversation heartbeats,
best-effort disconnect on visibility changes and page unload, a 1.2-second
typing idle timeout, direct-chat online state, group online counts, and
multi-user typing labels. Moving to another conversation clears typing in the
old conversation but keeps the subject online, matching WhatsApp's distinction
between app activity and conversation activity.

Typing is deliberately best-effort. Clients must only render typing for an
online participant, so a disconnected client cannot leave a permanent typing
indicator.
