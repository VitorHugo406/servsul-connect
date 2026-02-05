import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Building2, 
  MapPin,
  Calendar,
  Hash,
  ChevronRight,
  ChevronLeft,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

interface Sector {
  id: string;
  name: string;
  color: string;
}

interface UserRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectors: Sector[];
  onSuccess: () => void;
}

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

const step1Schema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  profileType: z.enum(['admin', 'user', 'gestor', 'gerente', 'supervisor', 'diretoria']),
  registrationNumber: z.string().optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const step2Schema = z.object({
  sectorId: z.string().min(1, 'Setor responsável é obrigatório'),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
});

export function UserRegistrationDialog({ 
  open, 
  onOpenChange, 
  sectors,
  onSuccess 
}: UserRegistrationDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [company, setCompany] = useState('');
  const [profileType, setProfileType] = useState<'admin' | 'user' | 'gestor' | 'gerente' | 'supervisor' | 'diretoria'>('user');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [password, setPassword] = useState('');

  // Step 2 fields
  const [sectorId, setSectorId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [additionalSectors, setAdditionalSectors] = useState<string[]>([]);
  const [canPostAnnouncements, setCanPostAnnouncements] = useState(false);
  const [canDeleteMessages, setCanDeleteMessages] = useState(false);
  const [canAccessManagement, setCanAccessManagement] = useState(false);
  const [canAccessPasswordChange, setCanAccessPasswordChange] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setStep(1);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCompany('');
    setProfileType('user');
    setRegistrationNumber('');
    setPassword('');
    setSectorId('');
    setBirthDate('');
    setAdditionalSectors([]);
    setCanPostAnnouncements(false);
    setCanDeleteMessages(false);
    setCanAccessManagement(false);
    setCanAccessPasswordChange(false);
    setIsActive(true);
    setErrors({});
  };

  const validateStep1 = () => {
    const result = step1Schema.safeParse({
      name,
      email,
      phone,
      address,
      company,
      profileType,
      registrationNumber,
      password,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const validateStep2 = () => {
    const result = step2Schema.safeParse({
      sectorId,
      birthDate,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      // Get registration password from system settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'registration_password')
        .single();

      if (!settings) {
        toast.error('Erro ao obter configurações do sistema');
        return;
      }

      // Call the edge function to create the user
      const response = await supabase.functions.invoke('register-user', {
        body: {
          email,
          password,
          name,
          birthDate,
          sectorId,
          registrationPassword: settings.value,
          // Additional fields
          phone,
          address,
          company,
          registrationNumber,
          profileType,
          isActive,
          additionalSectors,
          permissions: {
            canPostAnnouncements,
            canDeleteMessages,
            canAccessManagement,
            canAccessPasswordChange,
          },
        },
      });

      if (response.error) {
        toast.error(response.error.message || 'Erro ao criar usuário');
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success('Usuário criado com sucesso!');
      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdditionalSector = (sectorId: string) => {
    setAdditionalSectors(prev => 
      prev.includes(sectorId)
        ? prev.filter(id => id !== sectorId)
        : [...prev, sectorId]
    );
  };

  const availableSectors = sectors.filter(s => s.id !== GERAL_SECTOR_ID);
  const additionalSectorOptions = availableSectors.filter(s => s.id !== sectorId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
          <DialogDescription>
            Preencha os dados para criar um novo usuário no sistema
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className={step === 1 ? 'text-primary font-medium' : 'text-muted-foreground'}>
              Etapa 1 de 2: Dados do Usuário
            </span>
            <span className={step === 2 ? 'text-primary font-medium' : 'text-muted-foreground'}>
              Etapa 2 de 2: Setor e Permissões
            </span>
          </div>
          <Progress value={step === 1 ? 50 : 100} className="h-2" />
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: step === 1 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: step === 1 ? 20 : -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 1 ? (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Nome completo */}
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">
                    <User className="mr-1 inline h-3 w-3" />
                    Nome completo *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo do usuário"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    <Mail className="mr-1 inline h-3 w-3" />
                    E-mail *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com"
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    <Phone className="mr-1 inline h-3 w-3" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                {/* Endereço */}
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    Endereço
                  </Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Endereço completo"
                  />
                </div>

                {/* Empresa */}
                <div className="space-y-2">
                  <Label htmlFor="company">
                    <Building2 className="mr-1 inline h-3 w-3" />
                    Empresa
                  </Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Nome da empresa"
                  />
                </div>

                {/* Tipo de Perfil */}
                <div className="space-y-2">
                  <Label>Tipo de Perfil *</Label>
                  <Select value={profileType} onValueChange={(v) => setProfileType(v as typeof profileType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="diretoria">Diretoria</SelectItem>
                      <SelectItem value="user">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Matrícula */}
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">
                    <Hash className="mr-1 inline h-3 w-3" />
                    Login / Matrícula
                  </Label>
                  <Input
                    id="registrationNumber"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="Número de matrícula"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password">
                    <Lock className="mr-1 inline h-3 w-3" />
                    Senha *
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNext} className="gap-2">
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Setor Responsável */}
                <div className="space-y-2">
                  <Label>
                    <Building2 className="mr-1 inline h-3 w-3" />
                    Setor Responsável *
                  </Label>
                  <Select value={sectorId} onValueChange={setSectorId}>
                    <SelectTrigger className={errors.sectorId ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSectors.map((sector) => (
                        <SelectItem key={sector.id} value={sector.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="h-3 w-3 rounded-full" 
                              style={{ backgroundColor: sector.color }}
                            />
                            {sector.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sectorId && (
                    <p className="text-xs text-destructive">{errors.sectorId}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O usuário também terá acesso ao setor "Geral" automaticamente
                  </p>
                </div>

                {/* Data de Nascimento */}
                <div className="space-y-2">
                  <Label htmlFor="birthDate">
                    <Calendar className="mr-1 inline h-3 w-3" />
                    Data de Nascimento *
                  </Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={errors.birthDate ? 'border-destructive' : ''}
                  />
                  {errors.birthDate && (
                    <p className="text-xs text-destructive">{errors.birthDate}</p>
                  )}
                </div>

                {/* Setores Adicionais */}
                <div className="col-span-2 space-y-2">
                  <Label>Setores Adicionais</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Além do setor nativo e do setor "Geral"
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {additionalSectorOptions.map((sector) => (
                      <label
                        key={sector.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                          additionalSectors.includes(sector.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <Checkbox
                          checked={additionalSectors.includes(sector.id)}
                          onCheckedChange={() => toggleAdditionalSector(sector.id)}
                        />
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: sector.color }}
                        />
                        <span className="text-sm">{sector.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Permissões */}
                <div className="col-span-2 space-y-3 rounded-lg border p-4">
                  <Label className="text-base font-semibold">Permissões Iniciais</Label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="canPost" className="font-normal">
                        Pode postar no mural
                      </Label>
                      <Switch
                        id="canPost"
                        checked={canPostAnnouncements}
                        onCheckedChange={setCanPostAnnouncements}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="canDelete" className="font-normal">
                        Pode excluir mensagens
                      </Label>
                      <Switch
                        id="canDelete"
                        checked={canDeleteMessages}
                        onCheckedChange={setCanDeleteMessages}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="canManage" className="font-normal">
                        Acesso ao Gerenciamento
                      </Label>
                      <Switch
                        id="canManage"
                        checked={canAccessManagement}
                        onCheckedChange={setCanAccessManagement}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="canPassword" className="font-normal">
                        Alteração de Senhas
                      </Label>
                      <Switch
                        id="canPassword"
                        checked={canAccessPasswordChange}
                        onCheckedChange={setCanAccessPasswordChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="font-semibold">Status do Usuário</Label>
                    <p className="text-xs text-muted-foreground">
                      Usuários inativos não podem acessar o sistema
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isActive ? 'text-muted-foreground' : 'font-medium'}>
                      Inativo
                    </span>
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <span className={isActive ? 'font-medium' : 'text-muted-foreground'}>
                      Ativo
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack} className="gap-2">
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="gap-2">
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Criar Usuário
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
