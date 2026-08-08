export function audioTimeLabel({
  currentTime,
  duration,
  playing,
}: {
  currentTime: number;
  duration: number;
  playing: boolean;
}) {
  return formatTime(playing ? currentTime : duration);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
