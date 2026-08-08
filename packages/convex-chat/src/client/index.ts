import { mutationGeneric, queryGeneric } from "convex/server";
import type {
  Auth,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { v } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import { attachmentDescriptor } from "../component/validators.js";

export type ChatAttachment = {
  storageProvider: string;
  storageKey: string;
  mediaType: string;
  filename: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
  fallbackText: string;
};

type AuthContext = { auth: Auth };

/**
 * Exposes actor-scoped host functions while keeping identity derivation in the
 * host application. Never accept subjectId from an untrusted browser here.
 */
export function exposeChatApi(
  component: ComponentApi,
  options: {
    authenticate: (
      ctx: AuthContext,
    ) => Promise<{ scopeId: string; subjectId: string }>;
  },
) {
  return {
    listConversations: queryGeneric({
      args: {},
      handler: async (ctx) => {
        const actor = await options.authenticate(ctx);
        return ctx.runQuery(component.conversations.list, actor);
      },
    }),
    listMessages: queryGeneric({
      args: { conversationId: v.string() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runQuery(component.messages.list, { ...actor, ...args });
      },
    }),
    listPresence: queryGeneric({
      args: { conversationId: v.string(), roomToken: v.string() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runQuery(component.presence.list, { ...actor, ...args });
      },
    }),
    listOnline: queryGeneric({
      args: { conversationId: v.string() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runQuery(component.presence.listOnline, {
          ...actor,
          ...args,
        });
      },
    }),
    heartbeatOnline: mutationGeneric({
      args: { sessionId: v.string(), interval: v.number() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.presence.heartbeatOnline, {
          ...actor,
          ...args,
        });
      },
    }),
    disconnectOnline: mutationGeneric({
      args: { sessionToken: v.string() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.presence.disconnectOnline, {
          ...actor,
          ...args,
        });
      },
    }),
    heartbeatPresence: mutationGeneric({
      args: {
        conversationId: v.string(),
        sessionId: v.string(),
        interval: v.number(),
      },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.presence.heartbeat, {
          ...actor,
          ...args,
        });
      },
    }),
    setTyping: mutationGeneric({
      args: { conversationId: v.string(), typing: v.boolean() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.presence.setTyping, {
          ...actor,
          ...args,
        });
      },
    }),
    disconnectPresence: mutationGeneric({
      args: { conversationId: v.string(), sessionToken: v.string() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.presence.disconnect, {
          ...actor,
          ...args,
        });
      },
    }),
    sendText: mutationGeneric({
      args: {
        conversationId: v.string(),
        clientMessageId: v.string(),
        text: v.string(),
        replyToMessageId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.messages.sendText, {
          ...actor,
          ...args,
        });
      },
    }),
    sendAttachment: mutationGeneric({
      args: {
        conversationId: v.string(),
        clientMessageId: v.string(),
        attachment: attachmentDescriptor,
        caption: v.optional(v.string()),
        replyToMessageId: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.messages.sendAttachment, {
          ...actor,
          ...args,
        });
      },
    }),
    editOwnTextPart: mutationGeneric({
      args: {
        messageId: v.string(),
        partId: v.string(),
        expectedRevision: v.number(),
        text: v.string(),
      },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.messages.editOwnTextPart, {
          ...actor,
          ...args,
        });
      },
    }),
    deleteOwnMessage: mutationGeneric({
      args: { messageId: v.string(), expectedRevision: v.number() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.messages.deleteOwnMessage, {
          ...actor,
          ...args,
        });
      },
    }),
    setReaction: mutationGeneric({
      args: { messageId: v.string(), reactionKey: v.optional(v.string()) },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.messages.setReaction, {
          ...actor,
          ...args,
        });
      },
    }),
    markReadThrough: mutationGeneric({
      args: { conversationId: v.string(), sequence: v.number() },
      handler: async (ctx, args) => {
        const actor = await options.authenticate(ctx);
        return ctx.runMutation(component.messages.markReadThrough, {
          ...actor,
          ...args,
        });
      },
    }),
  };
}

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
