import { motion } from 'framer-motion';
import { Building, TrendingUp, DollarSign, Users, Monitor, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Sector {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface SectorTabsProps {
  sectors: Sector[];
  activeSector: string;
  onSectorChange: (sectorId: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  users: Users,
  monitor: Monitor,
  settings: Settings,
};

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

export function SectorTabs({ sectors, activeSector, onSectorChange }: SectorTabsProps) {
  // Sort sectors: Geral always first
  const sortedSectors = [...sectors].sort((a, b) => {
    if (a.id === GERAL_SECTOR_ID) return -1;
    if (b.id === GERAL_SECTOR_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 scrollbar-hide">
      {sortedSectors.map((sector) => {
        const Icon = iconMap[sector.icon || 'building'] || Building;
        const isActive = activeSector === sector.id;
        
        return (
          <motion.button
            key={sector.id}
            onClick={() => onSectorChange(sector.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all',
              isActive
                ? 'text-white shadow-md'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            style={isActive ? { backgroundColor: sector.color } : undefined}
          >
            <Icon className="h-4 w-4" />
            {sector.name}
          </motion.button>
        );
      })}
    </div>
  );
}
