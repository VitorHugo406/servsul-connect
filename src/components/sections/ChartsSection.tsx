import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// Sample chart data - in production this would come from the database
const sampleChartData = [
  {
    id: '1',
    name: 'Vendas por Mês',
    type: 'bar' as const,
    data: [
      { label: 'Jan', value: 450000 },
      { label: 'Fev', value: 380000 },
      { label: 'Mar', value: 520000 },
      { label: 'Abr', value: 490000 },
      { label: 'Mai', value: 610000 },
      { label: 'Jun', value: 580000 },
    ],
  },
  {
    id: '2',
    name: 'Produtividade Semanal',
    type: 'line' as const,
    data: [
      { label: 'Seg', value: 85 },
      { label: 'Ter', value: 92 },
      { label: 'Qua', value: 88 },
      { label: 'Qui', value: 95 },
      { label: 'Sex', value: 78 },
    ],
  },
];

export function ChartsSection() {
  const { profile } = useAuth();
  const [selectedChart, setSelectedChart] = useState(sampleChartData[0]);

  const canViewCharts = profile?.autonomy_level === 'admin' || 
                        profile?.autonomy_level === 'gerente' ||
                        profile?.autonomy_level === 'supervisor';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
    }).format(value);
  };

  if (!canViewCharts) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-warning" />
        <h3 className="font-display text-xl font-semibold text-foreground">Acesso Restrito</h3>
        <p className="mt-2 text-muted-foreground">
          Apenas supervisores, gerentes e administradores podem visualizar gráficos.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-2xl font-bold text-foreground">
            Visualização de Dados
          </h3>
          <p className="text-muted-foreground">
            Análise de dados e métricas do Grupo Servsul
          </p>
        </div>
        
        <Button className="gap-2 gradient-primary">
          <Upload className="h-4 w-4" />
          Importar Planilha
        </Button>
      </div>

      {/* Chart Selector */}
      <div className="mb-6 flex gap-3">
        {sampleChartData.map((chart) => (
          <motion.button
            key={chart.id}
            onClick={() => setSelectedChart(chart)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              selectedChart.id === chart.id
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {chart.type === 'bar' ? (
              <BarChart3 className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {chart.name}
          </motion.button>
        ))}
      </div>

      {/* Main Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            {selectedChart.type === 'bar' ? (
              <BarChart3 className="h-5 w-5 text-primary" />
            ) : (
              <TrendingUp className="h-5 w-5 text-primary" />
            )}
            {selectedChart.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              {selectedChart.type === 'bar' ? (
                <BarChart data={selectedChart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Valor']}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              ) : (
                <AreaChart data={selectedChart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Produtividade']}
                  />
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={3}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Vendas</p>
                  <p className="font-display text-2xl font-bold text-foreground">
                    R$ 3,03M
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="mt-2 text-xs text-success">+12.5% vs mês anterior</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-l-4 border-l-secondary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Produtividade Média</p>
                  <p className="font-display text-2xl font-bold text-foreground">87.6%</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                  <TrendingUp className="h-6 w-6 text-secondary" />
                </div>
              </div>
              <p className="mt-2 text-xs text-success">+3.2% vs semana anterior</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-l-4 border-l-success">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Planilhas Ativas</p>
                  <p className="font-display text-2xl font-bold text-foreground">24</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <FileSpreadsheet className="h-6 w-6 text-success" />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Última atualização: Hoje</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
