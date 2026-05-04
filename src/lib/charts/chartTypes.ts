/**
 * Base data point for time-series charts
 */
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

/**
 * Props for the Calendar Heatmap component
 */
export interface CalendarHeatmapProps {
  year: string | number;
  data: TimeSeriesDataPoint[];
  title?: string;
  height?: number | string;
}

/**
 * Original Market Signal structure (from API/Database)
 */
export interface MarketSignal {
  week_start: string;
  interest: number | string;
  keyword: string;
  country?: string;
  [key: string]: any;
}
