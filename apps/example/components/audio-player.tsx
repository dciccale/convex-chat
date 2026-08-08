"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { audioTimeLabel } from "./audio-time";

export function AudioPlayer({
  src,
  label,
  declaredDurationMs,
}: {
  src: string;
  label: string;
  declaredDurationMs?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(
    declaredDurationMs ? declaredDurationMs / 1000 : 0,
  );

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(value: number[]) {
    const nextTime = value[0] ?? 0;
    setCurrentTime(nextTime);
    if (audioRef.current) audioRef.current.currentTime = nextTime;
  }

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        aria-label={label}
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration)) {
            setDuration(event.currentTarget.duration);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(event) =>
          setCurrentTime(event.currentTarget.currentTime)
        }
      />
      <Button
        className="audio-play-button"
        variant="secondary"
        size="icon"
        type="button"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        onClick={() => void togglePlayback()}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="audio-track">
        <div className="audio-label">
          <span>Voice message</span>
        </div>
        <Slider
          aria-label="Voice message position"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={[Math.min(currentTime, Math.max(duration, 1))]}
          onValueChange={seek}
        />
        <div className="audio-time">
          <span
            aria-label={
              playing ? "Voice message playback time" : "Voice message duration"
            }
          >
            {audioTimeLabel({ currentTime, duration, playing })}
          </span>
        </div>
      </div>
    </div>
  );
}
