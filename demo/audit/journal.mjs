import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  link,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { AbiCoder, keccak256, toUtf8Bytes, concat } from "ethers";
const hashPattern = /^0x[0-9a-f]{64}$/;
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  if (
    value === undefined ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    throw new Error("Non-JSON audit value");
  return JSON.stringify(value);
}
export const digest = (value) => keccak256(toUtf8Bytes(canonical(value)));
export async function durableWrite(file, value, immutable = false) {
  const directory = path.dirname(file);
  await mkdir(directory, { recursive: true });
  const bytes = canonical(value) + "\n",
    temporary = `${file}.${randomBytes(6).toString("hex")}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    if (immutable) {
      try {
        await link(temporary, file);
      } catch (e) {
        if (e.code !== "EEXIST" || (await readFile(file, "utf8")) !== bytes)
          throw new Error("Immutable audit record conflict");
      }
      await unlink(temporary);
    } else await rename(temporary, file);
    const dir = await open(directory, "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
export function leafHash(domain, entry) {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "address", "uint256", "bytes32", "bytes32"],
      [
        domain.chainId,
        domain.address,
        domain.writer,
        entry.sequence,
        entry.intentId,
        entry.blobHash,
      ]
    )
  );
}
const pair = (a, b) =>
  keccak256(concat(BigInt(a) < BigInt(b) ? [a, b] : [b, a]));
export function merkle(leaves) {
  if (!leaves.length) throw new Error("Empty Merkle batch");
  const levels = [leaves];
  while (levels.at(-1).length > 1) {
    const level = levels.at(-1),
      next = [];
    for (let i = 0; i < level.length; i += 2)
      next.push(pair(level[i], level[i + 1] || level[i]));
    levels.push(next);
  }
  return {
    root: levels.at(-1)[0],
    proofs: leaves.map((_, i) => {
      const proof = [];
      for (const level of levels.slice(0, -1)) {
        proof.push(level[i ^ 1] || level[i]);
        i = Math.floor(i / 2);
      }
      return proof;
    }),
  };
}
export function verifyProof(leaf, proof, root) {
  return proof.reduce(pair, leaf) === root;
}
export class LocalJournal {
  constructor(directory) {
    this.directory = directory;
  }
  async init() {
    for (const dir of ["intents", "blobs", "decisions", "batches", "execution"])
      await mkdir(path.join(this.directory, dir), { recursive: true });
    return this;
  }
  file(kind, name) {
    if (!/^[a-zA-Z0-9.-]+$/.test(name))
      throw new Error("Invalid audit filename");
    return path.join(this.directory, kind, `${name}.json`);
  }
  async accept(intent) {
    if (!hashPattern.test(intent.id)) throw new Error("Invalid intent ID");
    await durableWrite(this.file("intents", intent.id), intent, true);
  }
  async intent(id) {
    if (!hashPattern.test(id)) throw new Error("Invalid intent ID");
    return JSON.parse(await readFile(this.file("intents", id), "utf8"));
  }
  async commit(record) {
    const intent = await this.intent(record.intentId);
    if (record.intentHash !== digest(intent))
      throw new Error("Decision is not bound to accepted intent");
    const blobHash = digest(record);
    await durableWrite(this.file("blobs", blobHash), record, true);
    const pointer = { intentId: record.intentId, blobHash };
    await durableWrite(this.file("decisions", record.intentId), pointer, true);
    return pointer;
  }
  async blob(hash) {
    if (!hashPattern.test(hash)) throw new Error("Invalid blob hash");
    const data = JSON.parse(await readFile(this.file("blobs", hash), "utf8"));
    if (digest(data) !== hash) throw new Error("Audit blob integrity failure");
    return data;
  }
  async entries() {
    const names = (await readdir(path.join(this.directory, "decisions")))
      .filter((n) => n.endsWith(".json"))
      .sort();
    const entries = [];
    for (const name of names) {
      const entry = JSON.parse(
        await readFile(path.join(this.directory, "decisions", name), "utf8")
      );
      const record = await this.blob(entry.blobHash);
      if (record.intentId !== entry.intentId)
        throw new Error("Journal pointer mismatch");
      entries.push(entry);
    }
    return entries;
  }
  async recover() {
    // A crash after a blob fsync but before its pointer leaves an orphan; repair it.
    for (const name of await readdir(path.join(this.directory, "blobs")))
      if (/^0x[0-9a-f]{64}\.json$/.test(name)) {
        const hash = name.slice(0, -5),
          record = await this.blob(hash);
        const intent = await this.intent(record.intentId);
        if (record.intentHash !== digest(intent))
          throw new Error("Orphan blob intent mismatch");
        await durableWrite(
          this.file("decisions", record.intentId),
          { intentId: record.intentId, blobHash: hash },
          true
        );
      }
    const entries = await this.entries(),
      decided = new Set(entries.map((e) => e.intentId));
    return {
      entries,
      pendingIntents: (await readdir(path.join(this.directory, "intents")))
        .filter((n) => /^0x[0-9a-f]{64}\.json$/.test(n))
        .map((n) => n.slice(0, -5))
        .filter((id) => !decided.has(id)),
    };
  }
  async execution(id, state) {
    await durableWrite(this.file("execution", id), state);
  }
  async status() {
    const { entries, pendingIntents } = await this.recover();
    const batches = [];
    for (const name of await readdir(path.join(this.directory, "batches")))
      if (name.endsWith(".json"))
        batches.push(
          JSON.parse(
            await readFile(path.join(this.directory, "batches", name), "utf8")
          )
        );
    const anchored = new Set(
      batches
        .filter((b) => b.state === "anchored")
        .flatMap((b) => b.entries.map((e) => e.intentId))
    );
    return {
      entries,
      pendingIntents,
      pendingReceipts: entries.filter((e) => !anchored.has(e.intentId)),
      batches,
    };
  }
}
