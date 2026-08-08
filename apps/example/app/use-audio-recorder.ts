"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_AUDIO_DURATION_MS = 2 * 60_000;

const preferredAudioTypes = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
];

type RecorderStatus = "idle" | "requesting" | "recording";

export function useAudioRecorder({
  onError,
  onRecorded,
}: {
  onError: (cause: unknown) => void;
  onRecorded: (audio: Blob, durationMs: number) => Promise<void>;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const cancelledRef = useRef(false);
  const onErrorRef = useRef(onError);
  const onRecordedRef = useRef(onRecorded);
  onErrorRef.current = onError;
  onRecordedRef.current = onRecorded;

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      clearTimers();
      releaseStream();
      setElapsedMs(0);
      setStatus("idle");
    }
  }, [clearTimers, releaseStream]);

  const start = useCallback(async () => {
    if (recorderRef.current || status !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onErrorRef.current(
        new Error("Audio recording is not supported in this browser"),
      );
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    cancelledRef.current = false;
    setElapsedMs(0);
    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (requestIdRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const mimeType = selectAudioMimeType(MediaRecorder.isTypeSupported);
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("This browser cannot record a supported audio format");
      }
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64_000,
      });
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener("error", () => {
        cancelledRef.current = true;
        onErrorRef.current(new Error("The browser could not record audio"));
      });
      recorder.addEventListener("stop", () => {
        const cancelled = cancelledRef.current;
        const durationMs = Math.min(
          MAX_AUDIO_DURATION_MS,
          Math.max(1, Date.now() - startedAt),
        );
        const recordedType =
          chunks.find((chunk) => chunk.type)?.type ||
          recorder.mimeType ||
          mimeType;
        const audio = new Blob(chunks, {
          type: recordedType,
        });
        clearTimers();
        releaseStream();
        recorderRef.current = null;
        setElapsedMs(0);
        setStatus("idle");
        if (!cancelled && audio.size > 0) {
          void onRecordedRef
            .current(audio, durationMs)
            .catch((cause) => onErrorRef.current(cause));
        }
      });

      recorder.start();
      setStatus("recording");
      intervalRef.current = window.setInterval(
        () => setElapsedMs(Date.now() - startedAt),
        250,
      );
      timeoutRef.current = window.setTimeout(stop, MAX_AUDIO_DURATION_MS);
    } catch (cause) {
      clearTimers();
      releaseStream();
      recorderRef.current = null;
      setElapsedMs(0);
      setStatus("idle");
      onErrorRef.current(cause);
    }
  }, [clearTimers, releaseStream, status, stop]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      cancelledRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      clearTimers();
      releaseStream();
    },
    [clearTimers, releaseStream],
  );

  return { cancel, elapsedMs, start, status, stop };
}

export function selectAudioMimeType(
  isTypeSupported: (mimeType: string) => boolean,
) {
  return preferredAudioTypes.find((mimeType) => isTypeSupported(mimeType));
}

export function audioFileExtension(mediaType: string) {
  const baseMediaType = mediaType.split(";", 1)[0]?.trim().toLowerCase();
  if (baseMediaType === "audio/mp4") return "m4a";
  if (baseMediaType === "audio/ogg") return "ogg";
  return "webm";
}

export function formatRecordingDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
