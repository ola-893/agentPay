// Internal validator, not a public command. Reuse the workflow's actual schema.
import { readFileSync } from 'node:fs';
import { configSchema, evaluate } from '../../cre/payment-guard/policy';
try {
  const config = configSchema.parse(
    JSON.parse(readFileSync(process.argv[2], 'utf8'))
  );
  if (process.argv[3]) {
    const result = JSON.parse(process.argv[3]);
    for (const field of [
      'chainlinkPriceUsd8',
      'externalPriceUsd8',
      'feedRoundId',
    ]) {
      if (typeof result[field] !== 'string' || !/^[0-9]+$/.test(result[field]))
        throw new Error('Invalid integer observation.');
    }
    if (!Number.isSafeInteger(result.feedUpdatedAt))
      throw new Error('Invalid feed timestamp.');
    // The output has no answeredInRound; completed-round validation remains the
    // workflow's responsibility. Re-evaluate every observable policy condition.
    const roundId = BigInt(result.feedRoundId);
    const decision = evaluate(
      config,
      {
        price: BigInt(result.chainlinkPriceUsd8),
        decimals: 8,
        updatedAt: result.feedUpdatedAt,
        roundId,
        answeredInRound: roundId,
      },
      BigInt(result.externalPriceUsd8),
      result.observedAt
    );
    if (
      decision.approved !== result.approved ||
      decision.reason !== result.reason
    )
      throw new Error('Result contradicts policy evaluation.');
  }
} catch (error: any) {
  console.error(
    error.issues
      ? error.issues
          .map((i: any) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
      : 'Invalid JSON, integer observations or policy decision.'
  );
  process.exitCode = 2;
}
