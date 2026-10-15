import { useState, useRef, useEffect } from 'react';
import { Camera, Save, X, Image as ImageIcon } from 'lucide-react';
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

export function UserProfileDialog({open,onOpenChange}:UserProfileDialogProps){
 const{profile,refreshProfile}=useAuth(); const{uploadAvatar,uploadFile,uploading}=useFileUpload(); const avatarInputRef=useRef<HTMLInputElement>(null); const coverInputRef=useRef<HTMLInputElement>(null);
 const[name,setName]=useState('');const[displayName,setDisplayName]=useState('');const[workPeriod,setWorkPeriod]=useState('');const[phone,setPhone]=useState('');const[address,setAddress]=useState('');const[birthDate,setBirthDate]=useState('');const[description,setDescription]=useState('');const[avatarUrl,setAvatarUrl]=useState('');const[coverUrl,setCoverUrl]=useState('');const[saving,setSaving]=useState(false);
 useEffect(()=>{if(!profile)return;let extra:any={};try{extra=JSON.parse(localStorage.getItem(OPTIONAL_PROFILE_KEY(profile.user_id))||'{}')}catch{};setName(profile.name||'');setDisplayName(profile.display_name||'');setWorkPeriod(profile.work_period||'');setPhone((profile as any).phone||'');setBirthDate((profile as any).birth_date||'');setAddress((profile as any).address||extra.address||'');setDescription((profile as any).description||extra.description||'');setAvatarUrl(profile.avatar_url||'');setCoverUrl((profile as any).cover_url||extra.cover_url||'');},[profile]);
 const getInitials=(value:string)=>value.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase();
 const handleAvatarChange=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;const url=await uploadAvatar(file);if(url){setAvatarUrl(url);await refreshProfile();}};
 const handleCoverChange=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;const result=await uploadFile(file,'avatars');if(result){setCoverUrl(result.url);}};
 const handleSave=async()=>{if(!profile)return;setSaving(true);try{
   const{error}=await supabase.from('profiles').update({name,display_name:displayName||null,work_period:workPeriod||null,phone:phone||null,birth_date:birthDate||null} as any).eq('user_id',profile.user_id);
   if(error)throw error;
   // Optional fields are written when their DB columns exist; local fallback keeps the
   // profile UI usable on environments where the migration has not run yet.
   const extra={address:address||'',description:description||'',cover_url:coverUrl||''};
   try{const{error:optionalError}=await supabase.from('profiles').update(extra as any).eq('user_id',profile.user_id);if(optionalError){console.warn('Optional profile columns unavailable; using local fallback.',optionalError.message);localStorage.setItem(OPTIONAL_PROFILE_KEY(profile.user_id),JSON.stringify(extra));}}catch{localStorage.setItem(OPTIONAL_PROFILE_KEY(profile.user_id),JSON.stringify(extra));}
   await refreshProfile();toast.success('Perfil atualizado com sucesso!');onOpenChange(false);
 }catch(error){console.error('Error updating profile:',error);toast.error(error instanceof Error?`Erro ao atualizar perfil: ${error.message}`:'Erro ao atualizar perfil.');}finally{setSaving(false);}}
 if(!profile)return null;
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100vw-1rem)] max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>Meu Perfil</DialogTitle><DialogDescription>Atualize suas informações pessoais, foto, capa e descrição.</DialogDescription></DialogHeader><div className="space-y-5">
 <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30"><div className="relative h-28 sm:h-36 bg-muted">{coverUrl&&<img src={coverUrl} alt="Capa do perfil" className="h-full w-full object-cover"/>}<div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"/><Button type="button" size="sm" variant="secondary" className="absolute right-3 top-3 gap-1.5" onClick={()=>coverInputRef.current?.click()} disabled={uploading}><ImageIcon className="h-4 w-4"/>Alterar capa</Button><input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange}/></div><div className="relative -mt-10 ml-4 pb-3"><div className="relative w-fit"><Avatar className="h-20 w-20 border-4 border-background shadow-lg"><AvatarImage src={avatarUrl} alt={name}/><AvatarFallback className="bg-primary text-xl text-primary-foreground">{getInitials(name||'U')}</AvatarFallback></Avatar><Button type="button" size="icon" className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full" onClick={()=>avatarInputRef.current?.click()} disabled={uploading}><Camera className="h-4 w-4"/></Button><input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange}/></div></div></div>
 {uploading&&<p className="text-center text-xs text-muted-foreground">Enviando imagem...</p>}
 <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3"><Label>Status</Label><UserStatusSelector currentStatus={profile.user_status||'available'}/></div>
 <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nome completo</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></div><div className="space-y-2"><Label>Nome de exibição</Label><Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Como você quer ser chamado"/></div><div className="space-y-2"><Label>Período/Turno</Label><Input value={workPeriod} onChange={e=>setWorkPeriod(e.target.value)} placeholder="Ex.: 08h-17h"/></div><div className="space-y-2"><Label>Telefone</Label><Input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(00) 00000-0000"/></div><div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></div><div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Seu endereço"/></div><div className="space-y-2 sm:col-span-2"><Label>Descrição / Sobre mim</Label><Textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Conte um pouco sobre você..." rows={4} maxLength={500}/><p className="text-right text-xs text-muted-foreground">{description.length}/500</p></div><div className="space-y-2 sm:col-span-2"><Label>Email</Label><Input value={profile.email} disabled className="bg-muted"/></div></div>
 <div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>onOpenChange(false)}><X className="mr-2 h-4 w-4"/>Cancelar</Button><Button onClick={handleSave} disabled={saving||uploading}><Save className="mr-2 h-4 w-4"/>{saving?'Salvando...':'Salvar'}</Button></div>
 </div></DialogContent></Dialog>;
}
