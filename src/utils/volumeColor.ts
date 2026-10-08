/**
 * Smooth volume color interpolation helper.
 * 0% - 100%: Green (#22c55e)
 * 100% - 150%: Smooth transition from Green to Yellow (#eab308)
 * 150% - 200%: Smooth transition from Yellow to Red (#ef4444)
 */
export function getVolumeColor(volume: number): string {
  const clamped = Math.max(0, Math.min(2, volume));

  if (clamped <= 1.0) {
    // 0% to 100%: Solid vibrant green
    return '#22c55e';
  } else if (clamped <= 1.5) {
    // 100% to 150%: Green (#22c55e) -> Yellow (#eab308)
    const t = (clamped - 1.0) / 0.5;
    const r = Math.round(34 + (234 - 34) * t);
    const g = Math.round(197 + (179 - 197) * t);
    const b = Math.round(94 + (8 - 94) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 150% to 200%: Yellow (#eab308) -> Red (#ef4444)
    const t = (clamped - 1.5) / 0.5;
    const r = Math.round(234 + (239 - 234) * t);
    const g = Math.round(179 + (68 - 179) * t);
    const b = Math.round(8 + (68 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

/**
 * Returns a CSS linear-gradient string for styling the track of an input range slider (0 - 200%).
 */
export function getVolumeTrackStyle(volume: number, isMuted: boolean): React.CSSProperties {
  const fillPercent = Math.max(0, Math.min(100, (volume / 2) * 100));
  const color = isMuted ? '#64748b' : getVolumeColor(volume);

  return {
    accentColor: isMuted ? '#94a3b8' : color,
    background: `linear-gradient(to right, ${color} 0%, ${color} ${fillPercent}%, #334155 ${fillPercent}%, #334155 100%)`,
  };
}
