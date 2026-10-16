import { useEffect, useId, useState } from 'react';
import { Inbox, Search } from 'lucide-react';
import StreamCard from './StreamCard';
import { streamView } from '../lib/stream-state.mjs';

export default function StreamList({
  title,
  streams,
  variant,
  isLoading,
  onWithdraw,
  onCancel,
  isProcessing,
}) {
  const id = useId();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!streams.some((s) => s.isActive)) return;
    const timer = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, [streams]);
  const visible = streams
    .filter(
      (s) =>
        (filter === 'all' || streamView(s, now).status === filter) &&
        [s.id, s.sender, s.recipient].some((v) =>
          String(v).toLowerCase().includes(query.trim().toLowerCase())
        )
    )
    .sort((a, b) =>
      sort === 'oldest'
        ? a.startTime - b.startTime
        : sort === 'amount'
        ? BigInt(a.totalAmount) === BigInt(b.totalAmount)
          ? 0
          : BigInt(a.totalAmount) > BigInt(b.totalAmount)
          ? -1
          : 1
        : b.startTime - a.startTime
    );
  const pages = Math.max(1, Math.ceil(visible.length / 5));
  const current = Math.min(page, pages);
  const changeFilter = (value) => {
    setFilter(value);
    setPage(1);
  };
  return (
    <section className="min-w-0 space-y-4" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}{' '}
          <span className="ml-1 text-sm font-normal text-slate-400">
            {streams.length}
          </span>
        </h2>
        <label className="text-xs text-slate-400">
          <span className="sr-only">Sort {title.toLowerCase()}</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="min-h-11 rounded-lg border border-white/10 bg-[#111827] px-3 text-sm text-slate-300"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount">Highest amount</option>
          </select>
        </label>
      </div>
      <div
        role="group"
        aria-label={`Filter ${title.toLowerCase()}`}
        className="flex flex-wrap gap-1"
      >
        {[
          ['all', 'All'],
          ['active', 'Streaming'],
          ['completed', 'Ended'],
          ['cancelled', 'Closed'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => changeFilter(value)}
            className={`min-h-11 rounded-lg px-3 text-sm ${
              filter === value
                ? 'bg-blue-500/15 text-blue-200'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="relative block">
        <span className="sr-only">
          Search {title.toLowerCase()} by ID or address
        </span>
        <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
        <input
          className="input-default pl-10"
          type="search"
          placeholder="Search ID or address"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {isLoading ? (
        <div className="panel p-6 text-sm text-slate-400" role="status">
          Refreshing streams…
        </div>
      ) : !visible.length ? (
        <div className="panel px-5 py-10 text-center">
          <Inbox size={28} className="mx-auto text-slate-500" />
          <h3 className="mt-4 font-medium">
            {streams.length
              ? 'No matching streams'
              : `No ${variant} streams yet`}
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            {streams.length
              ? 'Try a different search or filter.'
              : variant === 'incoming'
              ? 'Streams sent to this wallet will appear here.'
              : 'Create a stream using the form above.'}
          </p>
          {streams.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                changeFilter('all');
              }}
              className="btn-outline mt-4"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        visible
          .slice((current - 1) * 5, current * 5)
          .map((stream) => (
            <StreamCard
              key={`${variant}-${stream.id}`}
              stream={stream}
              variant={variant}
              onWithdraw={onWithdraw}
              onCancel={onCancel}
              isProcessing={isProcessing}
              now={now}
            />
          ))
      )}
      {pages > 1 && (
        <nav
          aria-label={`${title} pagination`}
          className="flex items-center justify-between gap-2"
        >
          <button
            type="button"
            className="btn-outline"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span className="text-xs text-slate-400" role="status">
            Page {current} of {pages}
          </span>
          <button
            type="button"
            className="btn-outline"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
