// Employee data fields (stored encrypted; only admins see everything). Used when registering and editing a user.
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EmployeeRecord } from '@/lib/employeeRecord';

const FIELDS: { key: keyof EmployeeRecord; label: string; type?: string; placeholder?: string }[] = [
  { key: 'job_title', label: 'Cargo / função', placeholder: 'Ex.: Analista de reservas' },
  { key: 'admission_date', label: 'Data de admissão', type: 'date' },
  { key: 'salary', label: 'Salário (R$)', placeholder: 'Ex.: 3.200,00' },
  { key: 'rg', label: 'RG' },
  { key: 'cpf', label: 'CPF' },
  { key: 'pis', label: 'PIS / NIS' },
  { key: 'ctps', label: 'CTPS (nº e série)' },
];

export function EmployeeRecordFields({ value, onChange }: { value: EmployeeRecord; onChange: (v: EmployeeRecord) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold"><Lock className="h-3.5 w-3.5" />Dados do funcionário</p>
        <p className="text-xs text-muted-foreground">Guardados criptografados. A data de admissão, o cargo e a matrícula preenchem sozinhos os formulários de avaliação; salário e documentos só o administrador vê.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label className="text-xs">{f.label}</Label>
            <Input type={f.type || 'text'} placeholder={f.placeholder} value={value[f.key] || ''} maxLength={60} onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  );
}
