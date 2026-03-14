import { useState, useCallback, useMemo } from 'react';
import type { MatchResult } from '../../types/api';

export interface ReviewState {
  reviewMode: boolean;
  setReviewMode: (v: boolean) => void;
  reviewDecisions: Record<string, 'accepted' | 'rejected'>;
  setReviewDecisions: React.Dispatch<React.SetStateAction<Record<string, 'accepted' | 'rejected'>>>;
  reviewScores: Record<string, number>;
  setReviewScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  reviewFilter: 'all' | 'pending' | 'low';
  setReviewFilter: (f: 'all' | 'pending' | 'low') => void;
  isTopTwentyView: boolean;
  setIsTopTwentyView: React.Dispatch<React.SetStateAction<boolean>>;
  compactView: boolean;
  setCompactView: React.Dispatch<React.SetStateAction<boolean>>;

  // Computed
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
  lowConfidenceCount: number;
  filteredResults: MatchResult[];
  displayedResults: MatchResult[];

  // Callbacks
  handleDecision: (path: string, decision: 'accepted' | 'rejected' | null) => void;
  handleReviewScore: (path: string, score: number) => void;
  handleBatchDecision: (decision: 'accepted' | 'rejected' | null) => void;
  isLowConfidence: (item: MatchResult) => boolean;
}

export function useReviewState(results: MatchResult[]): ReviewState {
  const [reviewMode, setReviewMode] = useState(true);
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [reviewScores, setReviewScores] = useState<Record<string, number>>({});
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'low'>('all');
  const [isTopTwentyView, setIsTopTwentyView] = useState(false);
  const [compactView, setCompactView] = useState(true);

  const isLowConfidence = useCallback((item: MatchResult) => {
    const score = typeof reviewScores[item.path] === 'number'
      ? reviewScores[item.path]
      : Math.round(item.score * 100);
    return score < 65;
  }, [reviewScores]);

  const handleDecision = useCallback((path: string, decision: 'accepted' | 'rejected' | null) => {
    setReviewDecisions(prev => {
      if (decision === null) {
        const next = { ...prev };
        delete next[path];
        return next;
      }
      return { ...prev, [path]: decision };
    });
  }, []);

  const handleReviewScore = useCallback((path: string, score: number) => {
    setReviewScores(prev => ({ ...prev, [path]: score }));
  }, []);

  const handleBatchDecision = useCallback((decision: 'accepted' | 'rejected' | null) => {
    setReviewDecisions(() => {
      if (decision === null) return {};
      const next: Record<string, 'accepted' | 'rejected'> = {};
      results.forEach((item) => { next[item.path] = decision; });
      return next;
    });
  }, [results]);

  const acceptedCount = useMemo(() =>
    results.reduce((count, item) => count + (reviewDecisions[item.path] === 'accepted' ? 1 : 0), 0),
    [results, reviewDecisions]);

  const rejectedCount = useMemo(() =>
    results.reduce((count, item) => count + (reviewDecisions[item.path] === 'rejected' ? 1 : 0), 0),
    [results, reviewDecisions]);

  const pendingCount = results.length - acceptedCount - rejectedCount;

  const lowConfidenceCount = useMemo(() =>
    results.filter(isLowConfidence).length,
    [results, isLowConfidence]);

  const filteredResults = useMemo(() =>
    results.filter((item) => {
      if (reviewFilter === 'pending') return !reviewDecisions[item.path];
      if (reviewFilter === 'low') return isLowConfidence(item);
      return true;
    }),
    [results, reviewFilter, reviewDecisions, isLowConfidence]);

  const displayedResults = useMemo(() =>
    isTopTwentyView
      ? [...filteredResults].sort((a, b) => b.score - a.score).slice(0, 20)
      : filteredResults,
    [isTopTwentyView, filteredResults]);

  return {
    reviewMode, setReviewMode,
    reviewDecisions, setReviewDecisions,
    reviewScores, setReviewScores,
    reviewFilter, setReviewFilter,
    isTopTwentyView, setIsTopTwentyView,
    compactView, setCompactView,
    acceptedCount, rejectedCount, pendingCount, lowConfidenceCount,
    filteredResults, displayedResults,
    handleDecision, handleReviewScore, handleBatchDecision,
    isLowConfidence,
  };
}
