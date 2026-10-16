import { useState, useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { navigation, isCurrentPage } from '../../lib/navigation';

export function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0b101c]/95 backdrop-blur-xl safe-area-bottom lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
        {navigation.map(({ path, icon: Icon, shortLabel }) => (
          <Link
            key={path}
            to={path}
            aria-current={isCurrentPage(path, pathname) ? 'page' : undefined}
            className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium ${
              isCurrentPage(path, pathname)
                ? 'bg-blue-500/15 text-blue-200'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{shortLabel}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

// Collapsible Section Component
export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`panel min-w-0 ${className}`}>
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={id}
          onClick={() => setIsOpen(!isOpen)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl p-5 text-left font-semibold text-white"
        >
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          <span aria-hidden="true" className="text-slate-400">
            {isOpen ? '−' : '+'}
          </span>
        </button>
      </h2>
      <div id={id} hidden={!isOpen} className="px-5 pb-5">
        {children}
      </div>
    </section>
  );
}

// Touch-friendly Button
export function TouchButton({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    default: 'btn-default',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    success: 'btn-success',
    danger: 'btn-danger',
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm min-h-[36px]',
    md: 'px-4 py-2.5 text-base min-h-[44px]',
    lg: 'px-6 py-3 text-lg min-h-[52px]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        touch-manipulation
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

// Touch-friendly Input
export function TouchInput({ label, error, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-sm text-white/70">{label}</label>}
      <input
        className={`
          input-default
          min-h-[44px] text-base
          touch-manipulation
          ${
            error
              ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20'
              : ''
          }
        `}
        {...props}
      />
      {error && <p className="text-xs text-error-400">{error}</p>}
    </div>
  );
}

// Responsive Grid
export function ResponsiveGrid({
  children,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 4,
  className = '',
}) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div
      className={`
        grid gap-${gap}
        ${colClasses[cols.default] || 'grid-cols-1'}
        ${cols.sm ? `sm:${colClasses[cols.sm]}` : ''}
        ${cols.md ? `md:${colClasses[cols.md]}` : ''}
        ${cols.lg ? `lg:${colClasses[cols.lg]}` : ''}
        ${cols.xl ? `xl:${colClasses[cols.xl]}` : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// Pull to Refresh Indicator (visual only)
export function PullToRefreshIndicator({ isRefreshing }) {
  if (!isRefreshing) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
        <svg
          className="w-4 h-4 animate-spin text-agentpay-400"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span className="text-sm text-white/70">Refreshing...</span>
      </div>
    </div>
  );
}
