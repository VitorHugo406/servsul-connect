import { motion } from 'framer-motion';
import { Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTOR_ICON_MAP } from '@/components/sectors/SectorIconPicker';

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

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

export function SectorTabs({ sectors, activeSector, onSectorChange }: SectorTabsProps) {
  // Sort sectors: Geral always first
  const sortedSectors = [...sectors].sort((a, b) => {
    if (a.id === GERAL_SECTOR_ID) return -1;
    if (b.id === GERAL_SECTOR_ID) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-card px-3 py-1.5 sm:px-4 sm:py-3 sm:gap-2 scrollbar-hide shrink-0">
      {sortedSectors.map((sector) => {
        const Icon = SECTOR_ICON_MAP[sector.icon || 'building'] || Building;
        const isActive = activeSector === sector.id;

        return (
          <motion.button
            key={sector.id}
            onClick={() => onSectorChange(sector.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-all sm:gap-2 sm:px-4 sm:py-2 sm:text-sm',
              isActive
                ? 'text-white shadow-md'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            style={isActive ? { backgroundColor: sector.color } : undefined}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {sector.name}
          </motion.button>
        );
      })}
    </div>
  );
}
