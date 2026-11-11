import { IS_DEMO } from '@/lib/demo/bootDemo';
import { useVisibleMenuItems } from './menuItems';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { SeasonalEffectsButton } from '@/components/seasonal/SeasonalEffectsButton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';

interface SidebarProps { activeSection: string; onSectionChange: (section: string) => void; }
export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  useLayoutEffect(() => {
    const main = document.querySelector<HTMLElement>('.ewvon-main');
    if (!main) return;
    const align = () => document.documentElement.style.setProperty('--navigation-page-top', `${main.getBoundingClientRect().top}px`);
    align();
    const observer = new ResizeObserver(align);
    observer.observe(main);
    if (main.previousElementSibling) observer.observe(main.previousElementSibling);
    window.addEventListener('resize', align);
    return () => { observer.disconnect(); window.removeEventListener('resize', align); document.documentElement.style.removeProperty('--navigation-page-top'); };
  }, []);
  const { counts } = useNotifications();
  const visibleMenuItems = useVisibleMenuItems();
  return (
    <motion.aside initial={false} animate={{ width: 64 }} transition={{ duration: 0.2, ease: 'easeOut' }}
      className="ewvon-sidebar fixed left-0 top-0 z-40 flex h-screen w-16 shrink-0 flex-col items-center text-slate-700"
      aria-label="Navegação principal">
      <nav className="flex min-h-0 w-full flex-col items-center overflow-visible py-0">
        <ScrollArea className="ewvon-sidebar-scroll w-full [&_[data-radix-scroll-area-scrollbar]]:hidden">
          <div className="flex flex-col items-center gap-1 px-2">
            {visibleMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const badgeCount = item.id === 'chat' ? counts.unreadMessages : item.id === 'announcements' ? counts.unreadAnnouncements : 0;
              return (
                <motion.button key={item.id} type="button" onClick={() => onSectionChange(item.id)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  aria-label={item.label} aria-current={isActive ? 'page' : undefined} title={item.label}
                  className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
                    isActive ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}>
                  <Icon className="h-[18px] w-[18px] stroke-[1.8]" />
                  {badgeCount > 0 && <Badge variant="secondary" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 p-0 text-[9px] text-white">{badgeCount > 99 ? '99+' : badgeCount}</Badge>}
                </motion.button>
              );
            })}
          </div>
        </ScrollArea>
      </nav>
      <div className="ewvon-seasonal-slot flex w-full justify-center pt-1">
        {!IS_DEMO && <SeasonalEffectsButton collapsed />}
      </div>
    </motion.aside>
  );
}
