import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex-chat/example-backend/api";
import { Ban, Pause, Play, X } from "lucide-react-native";
import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import type { DemoMessage } from "@/lib/chat";
import { audioTimeLabel, formatClock, reactions } from "@/lib/chat";
import { capitalize, type Subject } from "@/lib/subjects";

type AttachmentPart = Extract<
  DemoMessage["parts"][number],
  { type: "attachment" }
>;

export function MessageBubble({
  dimmed,
  message,
  onClearSelection,
  onLongPress,
  onReact,
  selected,
  showAuthor,
  subjectId,
}: {
  dimmed: boolean;
  message: DemoMessage;
  onClearSelection: () => void;
  onLongPress: (message: DemoMessage) => void;
  onReact: (message: DemoMessage, reaction?: string) => void;
  selected: boolean;
  showAuthor: boolean;
  subjectId: Subject;
}) {
  const mine = message.authorSubjectId === subjectId;

  return (
    <View
      style={[
        styles.row,
        mine && styles.rowMine,
        selected && styles.selectedRow,
        dimmed && styles.dimmed,
      ]}
    >
      <View style={[styles.stack, mine && styles.stackMine]}>
        {selected && message.status === "published" && (
          <View
            style={[
              styles.reactionStrip,
              mine ? styles.reactionStripMine : null,
            ]}
          >
            {reactions.map((reaction) => {
              const mineReaction = message.reactions.some(
                (item) => item.key === reaction && item.reactedByMe,
              );
              return (
                <Pressable
                  accessibilityLabel={`${mineReaction ? "Remove" : "React with"} ${reaction}`}
                  key={reaction}
                  onPress={() =>
                    onReact(message, mineReaction ? undefined : reaction)
                  }
                  style={({ pressed }) => [
                    styles.reactionButton,
                    mineReaction && styles.reactionButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.reactionEmoji}>{reaction}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          accessibilityActions={
            message.status === "published"
              ? [
                  { name: "activate", label: "Select message" },
                  { name: "longpress", label: "Message actions" },
                ]
              : []
          }
          accessibilityLabel={`Message from ${capitalize(message.authorSubjectId ?? "system")}`}
          delayLongPress={350}
          disabled={dimmed}
          onAccessibilityAction={() => onLongPress(message)}
          onLongPress={() => onLongPress(message)}
          onPress={() => {
            if (selected) onClearSelection();
          }}
          style={({ pressed }) => [
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleOther,
            message.status === "redacted" && styles.bubbleDeleted,
            pressed && !dimmed && styles.pressed,
          ]}
        >
          {showAuthor && !mine && (
            <Text style={styles.author}>
              {capitalize(message.authorSubjectId ?? "system")}
            </Text>
          )}

          {message.reply && (
            <View style={styles.replyQuote}>
              <Text style={styles.replyAuthor}>
                {capitalize(message.reply.authorSubjectId ?? "system")}
              </Text>
              <Text style={styles.replyText} numberOfLines={2}>
                {message.reply.fallbackText ?? "Message unavailable"}
              </Text>
            </View>
          )}

          {message.status === "redacted" ? (
            <View style={styles.deletedRow}>
              <Ban color="#8290a2" size={15} />
              <Text style={styles.deletedText}>
                {mine
                  ? "You deleted this message."
                  : "This message was deleted."}
              </Text>
            </View>
          ) : (
            message.parts.map((part) => {
              if (part.type === "text") {
                return (
                  <Text style={styles.messageText} key={part.id}>
                    {part.text}
                  </Text>
                );
              }
              if (part.type === "attachment") {
                return (
                  <MessageAttachment
                    key={part.id}
                    messageId={message.id}
                    onClearSelection={onClearSelection}
                    part={part}
                    selected={selected}
                    subjectId={subjectId}
                  />
                );
              }
              return (
                <Text style={styles.messageText} key={part.id}>
                  {part.fallbackText}
                </Text>
              );
            })
          )}

          <View style={styles.metaRow}>
            {message.editedAt && <Text style={styles.meta}>edited</Text>}
            <Text style={styles.meta}>{formatClock(message.createdAt)}</Text>
          </View>
        </Pressable>

        {message.reactions.length > 0 && (
          <View
            style={[styles.reactionSummary, mine && styles.reactionSummaryMine]}
          >
            {message.reactions.map((reaction) => (
              <Pressable
                accessibilityLabel={`${reaction.key}, ${reaction.count}`}
                key={reaction.key}
                onPress={() =>
                  onReact(
                    message,
                    reaction.reactedByMe ? undefined : reaction.key,
                  )
                }
                style={[
                  styles.reactionPill,
                  reaction.reactedByMe && styles.reactionPillMine,
                ]}
              >
                <Text style={styles.reactionPillText}>
                  {reaction.key} {reaction.count}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function MessageAttachment({
  messageId,
  onClearSelection,
  part,
  selected,
  subjectId,
}: {
  messageId: string;
  onClearSelection: () => void;
  part: AttachmentPart;
  selected: boolean;
  subjectId: Subject;
}) {
  const [urlVersion, setUrlVersion] = useState(() => Date.now());
  const url = useQuery(api.attachments.getAttachmentUrl, {
    subjectId,
    messageId,
    partId: part.id,
    urlVersion,
  });
  const refreshUrl = useCallback(() => setUrlVersion(Date.now()), []);

  useEffect(() => {
    // R2 download URLs expire after five minutes. A chat can remain mounted
    // much longer, so request a new signed URL before the current one expires.
    const timer = setInterval(refreshUrl, 4 * 60_000);
    return () => clearInterval(timer);
  }, [refreshUrl]);

  if (!url) {
    const loadingLayout = part.mediaType.startsWith("image/")
      ? styles.imageLoading
      : part.mediaType.startsWith("audio/")
        ? styles.audioLoading
        : null;
    return (
      <View style={[styles.attachmentLoading, loadingLayout]}>
        <ActivityIndicator color="#67e8f9" />
        <Text style={styles.attachmentLabel}>{part.fallbackText}</Text>
      </View>
    );
  }
  if (part.mediaType.startsWith("image/")) {
    return (
      <ImageAttachment
        label={part.fallbackText}
        onClearSelection={onClearSelection}
        selected={selected}
        url={url}
      />
    );
  }
  if (part.mediaType.startsWith("audio/")) {
    return (
      <AudioAttachment
        declaredDurationMs={part.durationMs}
        label={part.fallbackText}
        onClearSelection={onClearSelection}
        onRefreshUrl={refreshUrl}
        selected={selected}
        url={url}
      />
    );
  }
  return <Text style={styles.attachmentLabel}>{part.fallbackText}</Text>;
}

function ImageAttachment({
  label,
  onClearSelection,
  selected,
  url,
}: {
  label: string;
  onClearSelection: () => void;
  selected: boolean;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          if (selected) onClearSelection();
          else setOpen(true);
        }}
      >
        <Image
          accessibilityLabel={label}
          resizeMode="cover"
          source={{ uri: url }}
          style={styles.image}
        />
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.lightbox}>
          <Pressable
            accessibilityLabel="Close image"
            onPress={() => setOpen(false)}
            style={styles.lightboxClose}
          >
            <X color="white" size={26} />
          </Pressable>
          <Image
            accessibilityLabel={label}
            resizeMode="contain"
            source={{ uri: url }}
            style={styles.lightboxImage}
          />
        </View>
      </Modal>
    </>
  );
}

function AudioAttachment({
  declaredDurationMs,
  label,
  onClearSelection,
  onRefreshUrl,
  selected,
  url,
}: {
  declaredDurationMs?: number;
  label: string;
  onClearSelection: () => void;
  onRefreshUrl: () => void;
  selected: boolean;
  url: string;
}) {
  // On Android, stream the signed URL so ExoPlayer receives R2's real content
  // type. Expo Asset otherwise assigns extensionless URLs a .mp3 extension,
  // including WebM/Opus voice messages.
  const player = useAudioPlayer(url, {
    downloadFirst: Platform.OS === "ios",
    updateInterval: 200,
  });
  const status = useAudioPlayerStatus(player);
  const [playbackError, setPlaybackError] = useState(false);
  const error = status.error || playbackError;
  const duration = status.duration || (declaredDurationMs ?? 0) / 1000;
  const progress =
    duration > 0 ? Math.min(1, status.currentTime / duration) : 0;

  useEffect(() => {
    if (!status.didJustFinish) return;
    player.pause();
    void player.seekTo(0);
  }, [player, status.didJustFinish]);

  return (
    <View accessibilityLabel={label} style={styles.audio}>
      <Pressable
        accessibilityLabel={
          error
            ? "Voice message unavailable"
            : !status.isLoaded
              ? "Loading voice message"
              : status.playing
                ? "Pause voice message"
                : "Play voice message"
        }
        disabled={!selected && !status.isLoaded && !error}
        onPress={() => {
          if (selected) {
            onClearSelection();
            return;
          }
          if (error) {
            setPlaybackError(false);
            onRefreshUrl();
            return;
          }
          if (status.playing) {
            player.pause();
            return;
          }
          void (async () => {
            try {
              setPlaybackError(false);
              await setIsAudioActiveAsync(true);
              await setAudioModeAsync({ playsInSilentMode: true });
              if (status.didJustFinish) await player.seekTo(0);
              player.play();
            } catch {
              setPlaybackError(true);
            }
          })();
        }}
        style={styles.audioButton}
      >
        {!status.isLoaded && !error ? (
          <ActivityIndicator color="#e6fbff" size="small" />
        ) : status.playing ? (
          <Pause color="#e6fbff" fill="#e6fbff" size={20} />
        ) : (
          <Play color="#e6fbff" fill="#e6fbff" size={20} />
        )}
      </Pressable>
      <View style={styles.audioCopy}>
        <View style={styles.audioTrack}>
          <View
            style={[styles.audioProgress, { width: `${progress * 100}%` }]}
          />
        </View>
        <Text style={styles.audioTime}>
          {error
            ? "Audio unavailable · tap to retry"
            : audioTimeLabel({
                currentTime: status.currentTime,
                duration,
                playing: status.playing,
              })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", paddingHorizontal: 12, paddingVertical: 5 },
  rowMine: { alignItems: "flex-end" },
  selectedRow: { backgroundColor: "rgba(34, 211, 238, 0.12)" },
  dimmed: { opacity: 0.16 },
  stack: { maxWidth: "84%", alignItems: "flex-start" },
  stackMine: { alignItems: "flex-end" },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: "#0e7490", borderBottomRightRadius: 5 },
  bubbleOther: { backgroundColor: "#1d2938", borderBottomLeftRadius: 5 },
  bubbleDeleted: { backgroundColor: "#172131" },
  pressed: { opacity: 0.78 },
  author: {
    color: "#67e8f9",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  messageText: { color: "#f8fafc", fontSize: 16, lineHeight: 22 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 5,
    marginTop: 4,
  },
  meta: { color: "rgba(230, 248, 255, 0.65)", fontSize: 10 },
  replyQuote: {
    backgroundColor: "rgba(2, 6, 23, 0.32)",
    borderLeftWidth: 3,
    borderLeftColor: "#67e8f9",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginBottom: 7,
    minWidth: 160,
  },
  replyAuthor: { color: "#67e8f9", fontSize: 11, fontWeight: "800" },
  replyText: { color: "#c8d4e3", fontSize: 12, marginTop: 2 },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  deletedText: { color: "#9aa8b9", fontStyle: "italic", fontSize: 14 },
  reactionStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111c2b",
    borderColor: "#324157",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 4,
    marginBottom: 6,
    zIndex: 5,
  },
  reactionStripMine: { alignSelf: "flex-end" },
  reactionButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  reactionButtonActive: { backgroundColor: "#164e63" },
  reactionEmoji: { fontSize: 22 },
  reactionSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: -4,
  },
  reactionSummaryMine: { justifyContent: "flex-end" },
  reactionPill: {
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#172235",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#334155",
  },
  reactionPillMine: { borderColor: "#22d3ee", backgroundColor: "#12384a" },
  reactionPillText: { color: "#dbeafe", fontSize: 11 },
  attachmentLoading: {
    minWidth: 190,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  imageLoading: { width: 240, height: 190, marginBottom: 3 },
  audioLoading: { minWidth: 235, minHeight: 50 },
  attachmentLabel: { color: "#d6e0ec", fontSize: 13, marginTop: 6 },
  image: { width: 240, height: 190, borderRadius: 13, marginBottom: 3 },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
  },
  lightboxClose: {
    position: "absolute",
    zIndex: 2,
    top: 54,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.8)",
  },
  lightboxImage: { width: "100%", height: "80%" },
  audio: {
    minWidth: 235,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  audioButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(8, 47, 73, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  audioCopy: { flex: 1, marginLeft: 10 },
  audioTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  audioProgress: { height: 4, borderRadius: 2, backgroundColor: "#e6fbff" },
  audioTime: { color: "rgba(230,248,255,0.72)", fontSize: 10, marginTop: 6 },
});
