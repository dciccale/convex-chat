import { describe, expect, it } from "vitest";
import { audioTimeLabel } from "./audio-time";

describe("audioTimeLabel", () => {
  it("shows the full duration while idle or paused", () => {
    expect(
      audioTimeLabel({ currentTime: 6, duration: 758, playing: false }),
    ).toBe("12:38");
  });

  it("shows elapsed time only during playback", () => {
    expect(
      audioTimeLabel({ currentTime: 6, duration: 758, playing: true }),
    ).toBe("0:06");
  });
});
