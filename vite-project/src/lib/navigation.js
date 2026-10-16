import { Workflow, ArrowRightLeft, Bot, BookOpen } from 'lucide-react';

export const navigation = [
  { path: '/', icon: Workflow, label: 'CRE Workflow', shortLabel: 'Workflow' },
  {
    path: '/streams',
    icon: ArrowRightLeft,
    label: 'Streams',
    shortLabel: 'Streams',
  },
  {
    path: '/agent',
    icon: Bot,
    label: 'Agent setup',
    shortLabel: 'Agent setup',
  },
  { path: '/docs', icon: BookOpen, label: 'Docs', shortLabel: 'Docs' },
];
export const isCurrentPage = (path, pathname) =>
  path === '/'
    ? pathname === '/' || pathname === '/cre'
    : pathname === path || pathname.startsWith(`${path}/`);
