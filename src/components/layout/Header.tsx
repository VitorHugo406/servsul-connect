import { Search, Bell, Moon, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-16 items-center justify-between border-b border-border bg-card px-6"
    >
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="w-64 bg-muted/50 pl-10 focus-visible:ring-primary"
          />
        </div>
        
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-secondary p-0 text-xs">
            5
          </Badge>
        </Button>
        
        {/* Date */}
        <div className="hidden text-right lg:block">
          <p className="text-sm font-medium text-foreground">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
    </motion.header>
  );
}
