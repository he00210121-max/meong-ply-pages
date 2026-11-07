export type RecommendationModel = 'gemini' | 'groq';

export interface HistoryTrack {
  title: string;
  artist: string;
  timestamp?: number;
}

export interface DetailedOptions {
  model?: RecommendationModel;
  includeAiMusic?: boolean;
  vocalPreference?: 'all' | 'vocal' | 'instrumental';
  vibe?: string;
  genre?: string;
  era?: string;
  region?: string;
  popularity?: 'popular' | 'hidden' | 'any';
  coverPreference?: 'original' | 'cover' | 'any';
  excludedMusic?: string;
  excludeHistory?: HistoryTrack[];
}

export interface SongItem {
  number: number;
  title: string;
  artist: string;
  reason: string;
  releaseYear?: string;
  country?: string;
  genre?: string;
  isInstrumental?: boolean;
  isCover?: boolean;
  isAiMusic?: boolean;
  vibe?: string;
  youtubeSearchQuery: string;
}

export interface AnalysisSummary {
  country: string;
  genre: string;
  era: string;
  vocalType: string;
  moodAndSituation?: string;
  isCover?: boolean;
  excludedMusic?: string;
}

export interface VerificationInfo {
  countryCondition: string;
  genreCondition: string;
  eraCondition: string;
  vocalCondition: string;
  allConstraintsMet: boolean;
  isVerifiedByExternalApi: boolean;
  verificationSource: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isCached?: boolean;
}

export interface PlaylistResult {
  playlistTitle: string;
  playlistDescription: string;
  tags: string[];
  totalCount: number;
  requestedCount: number;
  shortageReason?: string;
  analysis?: AnalysisSummary;
  verification?: VerificationInfo;
  songs: SongItem[];
  executionTimeMs?: number;
  modelUsed?: string;
  modelProvider?: RecommendationModel;
  source?: 'ai' | 'cache';
  tokenUsage?: TokenUsage;
}

export type ScreenState = 'input' | 'loading' | 'result' | 'error';

