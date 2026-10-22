import { readFile } from "node:fs/promises";
export const DEFAULT_PROFILE = new URL(
  "../agents/treasury-research.json",
  import.meta.url
);
export const POLICY_LIMITS = Object.freeze({
  depositCapRaw: [1, 100000],
  maxRateRawPerSecond: [1, 100],
  maxPegDeviationBps: [1, 100],
  maxDeviationBps: [1, 100],
  maxFeedAgeSeconds: [60, 86400],
  maxFailedRequests: [1, 3],
});
export function validatePolicy(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !==
      Object.keys(POLICY_LIMITS).sort().join()
  )
    throw new Error("Supply exactly the six supported policy fields.");
  for (const [key, [min, max]] of Object.entries(POLICY_LIMITS)) {
    const raw = key.endsWith("Raw") || key.endsWith("PerSecond");
    if (
      raw
        ? typeof value[key] !== "string" ||
          !/^[1-9][0-9]{0,5}$/.test(value[key])
        : !Number.isSafeInteger(value[key])
    )
      throw new Error(`Invalid ${key}.`);
    const n = Number(value[key]);
    if (n < min || n > max)
      throw new Error(`${key} must be between ${min} and ${max}.`);
  }
  return { ...value };
}
export async function loadProfile(file = DEFAULT_PROFILE) {
  const profile = JSON.parse(await readFile(file, "utf8"));
  const reference = JSON.parse(await readFile(DEFAULT_PROFILE, "utf8"));
  if (
    !/^[a-z0-9-]{3,60}$/.test(profile.id) ||
    typeof profile.name !== "string" ||
    profile.name.length > 80 ||
    profile.registration !== "local-profile" ||
    profile.chainId !== 11155111 ||
    profile.token?.toLowerCase() !==
      "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" ||
    JSON.stringify(profile.quote) !==
      JSON.stringify({
        amountRaw: "10000",
        premiumAmountRaw: "200000",
        durationSeconds: 1000,
      }) ||
    ![profile.payer, profile.recipient, profile.escrow].every(
      (a) =>
        typeof a === "string" &&
        /^0x[0-9a-f]{40}$/i.test(a) &&
        !/^0x0{40}$/i.test(a)
    ) ||
    profile.payer.toLowerCase() === profile.recipient.toLowerCase()
  )
    throw new Error("Invalid registered profile identity or fixed quote.");

  // Profiles cannot change the registered payer, destination, token or quote.
  for (const key of Object.keys(reference).filter((k) => k !== "policy"))
    if (JSON.stringify(profile[key]) !== JSON.stringify(reference[key]))
      throw new Error(`Profile cannot change ${key}.`);
  if (
    Object.keys(profile).sort().join() !== Object.keys(reference).sort().join()
  )
    throw new Error("Unknown profile field.");
  return { ...profile, policy: validatePolicy(profile.policy) };
}
