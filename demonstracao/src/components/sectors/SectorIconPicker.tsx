import { cn } from '@/lib/utils';
import {
  Building,
  TrendingUp,
  DollarSign,
  Users,
  Monitor,
  Settings,
  Briefcase,
  ShieldCheck,
  Truck,
  Wrench,
  HeadphonesIcon,
  BarChart3,
  FileText,
  GraduationCap,
  Heart,
  Landmark,
  Package,
  Megaphone,
  Scale,
  Leaf,
} from 'lucide-react';
import { Label } from '@/components/ui/label';

export const SECTOR_ICONS = [
  { id: 'building', label: 'Prédio', Icon: Building },
  { id: 'briefcase', label: 'Negócios', Icon: Briefcase },
  { id: 'users', label: 'Pessoas', Icon: Users },
  { id: 'trending-up', label: 'Crescimento', Icon: TrendingUp },
  { id: 'dollar-sign', label: 'Financeiro', Icon: DollarSign },
  { id: 'monitor', label: 'TI', Icon: Monitor },
  { id: 'settings', label: 'Engenharia', Icon: Settings },
  { id: 'shield-check', label: 'Segurança', Icon: ShieldCheck },
  { id: 'truck', label: 'Logística', Icon: Truck },
  { id: 'wrench', label: 'Manutenção', Icon: Wrench },
  { id: 'headphones', label: 'Suporte', Icon: HeadphonesIcon },
  { id: 'bar-chart', label: 'Análise', Icon: BarChart3 },
  { id: 'file-text', label: 'Documentos', Icon: FileText },
  { id: 'graduation-cap', label: 'Treinamento', Icon: GraduationCap },
  { id: 'heart', label: 'Saúde', Icon: Heart },
  { id: 'landmark', label: 'Jurídico', Icon: Landmark },
  { id: 'package', label: 'Estoque', Icon: Package },
  { id: 'megaphone', label: 'Marketing', Icon: Megaphone },
  { id: 'scale', label: 'Compliance', Icon: Scale },
  { id: 'leaf', label: 'Sustentabilidade', Icon: Leaf },
] as const;

export const SECTOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  SECTOR_ICONS.map(({ id, Icon }) => [id, Icon])
);

interface SectorIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
}

export function SectorIconPicker({ value, onChange, color = '#3B82F6' }: SectorIconPickerProps) {
  return (
    <div className="space-y-2">
      <Label>Ícone do Setor</Label>
      <div className="grid grid-cols-5 gap-2">
        {SECTOR_ICONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            title={label}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all text-xs',
              value === id
                ? 'ring-2 ring-primary scale-105 border-primary bg-primary/10 text-primary font-medium'
                : 'border-border hover:border-primary/50 hover:bg-muted text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" style={value === id ? { color } : undefined} />
            <span className="truncate w-full text-center">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
