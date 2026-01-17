import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Calendar, 
  Building2, 
  KeyRound,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { toast } from 'sonner';

interface Sector {
  id: string;
  name: string;
  color: string;
}

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

const step1Schema = z.object({
  registrationPassword: z.string().min(1, 'Senha de autorização é obrigatória'),
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const step2Schema = z.object({
  sectorId: z.string().min(1, 'Setor responsável é obrigatório'),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Step 1 fields
  const [registrationPassword, setRegistrationPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Step 2 fields
  const [sectorId, setSectorId] = useState('');
  const [additionalSectors, setAdditionalSectors] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState('');
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Fetch sectors using edge function (bypasses RLS)
  useEffect(() => {
    const fetchSectors = async () => {
      if (isLogin) return;
      
      setLoadingSectors(true);
      try {
        const response = await supabase.functions.invoke('get-public-sectors');
        
        if (response.error) {
          console.error('Error fetching sectors:', response.error);
          toast.error('Erro ao carregar setores');
          return;
        }

        if (response.data?.sectors) {
          setSectors(response.data.sectors);
        }
      } catch (err) {
        console.error('Error fetching sectors:', err);
        toast.error('Erro ao carregar setores');
      } finally {
        setLoadingSectors(false);
      }
    };

    fetchSectors();
  }, [isLogin]);

  const validateStep1 = () => {
    const result = step1Schema.safeParse({
      registrationPassword,
      name,
      email,
      password,
      confirmPassword,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const validateStep2 = () => {
    const result = step2Schema.safeParse({
      sectorId,
      birthDate,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
      setError(null);
    }
  };

  const handleBack = () => {
    setStep(1);
    setFieldErrors({});
    setError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const validation = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos');
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }
      navigate('/');
    } catch (err) {
      console.error('Auth error:', err);
      setError('Ocorreu um erro. Tente novamente.');
      setLoading(false);
    }
  };

  const handleSignupSubmit = async () => {
    if (!validateStep2()) return;

    setError(null);
    setLoading(true);

    try {
      // Call the edge function to register the user
      const response = await supabase.functions.invoke('register-user', {
        body: {
          email,
          password,
          name,
          birthDate,
          sectorId,
          registrationPassword,
          additionalSectors: additionalSectors.length > 0 ? additionalSectors : undefined,
          // Public registration defaults
          profileType: 'user',
          isActive: true,
        },
      });

      if (response.error) {
        setError(response.error.message || 'Erro ao criar conta');
        setLoading(false);
        return;
      }

      if (response.data?.error) {
        setError(response.data.error);
        setLoading(false);
        return;
      }

      toast.success('Conta criada com sucesso!');

      // Auto-login after successful registration
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError('Conta criada! Faça login para continuar.');
        setIsLogin(true);
        resetSignupForm();
        setLoading(false);
        return;
      }
      
      navigate('/');
    } catch (err) {
      console.error('Auth error:', err);
      setError('Ocorreu um erro. Tente novamente.');
      setLoading(false);
    }
  };

  const resetSignupForm = () => {
    setStep(1);
    setRegistrationPassword('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSectorId('');
    setAdditionalSectors([]);
    setBirthDate('');
    setFieldErrors({});
    setError(null);
  };

  const resetLoginForm = () => {
    setLoginEmail('');
    setLoginPassword('');
    setError(null);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    if (isLogin) {
      resetLoginForm();
    } else {
      resetSignupForm();
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md text-white"
        >
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-secondary shadow-glow">
              <MessageSquare className="h-8 w-8" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold">ServChat</h1>
              <p className="text-white/70">Grupo Servsul</p>
            </div>
          </div>
          
          <h2 className="mb-4 font-display text-2xl font-semibold">
            Comunicação Corporativa Integrada
          </h2>
          <p className="mb-8 text-white/80 leading-relaxed">
            Conecte-se com sua equipe, receba avisos oficiais, acompanhe dados em tempo real 
            e mantenha sua identidade digital dentro do Grupo Servsul.
          </p>
          
          <div className="space-y-4">
            {[
              'Chat por setores com emojis',
              'Avisos gerais da empresa',
              'Mural de aniversariantes',
              'Gráficos e visualização de dados',
            ].map((feature, index) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary">
                  <ArrowRight className="h-3 w-3 text-secondary-foreground" />
                </div>
                <span className="text-white/90">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex w-full items-center justify-center bg-background p-4 sm:p-8 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-secondary">
              <MessageSquare className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">ServChat</h1>
              <p className="text-xs text-muted-foreground">Grupo Servsul</p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-4">
              <CardTitle className="font-display text-2xl">
                {isLogin ? 'Bem-vindo de volta!' : 'Criar conta'}
              </CardTitle>
              <CardDescription>
                {isLogin
                  ? 'Entre com suas credenciais para acessar'
                  : step === 1
                    ? 'Etapa 1 de 2: Dados pessoais'
                    : 'Etapa 2 de 2: Setor e informações adicionais'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Progress bar for signup */}
              {!isLogin && (
                <div className="mb-6">
                  <Progress value={step === 1 ? 50 : 100} className="h-2" />
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span className={step === 1 ? 'text-primary font-medium' : ''}>
                      Dados pessoais
                    </span>
                    <span className={step === 2 ? 'text-primary font-medium' : ''}>
                      Setor
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login Form */}
              {isLogin ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">Email corporativo</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="loginEmail"
                        type="email"
                        placeholder="seu.email@servsul.com.br"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="loginPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
                      />
                    ) : (
                      'Entrar'
                    )}
                  </Button>
                </form>
              ) : (
                /* Signup Form */
                <AnimatePresence mode="wait">
                  {step === 1 ? (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Registration Password */}
                      <div className="space-y-2">
                        <Label htmlFor="registrationPassword" className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          Senha de autorização *
                        </Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="registrationPassword"
                            type="password"
                            placeholder="Solicite ao administrador"
                            value={registrationPassword}
                            onChange={(e) => setRegistrationPassword(e.target.value)}
                            className={`pl-10 ${fieldErrors.registrationPassword ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {fieldErrors.registrationPassword && (
                          <p className="text-xs text-destructive">{fieldErrors.registrationPassword}</p>
                        )}
                      </div>

                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome completo *</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="name"
                            type="text"
                            placeholder="Seu nome completo"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={`pl-10 ${fieldErrors.name ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {fieldErrors.name && (
                          <p className="text-xs text-destructive">{fieldErrors.name}</p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email corporativo *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="seu.email@servsul.com.br"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`pl-10 ${fieldErrors.email ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {fieldErrors.email && (
                          <p className="text-xs text-destructive">{fieldErrors.email}</p>
                        )}
                      </div>

                      {/* Passwords in grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="password">Senha *</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className={`pl-10 ${fieldErrors.password ? 'border-destructive' : ''}`}
                            />
                          </div>
                          {fieldErrors.password && (
                            <p className="text-xs text-destructive">{fieldErrors.password}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirmar *</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="confirmPassword"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className={`pl-10 ${fieldErrors.confirmPassword ? 'border-destructive' : ''}`}
                            />
                          </div>
                          {fieldErrors.confirmPassword && (
                            <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="showPwd"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="rounded border-muted-foreground"
                        />
                        <Label htmlFor="showPwd" className="text-sm text-muted-foreground cursor-pointer">
                          Mostrar senhas
                        </Label>
                      </div>

                      <Button
                        type="button"
                        onClick={handleNext}
                        className="w-full gap-2"
                      >
                        Próximo
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Sector */}
                      <div className="space-y-2">
                        <Label>Setor responsável *</Label>
                        <Select value={sectorId} onValueChange={setSectorId}>
                          <SelectTrigger className={fieldErrors.sectorId ? 'border-destructive' : ''}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder={loadingSectors ? 'Carregando...' : 'Selecione seu setor'} />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {loadingSectors ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                Carregando setores...
                              </div>
                            ) : sectors.length === 0 ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                Nenhum setor disponível
                              </div>
                            ) : (
                              sectors.map((sector) => (
                                <SelectItem key={sector.id} value={sector.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="h-3 w-3 rounded-full" 
                                      style={{ backgroundColor: sector.color }}
                                    />
                                    {sector.name}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {fieldErrors.sectorId && (
                          <p className="text-xs text-destructive">{fieldErrors.sectorId}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Você também terá acesso ao setor Geral automaticamente
                        </p>
                      </div>

                      {/* Additional Sectors */}
                      {sectors.filter(s => s.id !== sectorId && s.name !== 'Geral').length > 0 && (
                        <div className="space-y-2">
                          <Label>Setores adicionais (opcional)</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Selecione outros setores que você precisa acessar
                          </p>
                          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                            {sectors
                              .filter(s => s.id !== sectorId && s.name !== 'Geral')
                              .map((sector) => (
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
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setAdditionalSectors([...additionalSectors, sector.id]);
                                      } else {
                                        setAdditionalSectors(additionalSectors.filter(id => id !== sector.id));
                                      }
                                    }}
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
                      )}

                      {/* Birth Date */}
                      <div className="space-y-2">
                        <Label htmlFor="birthDate">Data de nascimento *</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="birthDate"
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            className={`pl-10 ${fieldErrors.birthDate ? 'border-destructive' : ''}`}
                          />
                        </div>
                        {fieldErrors.birthDate && (
                          <p className="text-xs text-destructive">{fieldErrors.birthDate}</p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          className="flex-1 gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSignupSubmit}
                          className="flex-1 gap-2 gradient-primary"
                          disabled={loading}
                        >
                          {loading ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
                            />
                          ) : (
                            <>
                              Criar conta
                              <Check className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* Toggle Login/Signup */}
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                </span>
                <button
                  type="button"
                  onClick={toggleMode}
                  className="ml-1 font-medium text-primary hover:underline"
                >
                  {isLogin ? 'Cadastre-se' : 'Fazer login'}
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © 2025 ServChat - Grupo Servsul. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
