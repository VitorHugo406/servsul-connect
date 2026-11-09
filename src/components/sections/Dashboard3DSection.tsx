// Dash: exclusive area of the top plan (plan feature `dashboard_3d`). Placeholder until the dashboard ships.
import { Box, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export function Dashboard3DSection() {
  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader icon={<Box />} title="Dash" subtitle="Painel exclusivo do plano Empresarial." />
      <Card><CardContent className="flex flex-col items-center px-6 py-16 text-center">
        <span className="ewvon-dash-flag-mark mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white"><Box className="h-6 w-6" strokeWidth={1.8} /></span>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><Sparkles className="h-3.5 w-3.5" />Em breve</p>
        <h2 className="mt-1 text-xl font-semibold">Uma nova forma de ver a operação da sua empresa</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">Estamos preparando o Dash para os assinantes do plano Empresarial. Assim que estiver pronto, ele aparece aqui.</p>
      </CardContent></Card>
    </div>
  );
}
