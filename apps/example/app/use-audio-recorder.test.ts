import { describe, expect, it } from "vitest";
import {
  audioFileExtension,
  formatRecordingDuration,
  selectAudioMimeType,
} from "./use-audio-recorder";

describe("audio recording helpers", () => {
  it("selects the first supported recording format", () => {
    expect(
      selectAudioMimeType(
        (mimeType) => mimeType === "audio/mp4;codecs=mp4a.40.2",
      ),
    ).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  it("prefers MP4 when a browser supports both native-friendly formats", () => {
    expect(selectAudioMimeType(() => true)).toBe("audio/mp4;codecs=mp4a.40.2");
  });

  it("rejects recording when no preferred format is supported", () => {
    expect(selectAudioMimeType(() => false)).toBeUndefined();
  });

  it.each([
    ["audio/webm;codecs=opus", "webm"],
    ["audio/mp4;codecs=mp4a.40.2", "m4a"],
    ["audio/ogg", "ogg"],
  ])("maps %s to .%s", (mediaType, extension) => {
    expect(audioFileExtension(mediaType)).toBe(extension);
  });

  it("formats elapsed recording time", () => {
    expect(formatRecordingDuration(65_900)).toBe("1:05");
  });
});
