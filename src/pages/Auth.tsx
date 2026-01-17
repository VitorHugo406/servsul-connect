import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Calendar, Building2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const GERAL_SECTOR_ID = '00000000-0000-0000-0000-000000000001';

interface Sector {
  id: string;
  name: string;
  color: string;
}

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  birthDate: z.string().min(1, 'Data de nascimento é obrigatória'),
  sectorId: z.string().min(1, 'Setor é obrigatório'),
  registrationPassword: z.string().min(1, 'Senha de autorização é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [registrationPassword, setRegistrationPassword] = useState('');
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Fetch sectors for the signup form
  useEffect(() => {
    const fetchSectors = async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name, color')
        .neq('id', GERAL_SECTOR_ID) // Exclude Geral from selection
        .order('name');

      if (!error && data) {
        setSectors(data);
      }
    };

    fetchSectors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
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
      } else {
        const validation = signupSchema.safeParse({ 
          name, 
          email, 
          password, 
          confirmPassword,
          birthDate,
          sectorId,
          registrationPassword,
        });
        if (!validation.success) {
          setError(validation.error.errors[0].message);
          setLoading(false);
          return;
        }

        // Call the edge function to register the user
        const response = await supabase.functions.invoke('register-user', {
          body: {
            email,
            password,
            name,
            birthDate,
            sectorId,
            registrationPassword,
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

        // Auto-login after successful registration
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError('Conta criada! Faça login para continuar.');
          setIsLogin(true);
          setLoading(false);
          return;
        }
        
        navigate('/');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('Ocorreu um erro. Tente novamente.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setBirthDate('');
    setSectorId('');
    setRegistrationPassword('');
    setError(null);
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
      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-secondary">
              <MessageSquare className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">ServChat</h1>
              <p className="text-xs text-muted-foreground">Grupo Servsul</p>
            </div>
          </div>

          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="font-display text-2xl">
                {isLogin ? 'Bem-vindo de volta!' : 'Criar conta'}
              </CardTitle>
              <CardDescription>
                {isLogin
                  ? 'Entre com suas credenciais para acessar'
                  : 'Preencha os dados para se cadastrar'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Registration Password for signup - FIRST FIELD */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="registrationPassword" className="flex items-center gap-1">
                      <KeyRound className="h-3 w-3" />
                      Senha de autorização
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="registrationPassword"
                        type="password"
                        placeholder="Digite a senha de cadastro"
                        value={registrationPassword}
                        onChange={(e) => setRegistrationPassword(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Solicite a senha de autorização ao administrador do sistema
                    </p>
                  </div>
                )}

                {/* Name field for signup */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="name"
                        type="text"
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email corporativo</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@servsul.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                {/* Confirm Password for signup */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {/* Birth Date for signup */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Data de nascimento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="birthDate"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="pl-10"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {/* Sector for signup */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="sector">Setor responsável</Label>
                    <Select value={sectorId} onValueChange={setSectorId}>
                      <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Selecione seu setor" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
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
                    <p className="text-xs text-muted-foreground">
                      Você também terá acesso ao setor Geral automaticamente
                    </p>
                  </div>
                )}

                {/* Submit Button */}
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
                  ) : isLogin ? (
                    'Entrar'
                  ) : (
                    'Criar conta'
                  )}
                </Button>
              </form>

              {/* Toggle Login/Signup */}
              <div className="mt-6 text-center text-sm">
                <span className="text-muted-foreground">
                  {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    resetForm();
                  }}
                  className="ml-1 font-medium text-primary hover:underline"
                >
                  {isLogin ? 'Cadastre-se' : 'Fazer login'}
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            © 2026 Grupo Servsul. Todos os direitos reservados.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
