import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AIIndexingActions from './AIIndexingActions';
import type { EmbeddingJobStats, VectorStatus } from './AIIndexingStatus';

const readyVector: VectorStatus = {
  available: true,
  dimensions: 1536,
  indexName: 'document_embeddings_embedding_hnsw_1536_idx',
  installed: true,
  version: '0.8.0',
};

const emptyJobs: EmbeddingJobStats = {
  failed: 0,
  pending: 0,
  running: 0,
  succeeded: 0,
};

function renderActions({
  jobStats = emptyJobs,
  paused = false,
  vectorStatus = readyVector,
}: {
  jobStats?: EmbeddingJobStats;
  paused?: boolean;
  vectorStatus?: VectorStatus;
} = {}) {
  return render(
    <AIIndexingActions
      batchSize={5}
      busyAction={null}
      jobStats={jobStats}
      paused={paused}
      runAction={vi.fn()}
      vectorStatus={vectorStatus}
    />
  );
}

describe('AIIndexingActions', () => {
  it('removes one-time and irrelevant task actions when the index is ready and idle', () => {
    renderActions({ jobStats: { ...emptyJobs, succeeded: 12 } });

    expect(screen.queryByText('enablePgvector')).not.toBeInTheDocument();
    expect(screen.queryByText('processBatch')).not.toBeInTheDocument();
    expect(screen.queryByText('retryFailedCount')).not.toBeInTheDocument();
    expect(screen.getByText('maintenanceActions')).toBeVisible();
    expect(screen.getByText('backfill')).toBeVisible();
    expect(screen.getByText('pause')).toBeVisible();
    expect(screen.getByText('clearIndex')).toBeVisible();
  });

  it('only offers setup before pgvector and its index are ready', () => {
    renderActions({ vectorStatus: { ...readyVector, indexName: null, installed: false } });

    expect(screen.getByText('enablePgvector')).toBeVisible();
    expect(screen.queryByText('maintenanceActions')).not.toBeInTheDocument();
  });

  it('shows task actions only when matching jobs exist', () => {
    renderActions({
      jobStats: { failed: 2, pending: 8, running: 0, succeeded: 12 },
    });

    expect(screen.getByText('recommendedActions')).toBeVisible();
    expect(screen.getByText('retryFailedCount')).toBeVisible();
    expect(screen.getByText('processBatch')).toBeVisible();
  });

  it('replaces processing and pause actions with resume while paused', () => {
    renderActions({
      jobStats: { ...emptyJobs, pending: 8 },
      paused: true,
    });

    expect(screen.getByText('resume')).toBeVisible();
    expect(screen.queryByText('processBatch')).not.toBeInTheDocument();
    expect(screen.queryByText('pause')).not.toBeInTheDocument();
  });

  it('shows no actions when pgvector is unavailable', () => {
    const { container } = renderActions({
      vectorStatus: { ...readyVector, available: false, indexName: null, installed: false },
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps stale vector data clearable when pgvector is unavailable', () => {
    renderActions({
      jobStats: { failed: 2, pending: 3, running: 0, succeeded: 12 },
      vectorStatus: { ...readyVector, available: false, indexName: null, installed: false },
    });

    expect(screen.getByText('maintenanceActions')).toBeVisible();
    expect(screen.getByText('clearIndex')).toBeVisible();
    expect(screen.queryByText('backfill')).not.toBeInTheDocument();
    expect(screen.queryByText('pause')).not.toBeInTheDocument();
  });
});
