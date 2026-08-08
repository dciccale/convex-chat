import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

export const MAX_AUDIO_DURATION_MS = 2 * 60_000;
export const MIN_AUDIO_DURATION_MS = 500;

type PushToTalkStatus = "idle" | "requesting" | "recording" | "finishing";

export function usePushToTalk({
  onError,
  onHint,
  onRecorded,
}: {
  onError: (cause: unknown) => void;
  onHint: (message: string) => void;
  onRecorded: (uri: string, durationMs: number) => Promise<void>;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [status, setStatus] = useState<PushToTalkStatus>("idle");
  const activeHold = useRef(false);
  const mounted = useRef(true);
  const finishing = useRef(false);
  const startedAt = useRef(0);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onErrorRef = useRef(onError);
  const onHintRef = useRef(onHint);
  const onRecordedRef = useRef(onRecorded);
  onErrorRef.current = onError;
  onHintRef.current = onHint;
  onRecordedRef.current = onRecorded;

  const clearLimit = useCallback(() => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = null;
  }, []);

  const finish = useCallback(
    async (cancelled: boolean) => {
      if (finishing.current || !recorder.isRecording) return;
      finishing.current = true;
      clearLimit();
      if (mounted.current) setStatus("finishing");
      const durationMs = Math.min(
        MAX_AUDIO_DURATION_MS,
        Math.max(0, Date.now() - startedAt.current),
      );

      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (
          !cancelled &&
          durationMs >= MIN_AUDIO_DURATION_MS &&
          uri &&
          mounted.current
        ) {
          await onRecordedRef.current(uri, durationMs);
        } else if (!cancelled && durationMs < MIN_AUDIO_DURATION_MS) {
          onHintRef.current("Hold to record");
        }
      } catch (cause) {
        if (!cancelled && mounted.current) onErrorRef.current(cause);
      } finally {
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        finishing.current = false;
        startedAt.current = 0;
        if (mounted.current) setStatus("idle");
      }
    },
    [clearLimit, recorder],
  );

  const beginHold = useCallback(async () => {
    if (status !== "idle" || finishing.current) return;
    activeHold.current = true;
    setStatus("requesting");

    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted) {
        permission = await requestRecordingPermissionsAsync();
      }
      if (!permission.granted) {
        activeHold.current = false;
        onErrorRef.current(new Error("Microphone permission was denied"));
        if (mounted.current) setStatus("idle");
        return;
      }
      if (!activeHold.current || !mounted.current) {
        onHintRef.current("Hold again to record");
        if (mounted.current) setStatus("idle");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      if (!activeHold.current || !mounted.current) {
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        if (mounted.current) setStatus("idle");
        return;
      }

      startedAt.current = Date.now();
      recorder.record();
      setStatus("recording");
      limitTimer.current = setTimeout(() => {
        activeHold.current = false;
        void finish(false);
      }, MAX_AUDIO_DURATION_MS);
    } catch (cause) {
      activeHold.current = false;
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (mounted.current) {
        setStatus("idle");
        onErrorRef.current(cause);
      }
    }
  }, [finish, recorder, status]);

  const endHold = useCallback(
    (cancelled: boolean) => {
      activeHold.current = false;
      // The finger can lift in the narrow window after recording starts but
      // before React commits the new status. Read the recorder directly so a
      // quick press can never leave a recording running in the background.
      if (recorder.isRecording) void finish(cancelled);
    },
    [finish, recorder],
  );

  const cancel = useCallback(() => {
    activeHold.current = false;
    if (recorder.isRecording) void finish(true);
    else if (status === "requesting") setStatus("idle");
  }, [finish, recorder.isRecording, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") cancel();
    });
    return () => subscription.remove();
  }, [cancel]);

  useEffect(
    () => () => {
      mounted.current = false;
      activeHold.current = false;
      clearLimit();
      // useAudioRecorder owns the native shared object's unmount lifecycle.
      // Reading or stopping it here can race with Expo releasing it first.
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    },
    [clearLimit],
  );

  return {
    beginHold,
    cancel,
    elapsedMs: recorderState.durationMillis,
    endHold,
    status,
  };
}
