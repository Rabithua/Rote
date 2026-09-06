import { parseArgs } from 'node:util';
import { recoverLegacyIndex } from '../embeddings/legacyIndexRecovery';
import { EmbeddingError } from '../embeddings/errors';
import { closeDatabase } from '../utils/drizzle';

async function main() {
  const { values } = parseArgs({
    options: {
      revision: { type: 'string' },
      'confirm-provider': { type: 'string' },
      apply: { type: 'boolean', default: false },
      'max-incremental-sources': { type: 'string', default: '0' },
    },
    strict: true,
  });
  try {
    if (
      values.revision === undefined ||
      !/^\d+$/.test(values.revision) ||
      !values['confirm-provider'] ||
      !/^\d+$/.test(values['max-incremental-sources']!)
    )
      throw new EmbeddingError('embedding_config_invalid', 400);
    const result = await recoverLegacyIndex({
      revision: Number(values.revision),
      confirmedProvider: values['confirm-provider'],
      apply: values.apply,
      maxIncrementalSources: Number(values['max-incremental-sources']),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(error instanceof EmbeddingError ? { code: error.code, details: error.details } : { code: 'embedding_legacy_recovery_failed' })}\n`
    );
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
void main();
