import { useState, useCallback, useEffect } from 'react';
import type { LoopRegion } from '../types';

const STORAGE_KEY = 'woodshed-bookmarks';

interface BookmarkStore {
  [trackId: string]: LoopRegion[];
}

function loadStore(): BookmarkStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: BookmarkStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function useBookmarks(trackId: string | null) {
  const [bookmarks, setBookmarks] = useState<LoopRegion[]>([]);

  // Load bookmarks when trackId changes
  useEffect(() => {
    if (!trackId) {
      setBookmarks([]);
      return;
    }
    const store = loadStore();
    setBookmarks(store[trackId] || []);
  }, [trackId]);

  const saveBookmark = useCallback(
    (name: string, start: number, end: number) => {
      if (!trackId) return;

      const bookmark: LoopRegion = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        start,
        end,
        color: getBookmarkColor(bookmarks.length),
      };

      const store = loadStore();
      const trackBookmarks = [...(store[trackId] || []), bookmark];
      store[trackId] = trackBookmarks;
      saveStore(store);
      setBookmarks(trackBookmarks);
    },
    [trackId, bookmarks.length]
  );

  const deleteBookmark = useCallback(
    (bookmarkId: string) => {
      if (!trackId) return;

      const store = loadStore();
      const trackBookmarks = (store[trackId] || []).filter(
        (b) => b.id !== bookmarkId
      );
      store[trackId] = trackBookmarks;
      saveStore(store);
      setBookmarks(trackBookmarks);
    },
    [trackId]
  );

  return { bookmarks, saveBookmark, deleteBookmark };
}

const BOOKMARK_COLORS = [
  'rgba(251, 191, 36, 0.3)',  // amber
  'rgba(52, 211, 153, 0.3)',  // emerald
  'rgba(96, 165, 250, 0.3)',  // blue
  'rgba(244, 114, 182, 0.3)', // pink
  'rgba(167, 139, 250, 0.3)', // violet
  'rgba(251, 146, 60, 0.3)',  // orange
];

function getBookmarkColor(index: number): string {
  return BOOKMARK_COLORS[index % BOOKMARK_COLORS.length];
}
