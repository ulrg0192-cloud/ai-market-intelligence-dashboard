declare module 'google-trends-api' {
  export interface InterestOverTimeOptions {
    keyword: string | string[];
    geo?: string;
    hl?: string;
    timeframe?: string;
    category?: number;
    property?: string;
  }

  export function interestOverTime(
    options: InterestOverTimeOptions
  ): Promise<string>;

  export function interestByRegion(
    options: any
  ): Promise<string>;

  export function relatedQueries(
    options: any
  ): Promise<string>;

  export function relatedTopics(
    options: any
  ): Promise<string>;

  export function dailyTrends(
    options: any
  ): Promise<string>;

  export function realtimeTrends(
    options: any
  ): Promise<string>;
}
