// Assinaturas de e-mail. MySignaturePanel (inside Meu Perfil, everyone): the person picks one of the company's visuals,
// checks their data and copies the signature into Gmail/Outlook. /assinaturas (admins + people with the
// "Criar visuais de assinatura" permission): create/edit visuals — logo position, size and shape, colours, font,
// separator, which fields show, links and legal notice. Tables from migration 20261122010000.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ImageUp, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useSectors } from '@/hooks/useData';
import { getEmployeeRecord } from '@/lib/employeeRecord';
import { appConfirm } from '@/lib/appDialog';
import { dbHasTable } from '@/hooks/useDbFeature';
import { Sel } from '@/components/ui/Sel';
import { Button } from '@/components/ui/button';
import { DEFAULT_SIG, SIG_FONTS, SIG_LAYOUTS, companyLogoPublicUrl, copyRich, fullConfig, renderSignature, signatureText, toHex,
  type SigConfig, type SigPerson, type SigTemplate } from '@/lib/emailSignature';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
type Fields = { name?: string; role?: string; sector?: string; phone?: string; mobile?: string; email?: string; photo?: boolean };

function Preview({ html }: { html: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 text-left shadow-sm" style={{ colorScheme: 'light' }}>
      <div className="mb-3 border-b border-neutral-200 pb-2 text-[11px] text-neutral-400">Prévia — como aparece no fim do e-mail</div>
      <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="flex flex-col gap-1.5"><span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>{children}{hint ? <span className="text-[11.5px] text-muted-foreground">{hint}</span> : null}</label>;
}
const inp = 'dk-in !h-10';
const pinp = 'h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Shared data: company visuals, the person's saved choice and the data that fills the signature. */
function useSignatureData() {
  const { profile, isAdmin } = useAuth();
  const { company } = useCompany();
  const { sectors } = useSectors();
  const [templates, setTemplates] = useState<SigTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [templateId, setTemplateId] = useState<string>('');
  const [fields, setFields] = useState<Fields>({});
  const [jobTitle, setJobTitle] = useState('');
  const companyColor = toHex(company?.primary_color);
  const companyLogo = useMemo(() => companyLogoPublicUrl(company?.logo_url), [company?.logo_url]);
  const builtIn: SigTemplate = useMemo(() => ({ id: '', name: 'Padrão', is_default: true, config: { ...DEFAULT_SIG, color: companyColor, logoUrl: companyLogo } }), [companyColor, companyLogo]);
  const load = useCallback(async () => {
    const [{ data: t }, { data: pref }, { data: perm }] = await Promise.all([
      db.from('email_signature_templates').select('id,name,config,is_default,updated_at').order('is_default', { ascending: false }).order('name'),
      profile?.id ? db.from('email_signature_prefs').select('template_id,fields').eq('profile_id', profile.id).maybeSingle() : Promise.resolve({ data: null }),
      db.rpc('can_manage_signatures'),
    ]);
    setTemplates((t || []) as SigTemplate[]);
    setCanManage(!!perm || isAdmin);
    if (pref) { setTemplateId(pref.template_id || ''); setFields((pref.fields || {}) as Fields); }
    setLoading(false);
  }, [profile?.id, isAdmin]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (profile?.id) void getEmployeeRecord(profile.id).then((r) => setJobTitle(r?.job_title || '')).catch(() => undefined); }, [profile?.id]);
  const sectorName = useMemo(() => ((sectors || []) as { id: string; name: string }[]).find((x) => x.id === profile?.sector_id)?.name || '', [sectors, profile?.sector_id]);
  const base: SigPerson = useMemo(() => ({
    name: profile?.name || profile?.display_name || '', role: jobTitle, sector: sectorName,
    phone: (profile as { phone?: string } | null)?.phone || '', mobile: '', email: profile?.email || '', photo: profile?.avatar_url || null,
  }), [profile, jobTitle, sectorName]);
  return { profile, company, templates, loading, canManage, templateId, setTemplateId, fields, setFields, base, builtIn, companyColor, companyLogo, reload: load };
}

/** "Assinatura de e-mail" inside Meu Perfil: preview + copy for everyone; data/visual adjustable below. */
export function MySignaturePanel() {
  const d = useSignatureData();
  const [saving, setSaving] = useState(false);
  const { profile, templates, templateId, setTemplateId, fields, setFields, base, builtIn } = d;
  const person: SigPerson = { ...base, ...Object.fromEntries(Object.entries(fields).filter(([k, v]) => k !== 'photo' && typeof v === 'string')), photo: fields.photo === false ? null : base.photo };
  const options = templates.length ? templates : [builtIn];
  const current = options.find((t) => t.id === templateId) || options.find((t) => t.is_default) || options[0];
  const cfg = fullConfig(current?.config);
  const html = renderSignature(cfg, person);
  if (d.loading) return <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  const save = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const { error } = await db.from('email_signature_prefs').upsert({ profile_id: profile.id, template_id: templateId || null, fields, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error('Não foi possível salvar sua assinatura.'); else toast.success('Assinatura salva.');
  };
  const copy = async () => { const ok = await copyRich(html, signatureText(cfg, person)); if (ok) toast.success('Assinatura copiada. Cole nas configurações de assinatura do seu e-mail.'); else toast.error('Não foi possível copiar. Use "Copiar código".'); };
  const copyCode = async () => { try { await navigator.clipboard.writeText(html); toast.success('Código HTML copiado.'); } catch { toast.error('Não foi possível copiar.'); } };
  const setF = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));
  const val = (k: Exclude<keyof Fields, 'photo'>) => (fields[k] ?? (base[k] as string) ?? '');
  return (
    <div className="flex flex-col gap-3">
      <Preview html={html} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void copy()}><Copy className="mr-2 h-4 w-4" />Copiar assinatura</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void copyCode()}>Copiar código</Button>
      </div>
      <details className="rounded-xl border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Ajustar meus dados e o visual</summary>
        <div className="mt-3 flex flex-col gap-3">
          {options.length > 1 ? (
            <Field label="Visual">
              <Sel className="ui-sel" value={current?.id || ''} onChange={(e) => setTemplateId(e.target.value)}>
                {options.map((t) => <option key={t.id || 'builtin'} value={t.id}>{t.name}{t.is_default ? ' (padrão)' : ''}</option>)}
              </Sel>
            </Field>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome na assinatura"><input className={pinp} value={val('name')} onChange={setF('name')} /></Field>
            <Field label="Cargo"><input className={pinp} value={val('role')} onChange={setF('role')} placeholder="Ex.: Analista financeiro" /></Field>
            <Field label="Setor"><input className={pinp} value={val('sector')} onChange={setF('sector')} /></Field>
            <Field label="E-mail"><input className={pinp} value={val('email')} onChange={setF('email')} /></Field>
            <Field label="Telefone"><input className={pinp} value={val('phone')} onChange={setF('phone')} placeholder="(11) 3000-0000" /></Field>
            <Field label="Celular / WhatsApp"><input className={pinp} value={val('mobile')} onChange={setF('mobile')} placeholder="(11) 90000-0000" /></Field>
          </div>
          {cfg.photo && base.photo ? <label className="flex items-center gap-2"><input type="checkbox" checked={fields.photo !== false} onChange={(e) => setFields((f) => ({ ...f, photo: e.target.checked }))} />Mostrar minha foto</label> : null}
          <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Salvar minha assinatura</Button>
        </div>
      </details>
      <details className="rounded-xl border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Como colocar no seu e-mail</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li><b className="text-foreground">Gmail:</b> engrenagem › Ver todas as configurações › Geral › Assinatura › Criar nova › cole › Salvar alterações.</li>
          <li><b className="text-foreground">Outlook na web:</b> engrenagem › Contas › Assinaturas › Nova assinatura › cole › Salvar.</li>
          <li><b className="text-foreground">Outlook no computador:</b> Arquivo › Opções › Email › Assinaturas › Nova › cole › OK.</li>
          <li><b className="text-foreground">Apple Mail:</b> Ajustes › Assinaturas › +, desmarque "Usar fonte padrão" e cole.</li>
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">Copie pelo computador; os aplicativos de e-mail do celular costumam aceitar só texto simples.</p>
      </details>
    </div>
  );
}

/** /assinaturas — only for admins and people with "Criar visuais de assinatura": the company's visuals. */
function EmailSignatureInner() {
  const d = useSignatureData();
  const { company, templates, base, companyColor, companyLogo, canManage } = d;
  const [edit, setEdit] = useState<{ id?: string; name: string; config: SigConfig; is_default: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const startNew = () => setEdit({ name: 'Novo visual', config: { ...DEFAULT_SIG, color: companyColor, logoUrl: companyLogo }, is_default: !templates.length });
  const startEdit = (t: SigTemplate) => setEdit({ id: t.id, name: t.name, config: fullConfig(t.config), is_default: t.is_default });
  const setC = <K extends keyof SigConfig>(k: K, v: SigConfig[K]) => setEdit((e) => (e ? { ...e, config: { ...e.config, [k]: v } } : e));
  const upload = async (file: File) => {
    if (!company?.id) return;
    if (!/^image\/(png|jpeg|gif)$/.test(file.type)) { toast.error('Use PNG, JPG ou GIF (outros formatos não aparecem em alguns e-mails).'); return; }
    if (file.size > 1024 * 1024) { toast.error('A imagem precisa ter até 1 MB.'); return; }
    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/gif' ? 'gif' : 'jpg';
    const path = `signatures/${company.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('company-logos').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    setUploading(false);
    if (error) { toast.error('Não foi possível enviar a imagem.'); return; }
    setC('logoUrl', supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl);
  };
  const saveVisual = async () => {
    if (!edit) return;
    const row = { name: edit.name.trim() || 'Visual', config: edit.config, is_default: edit.is_default };
    const { data, error } = edit.id ? await db.from('email_signature_templates').update(row).eq('id', edit.id).select('id').single()
      : await db.from('email_signature_templates').insert(row).select('id').single();
    if (error) { toast.error('Não foi possível salvar o visual.'); return; }
    toast.success('Visual salvo.'); setEdit((e) => (e ? { ...e, id: data.id } : e)); void d.reload();
  };
  const removeVisual = async () => {
    if (!edit?.id) { setEdit(null); return; }
    if (!(await appConfirm({ title: 'Excluir visual?', message: `"${edit.name}" deixa de aparecer para todos. Quem usava passa para o visual padrão.`, confirmText: 'Excluir', danger: true }))) return;
    const { error } = await db.from('email_signature_templates').delete().eq('id', edit.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Visual excluído.'); setEdit(null); void d.reload();
  };

  if (d.loading) return <div className="dk-pg"><div className="dk-panel flex items-center justify-center p-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div></div>;
  if (!canManage) return <div className="dk-pg"><div className="dk-panel dk-empty">Só administradores e quem tem a permissão "Criar visuais de assinatura" configuram os visuais. Sua assinatura fica em Meu Perfil.</div></div>;

  return (
    <div className="dk-pg">
      <div className="dk-panel">
        <div className="dk-bar">
          <div><b className="text-[15px] font-semibold">Visuais de assinatura <span className="ml-1 text-muted-foreground">{templates.length}</span></b><p className="text-xs text-muted-foreground">Cada pessoa escolhe o visual e copia a própria assinatura em Meu Perfil.</p></div>
          <button type="button" className="dk-btn pri" onClick={startNew}><Plus className="h-4 w-4" />Novo visual</button>
        </div>
          <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2 border-r border-border p-4">
              {templates.length === 0 ? <p className="dk-empty !p-6 text-sm">Nenhum visual ainda. Crie o primeiro; ele vira o padrão da empresa.</p> : null}
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => startEdit(t)} className={`ui-btn flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${edit?.id === t.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <span className="flex w-full items-center gap-2 text-sm font-medium">{t.name}{t.is_default ? <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-primary"><Star className="h-3 w-3" />Padrão</span> : null}</span>
                  <span className="pointer-events-none block max-h-[86px] w-full overflow-hidden rounded-lg bg-white p-2" style={{ zoom: 0.55 }} dangerouslySetInnerHTML={{ __html: renderSignature(t.config, base) }} />
                </button>
              ))}
            </div>
            {edit ? (
              <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
                <div className="flex flex-col gap-4">
                  <Field label="Nome do visual"><input className={inp} value={edit.name} maxLength={80} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
                  <Field label="Posição da logo">
                    <div className="flex flex-wrap gap-1.5">{SIG_LAYOUTS.map(([k, l]) => <button key={k} type="button" className="ui-chip dk-cp" aria-pressed={edit.config.layout === k} data-on={edit.config.layout === k} style={edit.config.layout === k ? { background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', borderColor: 'hsl(var(--primary))' } : undefined} onClick={() => setC('layout', k)}>{l}</button>)}</div>
                  </Field>
                  {edit.config.layout !== 'none' ? (
                    <>
                      <Field label="Logo" hint="PNG, JPG ou GIF até 1 MB. A imagem fica num endereço público para abrir no e-mail de quem recebe.">
                        <div className="flex flex-wrap items-center gap-2">
                          {edit.config.logoUrl ? <img src={edit.config.logoUrl} alt="" className="h-10 max-w-[140px] rounded border border-border bg-white object-contain p-1" /> : <span className="text-xs text-muted-foreground">Sem imagem</span>}
                          <label className="dk-btn cursor-pointer">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}Enviar imagem<input type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} /></label>
                          {companyLogo ? <button type="button" className="dk-btn" onClick={() => setC('logoUrl', companyLogo)}>Usar logo da empresa</button> : null}
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={`Tamanho da logo (${edit.config.logoWidth}px)`}><input type="range" min={40} max={240} step={5} value={edit.config.logoWidth} onChange={(e) => setC('logoWidth', +e.target.value)} /></Field>
                        <Field label="Formato"><Sel className="ui-sel" value={edit.config.logoShape} onChange={(e) => setC('logoShape', e.target.value as SigConfig['logoShape'])}><option value="original">Original</option><option value="rounded">Cantos arredondados</option><option value="circle">Redonda</option></Sel></Field>
                      </div>
                    </>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cor de destaque"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent" value={toHex(edit.config.color)} onChange={(e) => setC('color', e.target.value)} /></Field>
                    <Field label="Cor do texto"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent" value={toHex(edit.config.textColor, '#333333')} onChange={(e) => setC('textColor', e.target.value)} /></Field>
                    <Field label="Fonte"><Sel className="ui-sel" value={edit.config.font} onChange={(e) => setC('font', e.target.value)}>{SIG_FONTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Sel></Field>
                    <Field label={`Tamanho do texto (${edit.config.size}px)`}><input type="range" min={11} max={16} value={edit.config.size} onChange={(e) => setC('size', +e.target.value)} /></Field>
                    <Field label="Separador"><Sel className="ui-sel" value={edit.config.divider} onChange={(e) => setC('divider', e.target.value as SigConfig['divider'])}><option value="bar">Barra vertical</option><option value="line">Linha embaixo do nome</option><option value="none">Nenhum</option></Sel></Field>
                    <Field label="Nome"><Sel className="ui-sel" value={edit.config.nameStyle} onChange={(e) => setC('nameStyle', e.target.value as SigConfig['nameStyle'])}><option value="bold">Negrito</option><option value="upper">Maiúsculas</option></Sel></Field>
                  </div>
                  <Field label="O que aparece">
                    <div className="grid grid-cols-2 gap-1.5 text-sm">
                      {([['role', 'Cargo'], ['sector', 'Setor'], ['phone', 'Telefone'], ['mobile', 'Celular'], ['email', 'E-mail'], ['website', 'Site'], ['address', 'Endereço']] as [keyof SigConfig['show'], string][]).map(([k, l]) => (
                        <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={edit.config.show[k]} onChange={(e) => setC('show', { ...edit.config.show, [k]: e.target.checked })} />{l}</label>
                      ))}
                      <label className="flex items-center gap-2"><input type="checkbox" checked={edit.config.photo} onChange={(e) => setC('photo', e.target.checked)} />Foto da pessoa</label>
                    </div>
                  </Field>
                  <Field label="Site"><input className={inp} value={edit.config.website} onChange={(e) => setC('website', e.target.value)} placeholder="www.suaempresa.com.br" /></Field>
                  <Field label="Endereço"><input className={inp} value={edit.config.address} onChange={(e) => setC('address', e.target.value)} /></Field>
                  <Field label="Frase"><input className={inp} value={edit.config.slogan} maxLength={160} onChange={(e) => setC('slogan', e.target.value)} placeholder="Ex.: Juntos fazemos mais" /></Field>
                  <Field label="Redes sociais">
                    <div className="grid grid-cols-2 gap-2">
                      {([['linkedin', 'LinkedIn (link)'], ['instagram', 'Instagram (link)'], ['facebook', 'Facebook (link)'], ['youtube', 'YouTube (link)'], ['whatsapp', 'WhatsApp (número)']] as [keyof SigConfig['social'], string][]).map(([k, l]) => (
                        <input key={k} className={inp} placeholder={l} value={edit.config.social[k]} onChange={(e) => setC('social', { ...edit.config.social, [k]: e.target.value })} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Aviso legal (rodapé)"><textarea className="dk-in !h-auto min-h-[70px] py-2" maxLength={600} value={edit.config.disclaimer} onChange={(e) => setC('disclaimer', e.target.value)} /></Field>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_default} onChange={(e) => setEdit({ ...edit, is_default: e.target.checked })} />Visual padrão da empresa (usado por quem não escolheu outro)</label>
                  <div className="flex gap-2">
                    <button type="button" className="dk-btn pri" onClick={() => void saveVisual()}><Check className="h-4 w-4" />Salvar visual</button>
                    <button type="button" className="dk-btn" onClick={() => void removeVisual()}><Trash2 className="h-4 w-4" />{edit.id ? 'Excluir' : 'Cancelar'}</button>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-3 self-start xl:sticky xl:top-4">
                  <Preview html={renderSignature(edit.config, base)} />
                  <p className="text-xs text-muted-foreground">Prévia com os seus dados. Cada pessoa vê a própria assinatura em "Minha assinatura".</p>
                </div>
              </div>
            ) : (
              <div className="dk-empty flex flex-col items-center gap-3 p-16">
                <p>Escolha um visual à esquerda para editar ou crie um novo.</p>
                <button type="button" className="dk-btn pri" onClick={startNew}><Plus className="h-4 w-4" />Novo visual</button>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}

export function EmailSignatureSection() {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => { let alive = true; void dbHasTable('email_signature_templates').then((v) => { if (alive) setHas(v); }); return () => { alive = false; }; }, []);
  if (has === null) return <div className="dk-pg"><div className="dk-panel flex items-center justify-center p-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div></div>;
  if (!has) return <div className="dk-pg"><div className="dk-panel dk-empty">Assinaturas de e-mail serão liberadas assim que a atualização do banco de dados for aplicada.</div></div>;
  return <EmailSignatureInner />;
}
