import { useState, useRef, useEffect } from 'react';
import { Camera, Save, X, Image as ImageIcon, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserStatusSelector } from './UserStatusSelector';

interface UserProfileDialogProps { open:boolean; onOpenChange:(open:boolean)=>void; }
const OPTIONAL_PROFILE_KEY=(userId:string)=>`nuvexa:profile-extra:${userId}`;
const EDITABLE_PROFILE_FIELDS='id,user_id,name,display_name,email,avatar_url,cover_url,birth_date,work_period,phone,address,description';

export function UserProfileDialog({open,onOpenChange}:UserProfileDialogProps){
 const{user,profile,refreshProfile}=useAuth();
 const{uploadAvatar,uploadFile,uploading}=useFileUpload();
 const avatarInputRef=useRef<HTMLInputElement>(null); const coverInputRef=useRef<HTMLInputElement>(null);
 const[name,setName]=useState('');const[displayName,setDisplayName]=useState('');const[workPeriod,setWorkPeriod]=useState('');const[phone,setPhone]=useState('');const[address,setAddress]=useState('');const[birthDate,setBirthDate]=useState('');const[description,setDescription]=useState('');const[avatarUrl,setAvatarUrl]=useState('');const[coverUrl,setCoverUrl]=useState('');const[saving,setSaving]=useState(false);const[loadingProfile,setLoadingProfile]=useState(false);

 useEffect(()=>{if(!open||!user)return;let cancelled=false;
   const load=async()=>{setLoadingProfile(true);
     // The AuthContext profile is a cache and does not contain the extended editor fields.
     // Always load the authoritative editable profile row when this dialog opens.
     const{data:remote,error}=await supabase.from('profiles').select(EDITABLE_PROFILE_FIELDS).eq('user_id',user.id).maybeSingle();
     const data:any=(!error&&remote)?remote:profile;
     let extra:any={};try{extra=JSON.parse(localStorage.getItem(OPTIONAL_PROFILE_KEY(user.id))||'{}')}catch{}
     if(!cancelled){setName(data?.name||'');setDisplayName(data?.display_name||'');setWorkPeriod(data?.work_period||'');setPhone(data?.phone||'');setBirthDate(data?.birth_date||'');setAddress(data?.address||extra.address||'');setDescription(data?.description||extra.description||'');setAvatarUrl(data?.avatar_url||'');setCoverUrl(data?.cover_url||extra.cover_url||'');setLoadingProfile(false);}
   };void load();return()=>{cancelled=true;};
 },[open,user,profile]);

 const getInitials=(value:string)=>value.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
 const handleAvatarChange=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;const url=await uploadAvatar(file);if(url){setAvatarUrl(url);await refreshProfile();}};
 const handleCoverChange=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file||!user)return;const result=await uploadFile(file,'avatars');if(!result)return;const nextUrl=`${result.url}?v=${Date.now()}`;setCoverUrl(nextUrl);const{error}=await supabase.from('profiles').update({cover_url:nextUrl} as any).eq('user_id',user.id);if(error){console.error('Cover update error:',error);const previous=JSON.parse(localStorage.getItem(OPTIONAL_PROFILE_KEY(user.id))||'{}');localStorage.setItem(OPTIONAL_PROFILE_KEY(user.id),JSON.stringify({...previous,cover_url:result.url}));}else{await refreshProfile();}toast.success('Capa atualizada!');};
 const handleSave=async()=>{if(!user)return;setSaving(true);try{const{error}=await supabase.from('profiles').update({name:name.trim()||user.email?.split('@')[0]||'Usuário',display_name:displayName.trim()||null,work_period:workPeriod.trim()||null,phone:phone.trim()||null,birth_date:birthDate||null} as any).eq('user_id',user.id);if(error)throw error;const extra={address:address.trim(),description:description.trim(),cover_url:coverUrl};try{const{error:optionalError}=await supabase.from('profiles').update(extra as any).eq('user_id',user.id);if(optionalError)throw optionalError;}catch{localStorage.setItem(OPTIONAL_PROFILE_KEY(user.id),JSON.stringify(extra));}await refreshProfile();toast.success('Perfil atualizado com sucesso!');onOpenChange(false);}catch(error){console.error('Error updating profile:',error);toast.error(error instanceof Error?`Erro ao atualizar perfil: ${error.message}`:'Erro ao atualizar perfil.');}finally{setSaving(false);}};

 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Meu Perfil</DialogTitle><DialogDescription>Atualize suas informações pessoais, foto, capa e descrição.</DialogDescription></DialogHeader><div className="space-y-5">
 <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30"><div className="relative h-32 sm:h-40 bg-muted">{coverUrl&&<img src={coverUrl} alt="Capa do perfil" className="h-full w-full object-cover"/>}<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"/><Button type="button" size="sm" variant="secondary" className="absolute right-3 top-3 z-20 gap-1.5" onClick={()=>coverInputRef.current?.click()} disabled={uploading}><ImageIcon className="h-4 w-4"/>Alterar capa</Button><input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" onChange={handleCoverChange} disabled={uploading}/></div><div className="relative -mt-10 ml-4 pb-3"><div className="relative w-fit"><Avatar className="h-20 w-20 border-4 border-background shadow-lg"><AvatarImage src={avatarUrl} alt={name}/><AvatarFallback className="bg-primary text-xl text-primary-foreground">{getInitials(name||'U')}</AvatarFallback></Avatar><button type="button" aria-label="Alterar foto de perfil" className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow" onClick={()=>avatarInputRef.current?.click()} disabled={uploading}><Camera className="h-4 w-4"/></button><input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="sr-only" onChange={handleAvatarChange} disabled={uploading}/></div><div className="mt-2 flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" className="gap-1.5 rounded-xl" onClick={()=>avatarInputRef.current?.click()} disabled={uploading}><Camera className="h-4 w-4"/>Anexar foto</Button><Button type="button" size="sm" variant="secondary" className="gap-1.5 rounded-xl" onClick={()=>coverInputRef.current?.click()} disabled={uploading}><Upload className="h-4 w-4"/>Anexar capa</Button></div></div></div>
 {uploading&&<p className="text-center text-xs text-muted-foreground">Enviando imagem...</p>}{loadingProfile&&<p className="text-center text-xs text-muted-foreground">Carregando dados do perfil...</p>}
 <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><Label>Status</Label><UserStatusSelector currentStatus={profile?.user_status||'available'}/></div>
 <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nome completo</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></div><div className="space-y-2"><Label>Nome de exibição</Label><Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Como você quer ser chamado"/></div><div className="space-y-2"><Label>Período/Turno</Label><Input value={workPeriod} onChange={e=>setWorkPeriod(e.target.value)} placeholder="Ex.: 08h-17h"/></div><div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(00) 00000-0000"/></div><div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></div><div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Seu endereço"/></div><div className="space-y-2 sm:col-span-2"><Label>Descrição / Sobre mim</Label><Textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Conte um pouco sobre você..." rows={4} maxLength={500}/><p className="text-right text-xs text-muted-foreground">{description.length}/500</p></div><div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input value={profile?.email||user?.email||''} disabled className="bg-muted"/></div></div>
 <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>onOpenChange(false)}><X className="mr-2 h-4 w-4"/>Cancelar</Button><Button onClick={handleSave} disabled={saving||uploading||loadingProfile}><Save className="mr-2 h-4 w-4"/>{saving?'Salvando...':'Salvar'}</Button></div>
 </div></DialogContent></Dialog>;
}
