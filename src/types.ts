export interface NarratorCount {
  name: string;
  count: number | null;
  url?: string;
  checked_at?: string;
  lower_bound?: boolean;
  error?: string;
  source?: string;
  source_type?: string;
}

export type CountRecords = Record<string, NarratorCount>;
export interface CountedNarrator extends NarratorCount {
  count: number;
}

export interface RankedNarrator extends CountedNarrator {
  rank: number;
  key?: string;
}

export interface RankingReport {
  ranking: RankedNarrator[];
  unresolved?: NarratorCount[];
  coverage: string;
  metric?: string;
  scope?: string;
  generated_at?: string;
  total_narrators?: number;
  rank_limit?: number;
}

export interface CatalogResponse {
  products: unknown[];
  total_results: number;
}
