import { readFileSync } from "node:fs";
import {
  streamConfigSchema,
  validateStreamResult,
} from "../../cre/payment-guard/stream-policy";
try {
  const config = streamConfigSchema.parse(
    JSON.parse(readFileSync(process.argv[2], "utf8"))
  );
  if (process.argv[3])
    validateStreamResult(config, JSON.parse(process.argv[3]));
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Invalid stream configuration"
  );
  process.exitCode = 2;
}
