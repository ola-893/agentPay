import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  documentation,
  documentationSections,
} from '../vite-project/src/lib/documentation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issues = [];
const exists = async (target, origin) => {
  try {
    await access(target);
  } catch {
    issues.push(`${origin}: missing ${path.relative(root, target)}`);
  }
};
async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((e) => e.name !== 'evidence')
        .map(async (entry) => {
          const target = path.join(directory, entry.name);
          return entry.isDirectory()
            ? markdownFiles(target)
            : entry.name.endsWith('.md')
            ? [target]
            : [];
        })
    )
  ).flat();
}
const files = [
  path.join(root, 'README.md'),
  path.join(root, 'DEPLOYMENT.md'),
  path.join(root, 'vite-project/README.md'),
  ...(await markdownFiles(path.join(root, 'docs'))),
];
for (const file of files) {
  const markdown = (await readFile(file, 'utf8')).replace(
    /```[\s\S]*?```/g,
    ''
  );
  for (const match of markdown.matchAll(
    /!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
  )) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const local = decodeURIComponent(href.split('#')[0]);
    await exists(
      path.resolve(path.dirname(file), local),
      path.relative(root, file)
    );
  }
}
const routes = new Set([
  '/',
  '/docs',
  ...documentationSections.map(([key]) => `/docs/${key}`),
]);
for (const [key, label] of documentationSections) {
  const page = documentation[key];
  if (!page?.title || !page.sections?.length) {
    issues.push(`Frontend docs: missing page ${label}`);
    continue;
  }
  await exists(path.join(root, page.source), `Frontend docs/${key}`);
  for (const [to] of page.related) {
    if (to.startsWith('/') && !routes.has(to))
      issues.push(`Frontend docs/${key}: missing route ${to}`);
    const repositoryPrefix = 'https://github.com/ola-893/agentPay/blob/main/';
    if (to.startsWith(repositoryPrefix))
      await exists(
        path.join(root, to.slice(repositoryPrefix.length)),
        `Frontend docs/${key}`
      );
  }
}
// Current setup references must follow the verified guarded deployment. Historical
// receipts/captures and separate legacy deployment records retain their addresses.
const currentDeployment = JSON.parse(await readFile(path.join(root, 'docs/deployment/guarded-usdc-stream.json'), 'utf8'));
for (const [file, address] of [
  ['cre/payment-guard/config.stream.json', (value) => value.streamAddress],
  ['cre/payment-guard/config.spend.json', (value) => value.intent.policy.streamAddress],
  ['demo/agents/treasury-research.json', (value) => value.escrow],
]) {
  const value = JSON.parse(await readFile(path.join(root, file), 'utf8'));
  if (address(value).toLowerCase() !== currentDeployment.address.toLowerCase())
    issues.push(`${file}: current escrow differs from the guarded deployment record`);
}
for (const file of ['.env.example', 'README.md', 'DEPLOYMENT.md', 'docs/AI_AGENT_DEMO.md', 'docs/USDC_SEPOLIA.md']) {
  if (!(await readFile(path.join(root, file), 'utf8')).includes(currentDeployment.address))
    issues.push(`${file}: missing current guarded escrow address`);
}
if (!JSON.stringify(documentation.usdc).includes(currentDeployment.address))
  issues.push('Frontend USDC docs: missing current guarded escrow address');
if (issues.length) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Documentation check passed: ${files.length} Markdown guides and ${documentationSections.length} frontend topics; local links, repository sources and related routes resolve.`
  );
