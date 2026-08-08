/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    conversations: {
      create: FunctionReference<
        "mutation",
        "internal",
        {
          createdBySubjectId: string;
          externalKey?: string;
          kind: "direct" | "group";
          memberSubjectIds: Array<string>;
          scopeId: string;
          title?: string;
        },
        { created: boolean; id: string },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        { limit?: number; scopeId: string; subjectId: string },
        Array<{
          id: string;
          kind: "direct" | "group";
          lastMessageAt?: number;
          lastMessagePreview?: string;
          memberSubjectIds: Array<string>;
          state: "active" | "archived" | "deleting";
          title?: string;
          unreadCount: number;
          updatedAt: number;
        }>,
        Name
      >;
    };
    messages: {
      assertCanWrite: FunctionReference<
        "query",
        "internal",
        { conversationId: string; scopeId: string; subjectId: string },
        null,
        Name
      >;
      deleteOwnMessage: FunctionReference<
        "mutation",
        "internal",
        {
          expectedRevision: number;
          messageId: string;
          scopeId: string;
          subjectId: string;
        },
        {
          attachmentStorageKeys: Array<string>;
          message: {
            authorSubjectId?: string;
            createdAt: number;
            editedAt?: number;
            id: string;
            parts: Array<
              | { id: string; text: string; type: "text" }
              | {
                  data: any;
                  dataType: string;
                  fallbackText: string;
                  id: string;
                  schemaVersion: number;
                  type: "data";
                }
              | {
                  data: any;
                  eventType: string;
                  fallbackText: string;
                  id: string;
                  schemaVersion: number;
                  type: "system";
                }
              | {
                  durationMs?: number;
                  fallbackText: string;
                  filename: string;
                  height?: number;
                  id: string;
                  mediaType: string;
                  size: number;
                  storageKey: string;
                  storageProvider: string;
                  type: "attachment";
                  width?: number;
                }
            >;
            reactions: Array<{
              count: number;
              key: string;
              reactedByMe: boolean;
            }>;
            redactedAt?: number;
            reply?: {
              authorSubjectId?: string;
              fallbackText?: string;
              messageId: string;
              sourceDeleted: boolean;
              sourceRevision: number;
            };
            revision: number;
            sequence: number;
            status: "published" | "redacted";
          };
        },
        Name
      >;
      editOwnTextPart: FunctionReference<
        "mutation",
        "internal",
        {
          expectedRevision: number;
          messageId: string;
          partId: string;
          scopeId: string;
          subjectId: string;
          text: string;
        },
        {
          authorSubjectId?: string;
          createdAt: number;
          editedAt?: number;
          id: string;
          parts: Array<
            | { id: string; text: string; type: "text" }
            | {
                data: any;
                dataType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "data";
              }
            | {
                data: any;
                eventType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "system";
              }
            | {
                durationMs?: number;
                fallbackText: string;
                filename: string;
                height?: number;
                id: string;
                mediaType: string;
                size: number;
                storageKey: string;
                storageProvider: string;
                type: "attachment";
                width?: number;
              }
          >;
          reactions: Array<{
            count: number;
            key: string;
            reactedByMe: boolean;
          }>;
          redactedAt?: number;
          reply?: {
            authorSubjectId?: string;
            fallbackText?: string;
            messageId: string;
            sourceDeleted: boolean;
            sourceRevision: number;
          };
          revision: number;
          sequence: number;
          status: "published" | "redacted";
        },
        Name
      >;
      getAttachment: FunctionReference<
        "query",
        "internal",
        {
          messageId: string;
          partId: string;
          scopeId: string;
          subjectId: string;
        },
        {
          filename: string;
          mediaType: string;
          storageKey: string;
          storageProvider: string;
        },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          beforeSequence?: number;
          conversationId: string;
          limit?: number;
          scopeId: string;
          subjectId: string;
        },
        Array<{
          authorSubjectId?: string;
          createdAt: number;
          editedAt?: number;
          id: string;
          parts: Array<
            | { id: string; text: string; type: "text" }
            | {
                data: any;
                dataType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "data";
              }
            | {
                data: any;
                eventType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "system";
              }
            | {
                durationMs?: number;
                fallbackText: string;
                filename: string;
                height?: number;
                id: string;
                mediaType: string;
                size: number;
                storageKey: string;
                storageProvider: string;
                type: "attachment";
                width?: number;
              }
          >;
          reactions: Array<{
            count: number;
            key: string;
            reactedByMe: boolean;
          }>;
          redactedAt?: number;
          reply?: {
            authorSubjectId?: string;
            fallbackText?: string;
            messageId: string;
            sourceDeleted: boolean;
            sourceRevision: number;
          };
          revision: number;
          sequence: number;
          status: "published" | "redacted";
        }>,
        Name
      >;
      markReadThrough: FunctionReference<
        "mutation",
        "internal",
        {
          conversationId: string;
          scopeId: string;
          sequence: number;
          subjectId: string;
        },
        { sequence: number; unreadOrdinal: number },
        Name
      >;
      sendAttachment: FunctionReference<
        "mutation",
        "internal",
        {
          attachment: {
            durationMs?: number;
            fallbackText: string;
            filename: string;
            height?: number;
            mediaType: string;
            size: number;
            storageKey: string;
            storageProvider: string;
            width?: number;
          };
          caption?: string;
          clientMessageId: string;
          conversationId: string;
          replyToMessageId?: string;
          scopeId: string;
          subjectId: string;
        },
        {
          authorSubjectId?: string;
          createdAt: number;
          editedAt?: number;
          id: string;
          parts: Array<
            | { id: string; text: string; type: "text" }
            | {
                data: any;
                dataType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "data";
              }
            | {
                data: any;
                eventType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "system";
              }
            | {
                durationMs?: number;
                fallbackText: string;
                filename: string;
                height?: number;
                id: string;
                mediaType: string;
                size: number;
                storageKey: string;
                storageProvider: string;
                type: "attachment";
                width?: number;
              }
          >;
          reactions: Array<{
            count: number;
            key: string;
            reactedByMe: boolean;
          }>;
          redactedAt?: number;
          reply?: {
            authorSubjectId?: string;
            fallbackText?: string;
            messageId: string;
            sourceDeleted: boolean;
            sourceRevision: number;
          };
          revision: number;
          sequence: number;
          status: "published" | "redacted";
        },
        Name
      >;
      sendText: FunctionReference<
        "mutation",
        "internal",
        {
          clientMessageId: string;
          conversationId: string;
          replyToMessageId?: string;
          scopeId: string;
          subjectId: string;
          text: string;
        },
        {
          authorSubjectId?: string;
          createdAt: number;
          editedAt?: number;
          id: string;
          parts: Array<
            | { id: string; text: string; type: "text" }
            | {
                data: any;
                dataType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "data";
              }
            | {
                data: any;
                eventType: string;
                fallbackText: string;
                id: string;
                schemaVersion: number;
                type: "system";
              }
            | {
                durationMs?: number;
                fallbackText: string;
                filename: string;
                height?: number;
                id: string;
                mediaType: string;
                size: number;
                storageKey: string;
                storageProvider: string;
                type: "attachment";
                width?: number;
              }
          >;
          reactions: Array<{
            count: number;
            key: string;
            reactedByMe: boolean;
          }>;
          redactedAt?: number;
          reply?: {
            authorSubjectId?: string;
            fallbackText?: string;
            messageId: string;
            sourceDeleted: boolean;
            sourceRevision: number;
          };
          revision: number;
          sequence: number;
          status: "published" | "redacted";
        },
        Name
      >;
      setReaction: FunctionReference<
        "mutation",
        "internal",
        {
          messageId: string;
          reactionKey?: string;
          scopeId: string;
          subjectId: string;
        },
        Array<{ count: number; key: string; reactedByMe: boolean }>,
        Name
      >;
    };
    presence: {
      disconnect: FunctionReference<
        "mutation",
        "internal",
        {
          conversationId: string;
          scopeId: string;
          sessionToken: string;
          subjectId: string;
        },
        null,
        Name
      >;
      disconnectOnline: FunctionReference<
        "mutation",
        "internal",
        { scopeId: string; sessionToken: string; subjectId: string },
        null,
        Name
      >;
      heartbeat: FunctionReference<
        "mutation",
        "internal",
        {
          conversationId: string;
          interval: number;
          scopeId: string;
          sessionId: string;
          subjectId: string;
        },
        { roomToken: string; sessionToken: string },
        Name
      >;
      heartbeatOnline: FunctionReference<
        "mutation",
        "internal",
        {
          interval: number;
          scopeId: string;
          sessionId: string;
          subjectId: string;
        },
        { sessionToken: string },
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          conversationId: string;
          roomToken: string;
          scopeId: string;
          subjectId: string;
        },
        Array<{
          lastDisconnected: number;
          online: boolean;
          subjectId: string;
          typing: boolean;
        }>,
        Name
      >;
      listOnline: FunctionReference<
        "query",
        "internal",
        { conversationId: string; scopeId: string; subjectId: string },
        Array<{
          lastDisconnected?: number;
          online: boolean;
          subjectId: string;
        }>,
        Name
      >;
      setTyping: FunctionReference<
        "mutation",
        "internal",
        {
          conversationId: string;
          scopeId: string;
          subjectId: string;
          typing: boolean;
        },
        null,
        Name
      >;
    };
  };
