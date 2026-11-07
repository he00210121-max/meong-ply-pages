/**
 * Track normalization and browser-local recommendation history
 * Pure utility with zero personal information stored.
 */

import type { HistoryTrack, SongItem } from '../types.ts';

const STORAGE_KEY = 'meongply_recent_history';
const MAX_HISTORY_TRACKS = 60;

/**
 * Normalizes a song title to catch remasters, featuring tags, live editions, etc.
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    // Remove parenthesized editions: (2020 Remaster), [Remastered], (feat. ...), (Live at ...), etc.
    .replace(/\s*[\(\[][\s\S]*?(?:feat|ft\b|featuring|remaster|live|acoustic|deluxe|version|edit|bonus|ost|official|audio|mv|special|stereo|mono)[\s\S]*?[\)\]]/gi, '')
    // Remove hyphenated editions: - 2020 Remaster, - Remastered, - Live, etc.
    .replace(/\s*-\s*[\s\S]*?(?:remaster|live|acoustic|deluxe|version|edit|bonus|ost|official|audio|mv|special)[\s\S]*$/gi, '')
    // Strip non-alphanumeric except Korean, Japanese, Chinese, English, numbers
    .replace(/[^\w\s\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeArtist(artist: string): string {
  if (!artist) return '';
  return artist
    .toLowerCase()
    .replace(/\s*[\(\[][\s\S]*?(?:feat|featuring|with)[\s\S]*?[\)\]]/gi, '')
    .replace(/\s+(?:feat|featuring|ft|with|x|&)\b[\s\S]*/gi, '')
    .replace(/[^\w\s\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a deterministic canonical key for deduplication and overlap check
 */
export function getTrackKey(title: string, artist: string): string {
  const normT = normalizeTitle(title);
  const normA = normalizeArtist(artist);
  return `${normT}___${normA}`;
}

/**
 * Get recent recommended tracks from localStorage
 */
export function getRecentHistory(): HistoryTrack[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, MAX_HISTORY_TRACKS);
    }
  } catch (err) {
    console.warn('Failed to read meongply recent history from localStorage:', err);
  }
  return [];
}

/**
 * Save newly recommended songs to localStorage, prioritizing the most recent ones.
 * Automatically deduplicates against existing history.
 */
export function saveToHistory(songs: SongItem[]): HistoryTrack[] {
  if (typeof window === 'undefined' || !window.localStorage || !songs || songs.length === 0) {
    return [];
  }
  try {
    const existing = getRecentHistory();
    const seen = new Set<string>();

    const newEntries: HistoryTrack[] = [];
    for (const song of songs) {
      const key = getTrackKey(song.title, song.artist);
      if (!seen.has(key)) {
        seen.add(key);
        newEntries.push({
          title: song.title.trim(),
          artist: song.artist.trim(),
          timestamp: Date.now(),
        });
      }
    }

    // Append prior history that hasn't been duplicated
    for (const item of existing) {
      const key = getTrackKey(item.title, item.artist);
      if (!seen.has(key)) {
        seen.add(key);
        newEntries.push(item);
      }
    }

    const trimmed = newEntries.slice(0, MAX_HISTORY_TRACKS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.warn('Failed to save meongply recent history to localStorage:', err);
    return [];
  }
}

/**
 * Clear recent recommendation history
 */
export function clearHistory(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear meongply history:', err);
  }
}
