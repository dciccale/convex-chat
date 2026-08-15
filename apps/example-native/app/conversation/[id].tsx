import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Edit3,
  ImagePlus,
  Mic,
  MoreVertical,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react-native";
import { Avatar } from "heroui-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@convex-chat/example-backend/api";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { useDemo } from "@/context/demo-context";
import { MessageBubble } from "@/components/message-bubble";
import { useNativePresence } from "@/hooks/use-native-presence";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import {
  attachmentUploadMediaType,
  conversationLabel,
  errorMessage,
  formatDuration,
  messagePreview,
  messageText,
  type DemoMessage,
} from "@/lib/chat";
import { capitalize } from "@/lib/subjects";

type AttachmentGrantId = FunctionArgs<
  typeof api.attachments.commitAttachment
>["grantId"];

type PendingAttachment = {
  clientMessageId: string;
  kind: "image" | "voice";
  uri: string;
  filename: string;
  mediaType: string;
  durationMs?: number;
  caption?: string;
  replyToMessageId?: string;
  grantId?: AttachmentGrantId;
  status: "sending" | "failed";
  error?: string;
};

export default function ConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { subjectId } = useDemo();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<DemoMessage | null>(null);
  const [replyTo, setReplyTo] = useState<DemoMessage | null>(null);
  const [editing, setEditing] = useState<DemoMessage | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [voiceGestureCancelled, setVoiceGestureCancelled] = useState(false);
  const listRef = useRef<FlatList<DemoMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const pinnedToBottom = useRef(true);
  const forceScrollToBottom = useRef(false);
  const anchorToBottomWhileKeyboardOpens = useRef(false);
  const voiceStartX = useRef(0);
  const voiceCancelledRef = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const conversations = useQuery(api.chat.listConversations, { subjectId });
  const messages = useQuery(
    api.chat.listMessages,
    conversationId ? { subjectId, conversationId } : "skip",
  );
  const activeConversation = conversations?.find(
    (conversation) => conversation.id === conversationId,
  );

  const sendText = useMutation(api.chat.sendText);
  const editMessage = useMutation(api.chat.editMessage);
  const setReaction = useMutation(api.chat.setReaction);
  const markRead = useMutation(api.chat.markReadThrough);
  const deleteMessage = useMutation(api.attachments.deleteMessage);
  const generateAttachmentUploadUrl = useMutation(
    api.attachments.generateAttachmentUploadUrl,
  );
  const commitAttachment = useAction(api.attachments.commitAttachment);
  const { clearTyping, noteTyping, presence } = useNativePresence({
    subjectId,
    conversationId,
  });

  const showHint = useCallback((message: string) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setHint(message);
    hintTimer.current = setTimeout(() => setHint(null), 1_800);
  }, []);

  const enqueueVoice = useCallback(
    async (uri: string, durationMs: number) => {
      const pending: PendingAttachment = {
        clientMessageId: Crypto.randomUUID(),
        kind: "voice",
        uri,
        filename: `voice-message-${Date.now()}.m4a`,
        mediaType: "audio/mp4",
        durationMs,
        replyToMessageId: replyTo?.id,
        status: "sending",
      };
      setPendingAttachment(pending);
      void sendPendingAttachment(pending);
    },
    // The reply target is captured in the queued item so a retry sends the
    // same logical message even if the composer state changes meanwhile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replyTo, subjectId, conversationId],
  );

  const voice = usePushToTalk({
    onError: (cause) => setError(errorMessage(cause)),
    onHint: showHint,
    onRecorded: enqueueVoice,
  });

  const onlineOthers =
    presence?.filter(
      (entry) => entry.online && entry.subjectId !== subjectId,
    ) ?? [];
  const typingNames = onlineOthers
    .filter((entry) => entry.typing)
    .map((entry) => capitalize(entry.subjectId));

  const bringMessageIntoView = useCallback(
    (messageId: string) => {
      const index =
        messages?.findIndex((message) => message.id === messageId) ?? -1;
      if (index < 0) return;
      listRef.current?.scrollToIndex({
        animated: true,
        index,
        viewPosition: 0.86,
      });
    },
    [messages],
  );

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const latestMessageId = messages?.at(-1)?.id;

  useEffect(() => {
    if (!forceScrollToBottom.current || !latestMessageId) return;
    const frame = requestAnimationFrame(() => scrollToBottom(false));
    const timer = setTimeout(() => {
      scrollToBottom(true);
      forceScrollToBottom.current = false;
    }, 100);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [latestMessageId, scrollToBottom]);

  useEffect(() => {
    const position = () => {
      if (editing) bringMessageIntoView(editing.id);
      else if (anchorToBottomWhileKeyboardOpens.current) scrollToBottom(false);
    };
    const shown = Keyboard.addListener("keyboardDidShow", position);
    const frame = Keyboard.addListener("keyboardDidChangeFrame", position);
    return () => {
      shown.remove();
      frame.remove();
    };
  }, [bringMessageIntoView, editing, scrollToBottom]);

  useEffect(() => {
    const last = messages?.at(-1);
    if (last && activeConversation?.unreadCount) {
      void markRead({ subjectId, conversationId, sequence: last.sequence });
    }
  }, [
    activeConversation?.unreadCount,
    conversationId,
    markRead,
    messages,
    subjectId,
  ]);

  const cancelEditing = useCallback(() => {
    if (!editing) return false;
    setEditing(null);
    setText("");
    setError(null);
    clearTyping();
    Keyboard.dismiss();
    return true;
  }, [clearTyping, editing]);

  const clearSelection = useCallback(() => {
    if (!selected) return false;
    setSelected(null);
    setOverflowOpen(false);
    return true;
  }, [selected]);

  const handleBack = useCallback(() => {
    if (cancelEditing()) return;
    if (clearSelection()) return;
    Keyboard.dismiss();
    router.back();
  }, [cancelEditing, clearSelection, router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (editing) {
          cancelEditing();
          return true;
        }
        if (selected) {
          clearSelection();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [cancelEditing, clearSelection, editing, selected]);

  useEffect(() => {
    if (!editing) return;
    const current = messages?.find((message) => message.id === editing.id);
    if (!current || current.status === "redacted") {
      cancelEditing();
      showHint("This message is no longer editable");
    }
  }, [cancelEditing, editing, messages, showHint]);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      clearTyping();
    },
    // Cleanup must use the currently mounted presence instance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function submitTextMessage() {
    const value = text.trim();
    if (!value) return;
    setError(null);
    clearTyping();

    if (editing) {
      if (value === messageText(editing).trim()) return;
      try {
        await editMessage({
          subjectId,
          messageId: editing.id,
          partId:
            editing.parts.find((part) => part.type === "text")?.id ?? "text",
          expectedRevision: editing.revision,
          text: value,
        });
        setEditing(null);
        setText("");
        Keyboard.dismiss();
        setTimeout(() => bringMessageIntoView(editing.id), 60);
      } catch (cause) {
        setError(errorMessage(cause));
      }
      return;
    }

    const draft = text;
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    pinnedToBottom.current = true;
    forceScrollToBottom.current = true;
    scrollToBottom();
    try {
      await sendText({
        subjectId,
        conversationId,
        clientMessageId: Crypto.randomUUID(),
        text: value,
        replyToMessageId: reply?.id,
      });
      scrollToBottom();
    } catch (cause) {
      forceScrollToBottom.current = false;
      setText((current) => current || draft);
      setReplyTo((current) => current ?? reply);
      setError(errorMessage(cause));
    }
  }

  function selectMessage(message: DemoMessage) {
    if (editing || message.status !== "published") return;
    Keyboard.dismiss();
    clearTyping();
    setSelected(message);
    setOverflowOpen(false);
  }

  function beginReply(message: DemoMessage) {
    setSelected(null);
    setOverflowOpen(false);
    setEditing(null);
    setReplyTo(message);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      scrollToBottom();
    });
  }

  function beginEdit(message: DemoMessage) {
    const editableText = messageText(message);
    if (!editableText) return;
    setSelected(null);
    setOverflowOpen(false);
    setReplyTo(null);
    setEditing(message);
    setText(editableText);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      bringMessageIntoView(message.id);
    });
  }

  async function removeSelectedMessage() {
    if (!selected) return;
    setError(null);
    try {
      await deleteMessage({
        subjectId,
        messageId: selected.id,
        expectedRevision: selected.revision,
      });
      clearSelection();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function reactToMessage(message: DemoMessage, reactionKey?: string) {
    setError(null);
    try {
      await setReaction({ subjectId, messageId: message.id, reactionKey });
      clearSelection();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function chooseImage() {
    if (pendingAttachment || editing) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const pending: PendingAttachment = {
      clientMessageId: Crypto.randomUUID(),
      kind: "image",
      uri: asset.uri,
      filename: asset.fileName ?? `image-${Date.now()}.jpg`,
      mediaType: asset.mimeType ?? "image/jpeg",
      caption: text.trim() || undefined,
      replyToMessageId: replyTo?.id,
      status: "sending",
    };
    setPendingAttachment(pending);
    void sendPendingAttachment(pending);
  }

  async function sendPendingAttachment(pending: PendingAttachment) {
    setError(null);
    forceScrollToBottom.current = true;
    let attempted = pending;
    try {
      if (!attempted.grantId) {
        const grantId = await uploadLocalAttachment(attempted);
        attempted = { ...attempted, grantId };
        setPendingAttachment((value) =>
          value?.clientMessageId === attempted.clientMessageId
            ? attempted
            : value,
        );
      }
      const grantId = attempted.grantId;
      if (!grantId) throw new Error("The attachment upload is incomplete");
      await commitAttachment({
        grantId,
        subjectId,
        clientMessageId: attempted.clientMessageId,
        caption: attempted.caption,
        replyToMessageId: attempted.replyToMessageId,
      });
      setPendingAttachment((current) =>
        current?.clientMessageId === pending.clientMessageId ? null : current,
      );
      if (pending.kind === "image") setText("");
      setReplyTo(null);
      pinnedToBottom.current = true;
      scrollToBottom();
    } catch (cause) {
      forceScrollToBottom.current = false;
      const message = errorMessage(cause);
      setPendingAttachment((value) =>
        value?.clientMessageId === pending.clientMessageId
          ? { ...attempted, status: "failed", error: message }
          : value,
      );
      setError(message);
    }
  }

  async function uploadLocalAttachment({
    uri,
    filename,
    mediaType,
    durationMs,
    caption,
    replyToMessageId,
  }: {
    uri: string;
    filename: string;
    mediaType: string;
    durationMs?: number;
    caption?: string;
    replyToMessageId?: string;
  }): Promise<AttachmentGrantId> {
    const file = new File(uri);
    if (!file.exists || !file.size)
      throw new Error("The selected file is unavailable");
    const bytes = await file.bytes();
    // Expo records the HIGH_QUALITY preset as MPEG-4/AAC, but Android's file
    // resolver can describe the resulting .m4a with a device-specific MIME
    // type. Keep the known recorder type so attachment validation and the R2
    // metadata agree across platforms.
    const uploadMediaType = attachmentUploadMediaType(mediaType, file.type);
    const upload = await generateAttachmentUploadUrl({
      subjectId,
      conversationId,
      filename,
      mediaType: uploadMediaType,
      size: bytes.byteLength,
      durationMs,
    });
    const response = await expoFetch(upload.url, {
      method: "PUT",
      headers: { "Content-Type": uploadMediaType },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    return upload.grantId;
  }

  function onListScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (forceScrollToBottom.current) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    pinnedToBottom.current =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < 90;
  }

  if (!conversationId) return null;

  if (!activeConversation || messages === undefined) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <ActivityIndicator color="#22d3ee" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const label = conversationLabel(activeConversation, subjectId);
  const selectedMine = selected?.authorSubjectId === subjectId;
  const selectedText = selected ? messageText(selected) : "";
  const editingChanged = editing
    ? text.trim() !== messageText(editing).trim()
    : false;
  const showingSend = editing ? true : text.trim().length > 0;
  const recording =
    voice.status === "recording" || voice.status === "requesting";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Stack.Screen options={{ gestureEnabled: !editing && !selected }} />
      <ConversationHeader
        editing={Boolean(editing)}
        label={label}
        onlineLabel={
          presence === undefined
            ? "Connecting…"
            : activeConversation.kind === "direct"
              ? onlineOthers.length > 0
                ? "Online"
                : "Offline"
              : `${presence.filter((entry) => entry.online).length} online · ${activeConversation.memberSubjectIds.length} members`
        }
        onBack={handleBack}
        onDelete={() => void removeSelectedMessage()}
        onMore={() => setOverflowOpen(true)}
        onReply={() => selected && beginReply(selected)}
        selected={selected}
        selectedMine={selectedMine}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        enabled
        onLayout={() => {
          if (editing) bringMessageIntoView(editing.id);
          else if (anchorToBottomWhileKeyboardOpens.current)
            requestAnimationFrame(() => scrollToBottom(false));
        }}
        style={styles.keyboardArea}
      >
        <FlatList
          ref={listRef}
          data={messages}
          extraData={{
            editingId: editing?.id,
            selectedId: selected?.id,
            pendingAttachment,
          }}
          keyExtractor={(message) => message.id}
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (editing) bringMessageIntoView(editing.id);
            else if (pinnedToBottom.current || forceScrollToBottom.current)
              scrollToBottom(false);
          }}
          onScroll={onListScroll}
          onScrollBeginDrag={() => {
            anchorToBottomWhileKeyboardOpens.current = false;
            if (selected) clearSelection();
          }}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({
              animated: false,
              offset: Math.max(0, index * averageItemLength),
            });
            setTimeout(() => {
              if (editing) bringMessageIntoView(editing.id);
            }, 80);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyMessageList,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatTitle}>Start the conversation</Text>
              <Text style={styles.emptyChatCopy}>
                Send a message and watch it sync through Convex.
              </Text>
            </View>
          }
          ListFooterComponent={
            pendingAttachment ? (
              <PendingAttachmentBubble
                pending={pendingAttachment}
                onDismiss={() => setPendingAttachment(null)}
                onRetry={() => {
                  const retry = {
                    ...pendingAttachment,
                    status: "sending" as const,
                  };
                  setPendingAttachment(retry);
                  void sendPendingAttachment(retry);
                }}
              />
            ) : null
          }
          renderItem={({ item, index }) => {
            const previous = messages[index - 1];
            const showDate =
              !previous ||
              dateKey(previous.createdAt) !== dateKey(item.createdAt);
            return (
              <Fragment>
                {showDate && (
                  <View
                    style={[styles.dateSeparator, editing && styles.dimmed]}
                  >
                    <Text style={styles.dateText}>
                      {formatMessageDate(item.createdAt)}
                    </Text>
                  </View>
                )}
                <MessageBubble
                  dimmed={Boolean(editing && editing.id !== item.id)}
                  message={item}
                  onClearSelection={() => clearSelection()}
                  onLongPress={selectMessage}
                  onReact={(message, reactionKey) =>
                    void reactToMessage(message, reactionKey)
                  }
                  selected={selected?.id === item.id}
                  showAuthor={activeConversation.kind === "group"}
                  subjectId={subjectId}
                />
              </Fragment>
            );
          }}
        />

        <View style={styles.composerArea}>
          {typingNames.length > 0 && !editing && (
            <Text accessibilityLiveRegion="polite" style={styles.typing}>
              {typingLabel(typingNames)}
            </Text>
          )}
          {(error || hint) && (
            <View style={error ? styles.errorBanner : styles.hintBanner}>
              <Text style={error ? styles.errorText : styles.hintText}>
                {error ?? hint}
              </Text>
            </View>
          )}
          {replyTo && !editing && (
            <View style={styles.replyContext}>
              <View style={styles.replyContextCopy}>
                <Text style={styles.replyContextTitle}>
                  Replying to {capitalize(replyTo.authorSubjectId ?? "system")}
                </Text>
                <Text style={styles.replyContextText} numberOfLines={1}>
                  {messagePreview(replyTo)}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Cancel reply"
                onPress={() => setReplyTo(null)}
                style={styles.smallIconButton}
              >
                <X color="#9fb0c4" size={18} />
              </Pressable>
            </View>
          )}

          <View style={styles.composerRow}>
            {recording ? (
              <View style={styles.recordingStatus}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>
                  {voice.status === "requesting"
                    ? "Preparing…"
                    : formatDuration(voice.elapsedMs)}
                </Text>
                <Text
                  style={[
                    styles.slideToCancel,
                    voiceGestureCancelled && styles.slideToCancelActive,
                  ]}
                >
                  {voiceGestureCancelled
                    ? "Release to cancel"
                    : "← slide to cancel"}
                </Text>
              </View>
            ) : (
              <View style={styles.inputShell}>
                {!editing && (
                  <Pressable
                    accessibilityLabel="Choose image"
                    disabled={Boolean(pendingAttachment)}
                    onPress={() => void chooseImage()}
                    style={styles.inputIcon}
                  >
                    {pendingAttachment?.kind === "image" &&
                    pendingAttachment.status === "sending" ? (
                      <ActivityIndicator color="#8294aa" size="small" />
                    ) : (
                      <ImagePlus color="#8294aa" size={21} />
                    )}
                  </Pressable>
                )}
                <TextInput
                  ref={inputRef}
                  accessibilityLabel={editing ? "Edit message" : "Message"}
                  multiline
                  onChangeText={(value) => {
                    setText(value);
                    if (!editing) {
                      if (value.trim()) noteTyping();
                      else clearTyping();
                    }
                  }}
                  onContentSizeChange={() => {
                    if (editing) bringMessageIntoView(editing.id);
                    else if (
                      pinnedToBottom.current ||
                      anchorToBottomWhileKeyboardOpens.current
                    )
                      scrollToBottom(false);
                  }}
                  onFocus={() => {
                    anchorToBottomWhileKeyboardOpens.current =
                      pinnedToBottom.current;
                    if (editing) bringMessageIntoView(editing.id);
                    else if (anchorToBottomWhileKeyboardOpens.current)
                      scrollToBottom();
                  }}
                  onBlur={() => {
                    anchorToBottomWhileKeyboardOpens.current = false;
                  }}
                  placeholder={editing ? "Edit message" : "Message"}
                  placeholderTextColor="#64748b"
                  selection={undefined}
                  style={[styles.input, !editing && styles.inputWithIcon]}
                  textAlignVertical="center"
                  value={text}
                />
              </View>
            )}

            {showingSend && !recording ? (
              <Pressable
                accessibilityLabel={
                  editing ? "Save edited message" : "Send message"
                }
                disabled={!text.trim() || (editing ? !editingChanged : false)}
                onPress={() => void submitTextMessage()}
                style={({ pressed }) => [
                  styles.primaryAction,
                  (!text.trim() || (editing && !editingChanged)) &&
                    styles.primaryActionDisabled,
                  pressed && styles.actionPressed,
                ]}
              >
                {editing ? (
                  <Check color="#03212a" size={24} strokeWidth={3} />
                ) : (
                  <Send color="#03212a" size={22} strokeWidth={2.8} />
                )}
              </Pressable>
            ) : (
              <MicButton
                active={recording}
                cancelled={voiceGestureCancelled}
                onPressIn={(pageX) => {
                  if (recording || pendingAttachment) return;
                  Keyboard.dismiss();
                  voiceCancelledRef.current = false;
                  setVoiceGestureCancelled(false);
                  voiceStartX.current = pageX;
                  void voice.beginHold();
                }}
                onPressOut={() => {
                  const cancelled = voiceCancelledRef.current;
                  voiceCancelledRef.current = false;
                  setVoiceGestureCancelled(false);
                  voice.endHold(cancelled);
                }}
                onTouchMove={(pageX) => {
                  if (pageX < voiceStartX.current - 72) {
                    voiceCancelledRef.current = true;
                    setVoiceGestureCancelled(true);
                  }
                }}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <OverflowMenu
        canCopy={Boolean(selectedText)}
        canEdit={Boolean(selectedMine && selectedText)}
        onClose={() => setOverflowOpen(false)}
        onCopy={() => {
          if (selectedText) void Clipboard.setStringAsync(selectedText);
          clearSelection();
        }}
        onEdit={() => selected && beginEdit(selected)}
        visible={overflowOpen}
      />
    </SafeAreaView>
  );
}

function ConversationHeader({
  editing,
  label,
  onlineLabel,
  onBack,
  onDelete,
  onMore,
  onReply,
  selected,
  selectedMine,
}: {
  editing: boolean;
  label: string;
  onlineLabel: string;
  onBack: () => void;
  onDelete: () => void;
  onMore: () => void;
  onReply: () => void;
  selected: DemoMessage | null;
  selectedMine: boolean;
}) {
  if (editing) {
    return (
      <View style={styles.header}>
        <HeaderButton label="Cancel edit" onPress={onBack}>
          <ArrowLeft color="white" size={25} />
        </HeaderButton>
        <Text style={styles.editHeaderTitle}>Edit message</Text>
        <View style={styles.headerSpacer} />
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.header}>
        <HeaderButton label="Close message actions" onPress={onBack}>
          <X color="white" size={25} />
        </HeaderButton>
        <Text style={styles.selectionCount}>1</Text>
        <View style={styles.selectedActions}>
          <HeaderButton label="Reply" onPress={onReply}>
            <Reply color="white" size={23} />
          </HeaderButton>
          {selectedMine && (
            <HeaderButton label="Delete message" onPress={onDelete}>
              <Trash2 color="white" size={22} />
            </HeaderButton>
          )}
          <HeaderButton label="More message actions" onPress={onMore}>
            <MoreVertical color="white" size={23} />
          </HeaderButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <HeaderButton label="Back to conversations" onPress={onBack}>
        <ArrowLeft color="white" size={25} />
      </HeaderButton>
      <Avatar size="sm" color="accent">
        <Avatar.Fallback>{label.slice(0, 1)}</Avatar.Fallback>
      </Avatar>
      <View style={styles.headerIdentity}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {onlineLabel}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function HeaderButton({
  children,
  label,
  onPress,
}: {
  children: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.actionPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

function OverflowMenu({
  canCopy,
  canEdit,
  onClose,
  onCopy,
  onEdit,
  visible,
}: {
  canCopy: boolean;
  canEdit: boolean;
  onClose: () => void;
  onCopy: () => void;
  onEdit: () => void;
  visible: boolean;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.menuBackdrop}>
        <View style={styles.menu}>
          {canCopy && (
            <Pressable onPress={onCopy} style={styles.menuItem}>
              <Copy color="#dbeafe" size={19} />
              <Text style={styles.menuText}>Copy</Text>
            </Pressable>
          )}
          {canEdit && (
            <Pressable onPress={onEdit} style={styles.menuItem}>
              <Edit3 color="#dbeafe" size={19} />
              <Text style={styles.menuText}>Edit</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function MicButton({
  active = false,
  cancelled,
  onPressIn,
  onPressOut,
  onTouchMove,
}: {
  active?: boolean;
  cancelled: boolean;
  onPressIn: (pageX: number) => void;
  onPressOut: () => void;
  onTouchMove: (pageX: number) => void;
}) {
  const callbacks = useRef({ onPressIn, onPressOut, onTouchMove });
  callbacks.current = { onPressIn, onPressOut, onTouchMove };
  const [pressed, setPressed] = useState(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setPressed(true);
          callbacks.current.onPressIn(event.nativeEvent.pageX);
        },
        onPanResponderMove: (_event, gesture) => {
          callbacks.current.onTouchMove(gesture.moveX);
        },
        onPanResponderRelease: () => {
          setPressed(false);
          callbacks.current.onPressOut();
        },
        onPanResponderTerminate: () => {
          setPressed(false);
          callbacks.current.onPressOut();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityHint="Press and hold to record. Release to send. Slide left to cancel."
      accessibilityLabel="Record voice message"
      accessibilityRole="button"
      style={[
        styles.primaryAction,
        (active || pressed) && styles.micActive,
        cancelled && styles.micCancelled,
      ]}
    >
      <Mic color="#03212a" size={24} strokeWidth={2.8} />
    </View>
  );
}

function PendingAttachmentBubble({
  onDismiss,
  onRetry,
  pending,
}: {
  onDismiss: () => void;
  onRetry: () => void;
  pending: PendingAttachment;
}) {
  const label = pending.kind === "voice" ? "voice message" : "image";
  return (
    <View style={styles.pendingVoiceRow}>
      <View style={styles.pendingVoiceBubble}>
        {pending.status === "sending" ? (
          <ActivityIndicator color="#e6fbff" size="small" />
        ) : (
          <Text style={styles.pendingVoiceError}>!</Text>
        )}
        <Text style={styles.pendingVoiceText}>
          {pending.status === "sending"
            ? pending.kind === "voice"
              ? `Sending voice message · ${formatDuration(pending.durationMs ?? 0)}`
              : "Sending image"
            : `${label[0]?.toUpperCase()}${label.slice(1)} failed`}
        </Text>
        {pending.status === "failed" && (
          <>
            <Pressable accessibilityLabel={`Retry ${label}`} onPress={onRetry}>
              <Text style={styles.pendingVoiceAction}>Retry</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Dismiss failed ${label}`}
              onPress={onDismiss}
            >
              <Text style={styles.pendingVoiceAction}>Dismiss</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function dateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  if (dateKey(timestamp) === dateKey(today.getTime())) return "Today";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function typingLabel(names: string[]) {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]} and ${names.length - 1} others are typing…`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07101d" },
  keyboardArea: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "#0b1523",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1d2a3d",
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIdentity: { flex: 1, marginLeft: 10, minWidth: 0 },
  headerTitle: { color: "white", fontWeight: "800", fontSize: 17 },
  headerSubtitle: { color: "#7f91a8", fontSize: 11, marginTop: 2 },
  headerSpacer: { flex: 1 },
  editHeaderTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 6,
  },
  selectionCount: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 2,
  },
  selectedActions: { marginLeft: "auto", flexDirection: "row" },
  messageList: { paddingVertical: 10, flexGrow: 1, justifyContent: "flex-end" },
  emptyMessageList: { justifyContent: "center" },
  emptyChat: { alignItems: "center", padding: 28 },
  emptyChatTitle: { color: "white", fontSize: 21, fontWeight: "800" },
  emptyChatCopy: { color: "#7f91a8", marginTop: 7, textAlign: "center" },
  dateSeparator: { alignItems: "center", marginVertical: 9 },
  dateText: {
    color: "#9fb0c4",
    fontSize: 11,
    backgroundColor: "#142133",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dimmed: { opacity: 0.16 },
  composerArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#1b2a3d",
    backgroundColor: "#091321",
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 6,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  inputShell: {
    flex: 1,
    minHeight: 48,
    maxHeight: 124,
    borderRadius: 24,
    backgroundColor: "#182433",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 16,
    lineHeight: 21,
    minHeight: 48,
    maxHeight: 124,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 12,
  },
  inputWithIcon: { paddingLeft: 43 },
  inputIcon: {
    position: "absolute",
    left: 7,
    bottom: 5,
    zIndex: 2,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAction: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionDisabled: { opacity: 0.35 },
  actionPressed: { opacity: 0.68 },
  micActive: { transform: [{ scale: 1.08 }], backgroundColor: "#67e8f9" },
  micCancelled: { backgroundColor: "#fb7185" },
  typing: { color: "#67e8f9", fontSize: 11, marginLeft: 8, marginBottom: 5 },
  errorBanner: {
    backgroundColor: "#4a1822",
    borderRadius: 9,
    padding: 8,
    marginBottom: 6,
  },
  errorText: { color: "#fecdd3", fontSize: 12 },
  hintBanner: {
    backgroundColor: "#123244",
    borderRadius: 9,
    padding: 8,
    marginBottom: 6,
  },
  hintText: { color: "#cffafe", fontSize: 12 },
  replyContext: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111d2d",
    borderLeftWidth: 3,
    borderLeftColor: "#22d3ee",
    borderRadius: 9,
    marginBottom: 7,
    paddingLeft: 10,
    paddingVertical: 7,
  },
  replyContextCopy: { flex: 1 },
  replyContextTitle: { color: "#67e8f9", fontSize: 11, fontWeight: "800" },
  replyContextText: { color: "#9fb0c4", fontSize: 12, marginTop: 2 },
  smallIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingStatus: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    backgroundColor: "#182433",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  recordingDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#fb7185",
  },
  recordingTime: {
    color: "#f8fafc",
    fontVariant: ["tabular-nums"],
    minWidth: 62,
  },
  slideToCancel: {
    flex: 1,
    textAlign: "center",
    color: "#7f91a8",
    fontSize: 12,
  },
  slideToCancelActive: { color: "#fda4af", fontWeight: "800" },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)" },
  menu: {
    position: "absolute",
    top: 64,
    right: 10,
    minWidth: 172,
    borderRadius: 14,
    paddingVertical: 7,
    backgroundColor: "#111b28",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#344258",
    shadowColor: "black",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
  },
  menuItem: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  menuText: { color: "#f8fafc", fontSize: 16 },
  pendingVoiceRow: {
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pendingVoiceBubble: {
    maxWidth: "88%",
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderBottomRightRadius: 5,
    backgroundColor: "#0e7490",
  },
  pendingVoiceText: { color: "#e6fbff", fontSize: 13 },
  pendingVoiceError: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    color: "white",
    backgroundColor: "#e11d48",
    fontWeight: "900",
  },
  pendingVoiceAction: { color: "#cffafe", fontSize: 12, fontWeight: "800" },
});
