import ts from "typescript";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { documentation } from "../vite-project/src/lib/documentation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Compile integration fragments as sdk/integration.ts, with prerequisites typed
// against the actual installed SDK/ethers. Nothing is executed, signed or cast.
const prerequisites = `
import { ethers as _ethers, type Signer as _Signer } from 'ethers';
import { GuardedPaymentClient as _Guard, AgentPaySDK as _SDK } from './src';
declare const signer: _Signer;
declare const ethers: typeof _ethers;
declare const parseEther: typeof _ethers.parseEther;
declare const client: _Guard;
declare const sdk: _SDK;
declare const token: _ethers.Contract;
declare const stream: _ethers.Contract;
declare const privateKey: string, rpcUrl: string, apiKey: string;
declare const guardAddress: string, settlementAddress: string, requestId: string;
declare const recipient: string, streamAddress: string, mockUsdAddress: string, providerRecipient: string;
`;
const markdownPaths = [
  "DEPLOYMENT.md",
  "docs/sdk/guarded-payment-client.md",
  "docs/sdk/agentpay-sdk.md",
  "docs/architecture/payment-streams.md",
  "docs/contracts/agentpaystream.md",
  "docs/contracts/mock-usd.md",
  "docs/USDC_SEPOLIA.md",
];
const snippets = [];
for (const file of markdownPaths) {
  const text = readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(/```ts\n([\s\S]*?)```/g))
    snippets.push({
      label: `${file}:${text.slice(0, match.index).split("\n").length}`,
      code: match[1],
    });
}
for (const [key, page] of Object.entries(documentation)) {
  for (const section of page.sections)
    for (const block of section.blocks)
      if (block.type === "code" && block.label === "TypeScript")
        snippets.push({ label: `frontend/docs/${key}`, code: block.text });
}
// Agent setup uses the same generator that the UI calls; test its actual text.
const { guardedExample } = await import(
  "../vite-project/src/lib/guarded-example.mjs"
);
snippets.push({
  label: "frontend/agent generated example",
  code: guardedExample(
    {
      guard: "0x0000000000000000000000000000000000000011",
      settlement: "0x0000000000000000000000000000000000000012",
      recipient: "0x0000000000000000000000000000000000000013",
    },
    10000n
  ),
});

const virtualFiles = new Map();
for (const [index, snippet] of snippets.entries()) {
  const ast = ts.createSourceFile(
    "fragment.ts",
    snippet.code,
    ts.ScriptTarget.ES2020,
    true
  );
  const imports = ast.statements
    .filter(ts.isImportDeclaration)
    .map((node) => node.getFullText(ast));
  const body = ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getFullText(ast));
  virtualFiles.set(path.join(root, `sdk/.doc-example-${index}.ts`), {
    label: snippet.label,
    source: `${
      imports.join("\n").includes("parseEther")
        ? prerequisites.replace(
            "declare const parseEther: typeof _ethers.parseEther;",
            ""
          )
        : prerequisites
    }\n${imports.join("\n")}\nasync function example() {\n${body.join(
      "\n"
    )}\n}\n`,
  });
}
const options = {
  noEmit: true,
  strict: true,
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  esModuleInterop: true,
  skipLibCheck: true,
  types: ["node"],
  typeRoots: [path.join(root, "sdk/node_modules/@types")],
};
const host = ts.createCompilerHost(options);
const originalRead = host.readFile.bind(host),
  originalExists = host.fileExists.bind(host);
host.readFile = (file) => virtualFiles.get(file)?.source ?? originalRead(file);
host.fileExists = (file) => virtualFiles.has(file) || originalExists(file);
const program = ts.createProgram([...virtualFiles.keys()], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
for (const diagnostic of diagnostics) {
  const label =
    virtualFiles.get(diagnostic.file?.fileName)?.label ??
    diagnostic.file?.fileName ??
    "compiler";
  console.error(
    `${label}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`
  );
}
if (diagnostics.length) process.exitCode = 1;
else
  console.log(
    `Typechecked ${snippets.length} exact documentation/UI fragments against SDK and ethers types. External prerequisites are declared; examples were not executed.`
  );
