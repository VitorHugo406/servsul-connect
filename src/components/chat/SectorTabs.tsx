import { motion } from 'framer-motion';
import { sectors } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Building, TrendingUp, DollarSign, Users, Monitor, Settings } from 'lucide-react';

interface SectorTabsProps {
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

export function SectorTabs({ activeSector, onSectorChange }: SectorTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-card px-4 py-3 scrollbar-hide">
      {sectors.map((sector) => {
        const Icon = iconMap[sector.icon] || Building;
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
                ? 'text-primary-foreground shadow-md'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            style={isActive ? { backgroundColor: sector.color } : undefined}
          >
            <Icon className="h-4 w-4" />
            {sector.name}
            
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 -z-10 rounded-lg"
                style={{ backgroundColor: sector.color }}
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
