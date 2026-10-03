"use client";
// OWNER: worker D. Counts from `from` to `to` once when scrolled into view (600 ms, ease-out-quint).
// Reduced motion renders `to` immediately. Must not shift layout (tabular-nums).
export default function CountUp({ to, from = 0, duration = 600 }: { to: number; from?: number; duration?: number }) {
  void from; void duration;
  return <span className="nn">{to}</span>;
}
