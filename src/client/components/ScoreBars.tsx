/** A row of bars, one per point, tallest at 100. */
export function ScoreBars({ points, testId, label }: { points: { key: string; value: number; title: string }[]; testId: string; label: string }) {
  if (!points.length) return null;
  return (
    <div className="space-y-1">
      <div className="flex h-16 items-end gap-1" role="img" aria-label={label}>
        {points.map((point) => (
          <div key={point.key} data-testid={testId} title={point.title} className="w-3 rounded-sm bg-primary/70" style={{ height: `${Math.max(4, point.value)}%` }} />
        ))}
      </div>
    </div>
  );
}
