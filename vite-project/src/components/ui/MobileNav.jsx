import { Link, useLocation } from 'react-router-dom';
import { navigation, isCurrentPage } from '../../lib/navigation';

export function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0b101c]/95 backdrop-blur-xl safe-area-bottom lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-2 gap-1 px-2 py-2">
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
