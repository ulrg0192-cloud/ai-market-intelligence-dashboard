import { MarketSignal, TimeSeriesDataPoint } from "./chartTypes";

/**
 * Transforms market signals into an aggregated time-series for the Calendar Heatmap.
 * Groups interest scores by date across all keywords.
 */
export const transformCalendarData = (signals: MarketSignal[]): TimeSeriesDataPoint[] => {
  if (!signals || signals.length === 0) return [];

  const dailyMap: Record<string, number> = {};

  signals.forEach((signal) => {
    const date = signal.week_start;
    if (date) {
      dailyMap[date] = (dailyMap[date] || 0) + Number(signal.interest || 0);
    }
  });

  return Object.entries(dailyMap)
    .map(([date, value]) => ({
      date,
      value,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Extracts the most relevant year from a set of market signals.
 */
export const extractLatestYear = (signals: MarketSignal[]): number => {
  if (!signals || signals.length === 0) return new Date().getFullYear();

  const years = signals
    .map((s) => new Date(s.week_start).getFullYear())
    .filter((y) => !isNaN(y));

  return years.length > 0 ? Math.max(...years) : new Date().getFullYear();
};
