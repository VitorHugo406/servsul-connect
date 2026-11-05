// Imported first in main.tsx so the client is swapped before any component queries it.
import { supabase } from '@/integrations/supabase/client';
import { installDemoClient } from './demoClient';
import { clearDemoData, isDemoExpired, readDemoSession } from './demoSession';

if (isDemoExpired()) { clearDemoData(); if (!location.search.includes('demo=')) location.replace('/?demo=expired'); }
const demo = readDemoSession();
export const IS_DEMO = Boolean(demo);
if (demo) installDemoClient(supabase as any, demo);
