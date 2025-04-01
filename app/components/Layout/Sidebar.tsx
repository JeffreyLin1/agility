import { ReactNode } from 'react';

interface SidebarProps {
  children: ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="w-72 bg-white border-r-2 border-gray-200 h-full overflow-y-auto">
      {children}
    </aside>
  );
} 