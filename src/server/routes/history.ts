/**
 * Package version history API endpoints
 * - GET/POST /api/history - Get version history
 * - POST /api/compare - Compare two versions
 */

import { ServerResponse } from 'http';
import type { Network } from '../../types/index.js';
import { createVersionFetcher } from '../../history/index.js';
import {
  createStructuralDiffer,
  createSourceDiffer,
  type StructuralDiff,
  type SourceDiff,
} from '../../diff/index.js';

interface HistoryRequest {
  packageId: string;
  network?: Network;
}

interface CompareRequest {
  packageId: string;
  network?: Network;
  fromVersion: number;
  toVersion: number;
  diffType?: 'structural' | 'source' | 'both';
  module?: string;
}

interface HistoryResponse {
  originalPackageId: string;
  upgradeCapId?: string;
  versions: Array<{
    packageId: string;
    version: number;
    previousPackageId?: string;
    publishedAt?: string;
    digest?: string;
    sender?: string;
    timestampMs?: string;
  }>;
  currentVersion: number;
  network: Network;
  fetchedAt: string;
}

interface CompareResponse {
  metadata: {
    fromPackageId: string;
    toPackageId: string;
    fromVersion: number;
    toVersion: number;
    network: string;
    comparedAt: string;
  };
  structural?: StructuralDiff;
  sources?: Record<string, SourceDiff>;
}

/**
 * Validate network
 */
function validateNetwork(network: string | undefined): Network {
  const valid: Network[] = ['mainnet', 'testnet', 'devnet'];
  if (!network) return 'mainnet';
  if (!valid.includes(network as Network)) {
    throw new Error(`Invalid network: ${network}. Valid options: ${valid.join(', ')}`);
  }
  return network as Network;
}

/**
 * Validate package ID format
 */
function validatePackageId(packageId: string | undefined): string {
  if (!packageId) {
    throw new Error('packageId is required');
  }
  const hexPattern = /^0x[a-fA-F0-9]+$/;
  if (!hexPattern.test(packageId)) {
    throw new Error(`Invalid package ID format: ${packageId}`);
  }
  return packageId;
}

/**
 * Handle GET/POST /api/history
 * Returns version history for a package
 */
export async function handleHistory(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void
): Promise<void> {
  try {
    const req = body as HistoryRequest;
    const packageId = validatePackageId(req.packageId);
    const network = validateNetwork(req.network);

    const versionFetcher = createVersionFetcher(network);
    const history = await versionFetcher.getVersionHistory(packageId);

    const response: HistoryResponse = {
      originalPackageId: history.originalPackageId,
      upgradeCapId: history.upgradeCapId,
      versions: history.versions.map((v) => ({
        packageId: v.packageId,
        version: v.version,
        previousPackageId: v.previousPackageId,
        publishedAt: v.publishedAt,
        digest: v.digest,
        sender: v.sender,
        timestampMs: v.timestampMs,
      })),
      currentVersion: history.currentVersion,
      network: history.network,
      fetchedAt: history.fetchedAt,
    };

    sendJson(res, response);
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to fetch history', 400);
  }
}

/**
 * Handle POST /api/compare
 * Compares two package versions
 */
export async function handleCompare(
  body: unknown,
  res: ServerResponse,
  sendJson: (res: ServerResponse, data: unknown, status?: number) => void,
  sendError: (res: ServerResponse, message: string, status?: number) => void
): Promise<void> {
  try {
    const req = body as CompareRequest;
    const packageId = validatePackageId(req.packageId);
    const network = validateNetwork(req.network);
    const diffType = req.diffType ?? 'both';

    if (typeof req.fromVersion !== 'number' || typeof req.toVersion !== 'number') {
      throw new Error('fromVersion and toVersion are required and must be numbers');
    }

    if (req.fromVersion < 1 || req.toVersion < 1) {
      throw new Error('Version numbers must be >= 1');
    }

    const versionFetcher = createVersionFetcher(network);

    // Get version history to validate versions
    const history = await versionFetcher.getVersionHistory(packageId);

    const fromPkg = history.versions.find((v) => v.version === req.fromVersion);
    const toPkg = history.versions.find((v) => v.version === req.toVersion);

    if (!fromPkg) {
      throw new Error(
        `Version ${req.fromVersion} not found. Available: ${history.versions.map((v) => v.version).join(', ')}`
      );
    }
    if (!toPkg) {
      throw new Error(
        `Version ${req.toVersion} not found. Available: ${history.versions.map((v) => v.version).join(', ')}`
      );
    }

    // Fetch source/ABI for both versions
    const fromSource = await versionFetcher.getSourceAtVersion(
      history.originalPackageId,
      req.fromVersion,
      { modules: req.module ? [req.module] : undefined }
    );

    const toSource = await versionFetcher.getSourceAtVersion(
      history.originalPackageId,
      req.toVersion,
      { modules: req.module ? [req.module] : undefined }
    );

    // Build response
    const response: CompareResponse = {
      metadata: {
        fromPackageId: fromPkg.packageId,
        toPackageId: toPkg.packageId,
        fromVersion: req.fromVersion,
        toVersion: req.toVersion,
        network,
        comparedAt: new Date().toISOString(),
      },
    };

    // Structural diff
    if (diffType === 'structural' || diffType === 'both') {
      const structuralDiffer = createStructuralDiffer();
      response.structural = structuralDiffer.comparePackages(
        fromSource.abi,
        toSource.abi,
        req.fromVersion,
        req.toVersion,
        fromPkg.packageId,
        toPkg.packageId
      );
    }

    // Source diff
    if (diffType === 'source' || diffType === 'both') {
      const sourceDiffer = createSourceDiffer();
      response.sources = sourceDiffer.diffPackage(
        fromSource.disassembled,
        toSource.disassembled,
        req.fromVersion,
        req.toVersion,
        { modules: req.module ? [req.module] : undefined }
      );
    }

    sendJson(res, response);
  } catch (error) {
    sendError(res, error instanceof Error ? error.message : 'Failed to compare versions', 400);
  }
}
