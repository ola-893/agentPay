import { Link, useParams } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Workflow,
  FileText,
} from 'lucide-react';
import CopyButton from '../components/ui/CopyButton';
import { documentation, documentationSections } from '../lib/documentation.mjs';

function DocLink({ to, children, className }) {
  return to.startsWith('https://') ? (
    <a href={to} target="_blank" rel="noreferrer" className={className}>
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>
  ) : (
    <Link to={to} className={className}>
      {children}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}
function Block({ block }) {
  if (block.type === 'paragraph')
    return (
      <p className="text-sm leading-7 text-slate-300 sm:text-base">
        {block.text}
      </p>
    );
  if (block.type === 'list')
    return (
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-slate-300 sm:text-base">
        {block.items.map((item) => (
          <li key={item} className="pl-1">
            {item}
          </li>
        ))}
      </ol>
    );
  if (block.type === 'table')
    return (
      <div
        className="overflow-x-auto rounded-xl border border-white/10"
        role="region"
        aria-label={`${block.headers.join(' and ')} reference table`}
        tabIndex={0}
      >
        <table
          className={`w-full table-fixed text-left text-sm ${
            block.headers.length > 2 ? 'min-w-[560px]' : ''
          }`}
        >
          {block.headers.length > 2 && (
            <caption className="caption-top px-3 py-2 text-left text-xs text-slate-400">
              On small screens, scroll this table horizontally.
            </caption>
          )}
          <thead className="bg-white/5 text-slate-200">
            <tr>
              {block.headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-3 py-3 font-medium sm:px-4"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-t border-white/10">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="break-words px-3 py-3 align-top leading-6 text-slate-400 [overflow-wrap:anywhere] sm:px-4"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if (block.type === 'code')
    return (
      <div className="panel min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-1">
          <p className="text-xs text-slate-400">{block.label}</p>
          <CopyButton
            value={block.text}
            label={`Copy ${block.label} example`}
          />
        </div>
        <pre
          tabIndex={0}
          aria-label={`${block.label} example`}
          className="max-w-full overflow-auto p-4 text-xs leading-7 text-blue-200 sm:p-5 sm:text-sm"
        >
          <code>{block.text}</code>
        </pre>
      </div>
    );
  return null;
}
export default function Docs() {
  const { section = 'overview' } = useParams();
  const page = documentation[section];
  if (!page)
    return (
      <section className="panel p-8">
        <h1 className="page-title">Documentation not found</h1>
        <Link to="/docs" className="btn-outline mt-6">
          Open documentation overview
        </Link>
      </section>
    );
  return (
    <div className="grid items-start gap-7 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12">
      <aside className="min-w-0 lg:sticky lg:top-28">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <BookOpen size={17} aria-hidden="true" />
          Documentation
        </p>
        <nav
          aria-label="Documentation sections"
          className="mt-4 grid grid-cols-2 gap-2 lg:flex lg:flex-col"
        >
          {documentationSections.map(([key, label]) => (
            <Link
              key={key}
              to={`/docs/${key}`}
              aria-current={section === key ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm ${
                section === key
                  ? 'bg-blue-500/15 text-blue-200'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <a
          href="https://docs.chain.link/cre"
          className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-blue-300"
          target="_blank"
          rel="noreferrer"
        >
          Chainlink CRE docs <ArrowUpRight size={15} />
        </a>
      </aside>
      <article className="min-w-0 max-w-3xl">
        <header>
          <p className="eyebrow flex items-center gap-2">
            <Workflow size={15} aria-hidden="true" />
            Build with AgentPay
          </p>
          <h1 className="page-title mt-3">{page.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            {page.intro}
          </p>
          <a
            href={`https://github.com/ola-893/agentPay/blob/main/${page.source}`}
            className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs text-blue-300"
            target="_blank"
            rel="noreferrer"
          >
            <FileText size={14} />
            Read this guide in the repository <ArrowUpRight size={14} />
          </a>
        </header>
        <div className="mt-5 space-y-9">
          {page.sections.map((item) => (
            <section key={item.title} className="min-w-0 space-y-4">
              <h2 className="border-t border-white/10 pt-6 text-lg font-semibold text-slate-100">
                {item.title}
              </h2>
              {item.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </section>
          ))}
        </div>
        <section className="mt-9 border-t border-white/10 pt-6">
          <h2 className="text-sm font-semibold text-slate-300">
            Continue reading
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {page.related.map(([to, label]) => (
              <DocLink
                key={to}
                to={to}
                className="inline-flex min-h-11 items-center gap-1 text-sm text-blue-300"
              >
                {label}
              </DocLink>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
