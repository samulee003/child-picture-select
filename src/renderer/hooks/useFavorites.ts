import { useState, useEffect, useCallback } from 'react';
import type { MatchResult } from '../../types/api';
import { safeLocalStorageSet } from '../../utils/safe-storage';

export interface FavoritesState {
  favoritePaths: string[];
  setFavoritePaths: React.Dispatch<React.SetStateAction<string[]>>;
  exportOnlyFavorites: boolean;
  setExportOnlyFavorites: (v: boolean) => void;
  toggleFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;
  getFavoriteMatches: (results: MatchResult[]) => MatchResult[];
}

export function useFavorites(): FavoritesState {
  const [favoritePaths, setFavoritePaths] = useState<string[]>([]);
  const [exportOnlyFavorites, setExportOnlyFavorites] = useState(false);

  // Load on mount
  useEffect(() => {
    const saved = localStorage.getItem('favoriteMatchPaths');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setFavoritePaths(parsed.filter((item: unknown) => typeof item === 'string'));
        }
      } catch (err) {
        console.warn('Failed to load favorites:', err);
      }
    }
  }, []);

  // Persist
  useEffect(() => {
    safeLocalStorageSet('favoriteMatchPaths', JSON.stringify(favoritePaths));
  }, [favoritePaths]);

  const toggleFavorite = useCallback((path: string) => {
    setFavoritePaths((prev) => {
      if (prev.includes(path)) return prev.filter((item) => item !== path);
      return [...prev, path];
    });
  }, []);

  const isFavorite = useCallback((path: string) => favoritePaths.includes(path), [favoritePaths]);

  const getFavoriteMatches = useCallback((results: MatchResult[]) =>
    results.filter((r) => favoritePaths.includes(r.path)),
    [favoritePaths]);

  return {
    favoritePaths, setFavoritePaths,
    exportOnlyFavorites, setExportOnlyFavorites,
    toggleFavorite, isFavorite, getFavoriteMatches,
  };
}
