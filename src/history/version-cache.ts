/**
 * Cache for package version history data
 * Uses longer TTL for historical versions (immutable) vs current version
 */

import { Cache } from '../fetcher/cache.js';
import type { PackageVersionHistory, VersionedSourceResult } from './types.js';

// Version history cache - longer TTL since upgrade history rarely changes
export const versionHistoryCache = new Cache<PackageVersionHistory>({
  ttlMs: 30 * 60 * 1000, // 30 minutes
  maxEntries: 50,
});

// Versioned source cache - very long TTL since historical versions are immutable
export const versionedSourceCache = new Cache<VersionedSourceResult>({
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours for historical versions
  maxEntries: 100,
});

/**
 * Generate cache key for version history
 */
export function getHistoryCacheKey(network: string, packageId: string): string {
  return `history:${network}:${packageId}`;
}

/**
 * Generate cache key for versioned source
 */
export function getVersionedSourceCacheKey(
  network: string,
  packageId: string,
  version: number
): string {
  return `source:${network}:${packageId}:v${version}`;
}
