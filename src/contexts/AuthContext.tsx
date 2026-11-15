import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ensureNativeDevice, clearNativeDevice } from '@/lib/nativeBridge';
import { setActiveCompanyId } from '@/lib/companyScope';
import { applyBrand } from '@/lib/branding';

const GERAL_SECTOR_ID='00000000-0000-0000-0000-000000000001';
const PROFILE_CACHE_PREFIX='nuvexa:profile:';
const COMPANY_CACHE_PREFIX='nuvexa:company:';
interface Profile{id:string;user_id:string;name:string;display_name:string|null;email:string;avatar_url:string|null;sector_id:string|null;autonomy_level:string;birth_date:string|null;is_active:boolean;profile_type:string;created_at:string;updated_at:string;last_seen_at:string|null;user_status:string|null;work_period:string|null;company_id:string;team_alerts_enabled:boolean;team_alert_times:string[];}
interface Sector{id:string;name:string;color:string;icon:string|null;}
interface UserRole{role:'admin'|'gerente'|'supervisor'|'colaborador';}
interface UserPermissions{can_post_announcements:boolean;can_delete_messages:boolean;can_access_management:boolean;can_access_password_change:boolean;can_create_war_room:boolean;can_access_orbs:boolean;can_access_meeting_rooms:boolean;can_access_dash:boolean;}
interface AuthContextType{user:User|null;session:Session|null;profile:Profile|null;sector:Sector|null;additionalSectors:Sector[];allAccessibleSectorIds:string[];roles:UserRole[];permissions:UserPermissions|null;isAdmin:boolean;geralSectorId:string;loading:boolean;verifying:boolean;setVerifying:(v:boolean)=>void;signIn:(email:string,password:string)=>Promise<{error:Error|null}>;signOut:()=>Promise<void>;refreshProfile:()=>Promise<void>;refreshPermissions:()=>Promise<void>;canAccess:(permission:keyof UserPermissions)=>boolean;hasSectorAccess:(sectorId:string)=>boolean;}
const defaultPermissions:UserPermissions={can_post_announcements:false,can_delete_messages:false,can_access_management:false,can_access_password_change:false,can_create_war_room:false,can_access_orbs:false,can_access_meeting_rooms:false,can_access_dash:false};
const AuthContext=createContext<AuthContextType|undefined>(undefined);
const readCachedProfile=(userId:string):Profile|null=>{try{const raw=localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`);if(!raw)return null;const p=JSON.parse(raw) as Profile;return p?.user_id===userId&&p?.company_id?p:null;}catch{return null;}};
const cacheProfile=(p:Profile)=>{try{localStorage.setItem(`${PROFILE_CACHE_PREFIX}${p.user_id}`,JSON.stringify(p));}catch{}};
const readCachedCompany=(id:string):any|null=>{try{const raw=localStorage.getItem(`${COMPANY_CACHE_PREFIX}${id}`);if(!raw)return null;const c=JSON.parse(raw);return c?.id===id&&c?.primary_color&&c?.secondary_color?c:null;}catch{return null;}};
const cacheCompany=(c:any)=>{try{localStorage.setItem(`${COMPANY_CACHE_PREFIX}${c.id}`,JSON.stringify(c));}catch{}};

const RT_KEY='ewvon:rt';
export function AuthProvider({children}:{children:ReactNode}){
 const manualOut=useRef(false);const hiddenAt=useRef(0);const sessRef=useRef<Session|null>(null);const failRef=useRef(false);const lastOk=useRef(0);const retryTimer=useRef<number|undefined>(undefined);const[user,setUser]=useState<User|null>(null);const[session,setSession]=useState<Session|null>(null);const[profile,setProfile]=useState<Profile|null>(null);const[sector,setSector]=useState<Sector|null>(null);const[additionalSectors,setAdditionalSectors]=useState<Sector[]>([]);const[roles,setRoles]=useState<UserRole[]>([]);const[permissions,setPermissions]=useState<UserPermissions|null>(null);const[loading,setLoading]=useState(true);const[verifying,setVerifying]=useState(false);const isAdmin=roles.some(r=>r.role==='admin');const allAccessibleSectorIds=[GERAL_SECTOR_ID,...(profile?.sector_id?[profile.sector_id]:[]),...additionalSectors.map(s=>s.id)];
 sessRef.current=session;
 const fetchPermissions=async(userId:string)=>{try{const{data,error}=await supabase.from('user_permissions').select('*').eq('user_id',userId).maybeSingle();if(error){console.error('Error fetching permissions:',error);failRef.current=true;return;}if(data)setPermissions({can_post_announcements:data.can_post_announcements,can_delete_messages:data.can_delete_messages,can_access_management:data.can_access_management,can_access_password_change:data.can_access_password_change,can_create_war_room:data.can_create_war_room,can_access_orbs:(data as any).can_access_orbs??false,can_access_meeting_rooms:(data as any).can_access_meeting_rooms??false,can_access_dash:(data as any).can_access_dash??false});else setPermissions(defaultPermissions);}catch(error){console.error('Error in fetchPermissions:',error);setPermissions(defaultPermissions);}};
 const fetchAdditionalSectors=async(userId:string)=>{try{const{data:additionalData,error:additionalError}=await supabase.from('user_additional_sectors').select('sector_id').eq('user_id',userId);if(additionalError){console.error('Error fetching additional sectors:',additionalError);failRef.current=true;return;}if(additionalData?.length){const ids=additionalData.map(d=>d.sector_id);const{data:sectorsData,error:sectorsError}=await supabase.from('sectors').select('*').in('id',ids);if(sectorsError){console.error('Error fetching sector details:',sectorsError);return;}if(sectorsData)setAdditionalSectors(sectorsData as Sector[]);}else setAdditionalSectors([]);}catch(error){console.error('Error in fetchAdditionalSectors:',error);setAdditionalSectors([]);}};
 const hydrateCompanyBrand=async(companyId:string)=>{const cached=readCachedCompany(companyId);if(cached){applyBrand(cached);return;}const{data,error}=await(supabase as any).from('companies').select('id,name,slug,logo_url,primary_color,secondary_color,is_active,is_system,enabled_modules').eq('id',companyId).maybeSingle();if(!error&&data){cacheCompany(data);applyBrand(data);}};
 const fetchProfile=async(userId:string)=>{failRef.current=false;try{
   const companyIdPromise=(supabase as any).from('profiles').select('company_id').eq('user_id',userId).maybeSingle();
   const profilePromise=supabase.rpc('get_my_full_profile');
   const[{data:companyRef},{data:profileRows,error:profileError}]=await Promise.all([companyIdPromise,profilePromise]);
   const earlyCompanyId=companyRef?.company_id as string|undefined;
   if(earlyCompanyId){setActiveCompanyId(earlyCompanyId);void hydrateCompanyBrand(earlyCompanyId);}
   if(profileError){console.error('Error fetching profile:',profileError);failRef.current=true;return;}
   const profileData=Array.isArray(profileRows)?profileRows[0]:profileRows;if(!profileData)failRef.current=true;
   if(profileData){const nextProfile=profileData as Profile;cacheProfile(nextProfile);setProfile(nextProfile);setActiveCompanyId(nextProfile.company_id??earlyCompanyId??null);if(nextProfile.company_id&&nextProfile.company_id!==earlyCompanyId)void hydrateCompanyBrand(nextProfile.company_id);if(nextProfile.sector_id){const{data:sectorData}=await supabase.from('sectors').select('*').eq('id',nextProfile.sector_id).maybeSingle();if(sectorData)setSector(sectorData as Sector);}}
   const{data:rolesData,error:rolesError}=await supabase.from('user_roles').select('role').eq('user_id',userId);if(rolesError){console.error('Error fetching roles:',rolesError);failRef.current=true;}else if(rolesData)setRoles(rolesData as UserRole[]);
   await Promise.all([fetchAdditionalSectors(userId),fetchPermissions(userId)]);
 }catch(error){console.error('Error in fetchProfile:',error);failRef.current=true;}if(!failRef.current)lastOk.current=Date.now();};
 /* Loads the person's data and, when something fails (network blip, expired token that is being renewed), tries again by itself instead of waiting for a logout/login. */
 const fetchProfileSafe=async(userId:string,attempt=0):Promise<void>=>{window.clearTimeout(retryTimer.current);await fetchProfile(userId);if(failRef.current&&attempt<5){retryTimer.current=window.setTimeout(()=>void fetchProfileSafe(userId,attempt+1),[1500,4000,10000,25000,60000][attempt]);}};
 const hydrateCachedProfile=async(userId:string)=>{const cached=readCachedProfile(userId);if(!cached)return false;setProfile(cached);setActiveCompanyId(cached.company_id);const company=readCachedCompany(cached.company_id);if(company)applyBrand(company);else await hydrateCompanyBrand(cached.company_id);return true;};
 const refreshProfile=async()=>{if(user)await fetchProfile(user.id)};const refreshPermissions=async()=>{if(user)await fetchPermissions(user.id)};const canAccess=(permission:keyof UserPermissions)=>isAdmin||Boolean(permissions?.[permission]);const hasSectorAccess=(sectorId:string)=>isAdmin||allAccessibleSectorIds.includes(sectorId);
 useEffect(()=>{const{data:{subscription}}=supabase.auth.onAuthStateChange((event,session0)=>{const apply=(session:Session|null)=>{setSession(session);setUser(session?.user??null);if(session?.user){void hydrateCachedProfile(session.user.id);setTimeout(()=>void fetchProfileSafe(session.user.id),0);}else{setProfile(null);setActiveCompanyId(null);setSector(null);setAdditionalSectors([]);setRoles([]);setPermissions(null);}};
  /* Another tab of this same browser may be renewing the shared login right now: before treating a sign-out we did not ask for as real, look at the stored session again. */
  if(session0?.refresh_token){try{localStorage.setItem(RT_KEY,session0.refresh_token);}catch{}}
  if(event==='SIGNED_OUT'&&!manualOut.current){window.setTimeout(async()=>{const{data:{session:s2}}=await supabase.auth.getSession();if(s2){apply(s2);return;}
   /* The login vanished without the person asking (token renewal hiccup, throttled/sleeping tab): try once more with the last refresh token we saw before sending them to the login screen. */
   let rt:string|null=null;try{rt=localStorage.getItem(RT_KEY);}catch{}
   if(rt){const{data:r}=await supabase.auth.refreshSession({refresh_token:rt});if(r?.session){apply(r.session);return;}}
   try{localStorage.removeItem(RT_KEY);}catch{}apply(null);},800);return;}
  if(event==='SIGNED_OUT'){try{localStorage.removeItem(RT_KEY);}catch{}}
  manualOut.current=false;apply(session0);});supabase.auth.getSession().then(async({data:{session}})=>{setSession(session);setUser(session?.user??null);if(session?.user){await hydrateCachedProfile(session.user.id);await fetchProfileSafe(session.user.id);setLoading(false);}else setLoading(false);});return()=>subscription.unsubscribe();},[]);
 useEffect(()=>{if(profile?.id)void ensureNativeDevice(profile.id);},[profile?.id]);
 /* Coming back to the tab/app or regaining internet: reload the data if the last load failed or is old. */
 useEffect(()=>{if(!user)return;const heal=async()=>{
   if(document.hidden){hiddenAt.current=hiddenAt.current||Date.now();return;}
   const away=hiddenAt.current?Date.now()-hiddenAt.current:0;hiddenAt.current=0;
   /* After a long absence (idle, closed lid) the login token has usually expired and the first requests fail: renew the login first, then reload the person's data; if the token had really expired, reload the page once so every screen fetches again with the fresh login. */
   const exp=(sessRef.current?.expires_at??0)*1000;const expired=!!exp&&exp<Date.now()+60_000;
   if(away>60_000||expired){
    const{data:{session:s2}}=await supabase.auth.getSession();
    if(!s2)return;   /* the sign-out handling above decides what to do */
    if(expired||failRef.current){
     let last=0;try{last=+(sessionStorage.getItem('ewvon:resume-reload')||0)}catch{}
     if(Date.now()-last>90_000){try{sessionStorage.setItem('ewvon:resume-reload',String(Date.now()))}catch{}window.location.reload();return;}
    }
   }
   if(failRef.current||Date.now()-lastOk.current>10*60*1000)void fetchProfileSafe(user.id);
  };
  const markHidden=()=>{if(document.hidden)hiddenAt.current=Date.now()};
  document.addEventListener('visibilitychange',markHidden);document.addEventListener('visibilitychange',heal);window.addEventListener('online',heal);window.addEventListener('focus',heal);return()=>{document.removeEventListener('visibilitychange',heal);document.removeEventListener('visibilitychange',markHidden);window.removeEventListener('online',heal);window.removeEventListener('focus',heal);};},[user?.id]);
 /* Keeps the login alive while the person is really using the app (including the Dash, which lives in an iframe and makes no requests of its own): renews the session every ~12 min of activity. */
 useEffect(()=>{if(!user)return;let last=Date.now(),lastRefresh=Date.now();const mark=()=>{last=Date.now()};
  const evs=['pointerdown','keydown','wheel','touchstart'];evs.forEach(ev=>window.addEventListener(ev,mark,{passive:true}));
  const onMsg=(e:MessageEvent)=>{if(e.origin===window.location.origin&&(e.data as {type?:string})?.type==='ewvon:activity')mark();};window.addEventListener('message',onMsg);
  const t=window.setInterval(async()=>{const exp=(sessRef.current?.expires_at??0)*1000;const soon=!!exp&&exp-Date.now()<10*60_000;if(!soon&&(document.hidden||Date.now()-last>10*60_000||Date.now()-lastRefresh<12*60_000))return;if(Date.now()-lastRefresh<20_000)return;lastRefresh=Date.now();try{await supabase.auth.refreshSession();}catch{/* the normal refresh handling takes over */}},30_000);
  return()=>{evs.forEach(ev=>window.removeEventListener(ev,mark));window.removeEventListener('message',onMsg);window.clearInterval(t);};},[user?.id]);
 useEffect(()=>{if(!user)return;const channel=supabase.channel(`auth-sync-${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'user_permissions',filter:`user_id=eq.${user.id}`},()=>fetchPermissions(user.id)).on('postgres_changes',{event:'*',schema:'public',table:'user_roles',filter:`user_id=eq.${user.id}`},()=>fetchProfile(user.id)).subscribe();return()=>{supabase.removeChannel(channel);};},[user]);
 const signIn=async(email:string,password:string)=>{const{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)return{error:error as Error|null};if(data.user){const{data:profileData,error:profileError}=await supabase.from('profiles').select('is_active').eq('user_id',data.user.id).maybeSingle();if(profileError){console.error('Error checking user status:',profileError);await supabase.auth.signOut({ scope: 'local' });return{error:new Error('Erro ao verificar status do usuário')};}if(profileData&&!profileData.is_active){await supabase.auth.signOut({ scope: 'local' });return{error:new Error('Usuário inativo. Entre em contato com o administrador.')}}}return{error:null};};
 const signOut=async()=>{manualOut.current=true;window.clearTimeout(retryTimer.current);void clearNativeDevice();setProfile(null);setActiveCompanyId(null);setSector(null);setAdditionalSectors([]);setRoles([]);setPermissions(null);await supabase.auth.signOut({ scope: 'local' });};
 return <AuthContext.Provider value={{user,session,profile,sector,additionalSectors,allAccessibleSectorIds,roles,permissions,isAdmin,geralSectorId:GERAL_SECTOR_ID,loading,verifying,setVerifying,signIn,signOut,refreshProfile,refreshPermissions,canAccess,hasSectorAccess}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(context===undefined)throw new Error('useAuth must be used within AuthProvider');return context;}
