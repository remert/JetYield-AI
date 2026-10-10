export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function usdCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)}K`;
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;
export const hrs = (n: number) => `${Math.round(n).toLocaleString("en-US")} hrs`;
