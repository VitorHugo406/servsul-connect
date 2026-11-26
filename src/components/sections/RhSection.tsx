// RH (design-kit dk-pg): Ausências, Pesquisas (clima/eNPS), 1:1, Reconhecimento, Metas and Organograma, plus the
// company admin's "Onboarding automático" switch. The Organograma uses existing tables and is always there; the other
// tabs need migration 20261121010000 and stay hidden until it exists (useDbFeature), so nothing half-works.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDbColumn, useDbFeature } from '@/hooks/useDbFeature';
import { Switch } from '@/components/ui/switch';
import { companyAutoOnboarding, setCompanyAutoOnboarding } from '@/lib/onboarding';
import { useIsPeopleManager } from '@/components/rh/rhShared';
import { OrgChartTab } from '@/components/rh/OrgChartTab';
import { TimeOffTab } from '@/components/rh/TimeOffTab';
import { SurveysTab } from '@/components/rh/SurveysTab';
import { OneOnOnesTab } from '@/components/rh/OneOnOnesTab';
import { FeedbackTab } from '@/components/rh/FeedbackTab';
import { GoalsTab } from '@/components/rh/GoalsTab';

type Tab = 'timeoff' | 'surveys' | 'oneonone' | 'feedback' | 'goals' | 'org';
const KEY = 'ewvon:rh-tab';

export function RhSection() {
  const { isAdmin } = useAuth();
  const { company } = useCompany();
  const pack = useDbFeature('time_off_requests');
  const onbCol = useDbColumn('companies', 'auto_onboarding');
  const isManager = useIsPeopleManager();
  const [tab, setTab] = useState<Tab>(() => { try { return (localStorage.getItem(KEY) as Tab) || 'timeoff'; } catch { return 'timeoff'; } });
  const [onb, setOnb] = useState(false);
  useEffect(() => { try { localStorage.setItem(KEY, tab); } catch { /* storage unavailable */ } }, [tab]);
  useEffect(() => { if (onbCol && company?.id) void companyAutoOnboarding(company.id).then(setOnb); }, [onbCol, company?.id]);
  const tabs: [Tab, string][] = pack
    ? [['timeoff', 'Ausências'], ['surveys', 'Pesquisas'], ['oneonone', '1:1'], ['feedback', 'Reconhecimento'], ['goals', 'Metas'], ['org', 'Organograma']]
    : [['org', 'Organograma']];
  const cur: Tab = tabs.some(([k]) => k === tab) ? tab : tabs[0][0];
  const toggleOnb = async (v: boolean) => {
    setOnb(v);
    try { await setCompanyAutoOnboarding(v); toast.success(v ? 'Onboarding automático ligado' : 'Onboarding automático desligado'); }
    catch { setOnb(!v); toast.error('Não foi possível alterar.'); }
  };
  return (
    <div className="dk-pg">
      <div className="dk-panel">
        <div className="dk-bar rh-top">
          {/* underlined tab bar (system rule: one straight company-colour bar under the selected tab) */}
          <nav className="dk-tb rh-tb" aria-label="Áreas do RH">
            {tabs.map(([k, l]) => <button key={k} type="button" aria-current={cur === k ? 'page' : undefined} className={cur === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
          </nav>
          {isAdmin && onbCol ? (
            <label className="flex items-center gap-2.5 text-sm" title="Ao cadastrar uma pessoa no Gerenciamento, um mural de integração é criado para ela">
              <Switch checked={onb} onCheckedChange={(v) => void toggleOnb(v)} aria-label="Onboarding automático" />
              <span><b className="font-medium">Onboarding automático</b><span className="block text-xs text-muted-foreground">Mural de integração para cada pessoa nova</span></span>
            </label>
          ) : null}
        </div>
        {cur === 'org' ? <OrgChartTab />
          : cur === 'timeoff' ? <TimeOffTab isManager={isManager} />
          : cur === 'surveys' ? <SurveysTab isManager={isManager} />
          : cur === 'oneonone' ? <OneOnOnesTab isManager={isManager} />
          : cur === 'feedback' ? <FeedbackTab />
          : <GoalsTab isManager={isManager} />}
      </div>
    </div>
  );
}
