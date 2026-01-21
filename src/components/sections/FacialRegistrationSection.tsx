import { useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Search, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { FacialCamera } from '@/components/facial/FacialCamera';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  sector_id: string | null;
  hasFacialData: boolean;
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

export function FacialRegistrationSection() {
  const { profile: currentProfile, isAdmin, canAccess } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [registering, setRegistering] = useState(false);

  const canManageFaces = isAdmin || canAccess('can_access_management');

  // Fetch profiles and facial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, name, email, avatar_url, sector_id')
          .eq('is_active', true)
          .order('name');

        if (profilesError) throw profilesError;

        // Fetch sectors
        const { data: sectorsData, error: sectorsError } = await supabase
          .from('sectors')
          .select('id, name, color');

        if (sectorsError) throw sectorsError;
        setSectors(sectorsData || []);

        // Fetch facial data to check which users have it
        const { data: facialData, error: facialError } = await supabase
          .from('user_facial_data')
          .select('user_id');

        if (facialError) {
          console.error('Error fetching facial data:', facialError);
        }

        const usersWithFacial = new Set(facialData?.map(f => f.user_id) || []);

        // Filter profiles based on permissions
        let filteredProfiles = profilesData || [];
        if (!canManageFaces) {
          // Regular users can only see/register their own face
          filteredProfiles = filteredProfiles.filter(p => p.user_id === currentProfile?.user_id);
        }

        setProfiles(
          filteredProfiles.map(p => ({
            ...p,
            hasFacialData: usersWithFacial.has(p.user_id),
          }))
        );
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [canManageFaces, currentProfile?.user_id]);

  const getSectorName = (sectorId: string | null) => {
    if (!sectorId) return 'Sem setor';
    const sector = sectors.find(s => s.id === sectorId);
    return sector?.name || 'Sem setor';
  };

  const handleOpenCamera = (profile: Profile) => {
    setSelectedProfile(profile);
    setShowCamera(true);
  };

  const handleCapture = async (descriptor: Float32Array, imageDataUrl: string) => {
    if (!selectedProfile) return;

    setRegistering(true);
    try {
      // Convert Float32Array to regular array for JSON
      const descriptorArray = Array.from(descriptor);

      // Call edge function to register facial data
      const { error } = await supabase.functions.invoke('register-facial-data', {
        body: {
          email: selectedProfile.email,
          descriptors: [descriptorArray], // Array of descriptors
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(`Face ${selectedProfile.hasFacialData ? 'atualizada' : 'cadastrada'} com sucesso!`);
      
      // Update local state
      setProfiles(prev =>
        prev.map(p =>
          p.id === selectedProfile.id ? { ...p, hasFacialData: true } : p
        )
      );
      
      setShowCamera(false);
      setSelectedProfile(null);
    } catch (error) {
      console.error('Error registering face:', error);
      toast.error('Erro ao cadastrar face. Tente novamente.');
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelCamera = () => {
    setShowCamera(false);
    setSelectedProfile(null);
  };

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Camera className="h-5 w-5" />
            Cadastro Facial
          </CardTitle>
          <CardDescription>
            {canManageFaces 
              ? 'Gerencie o cadastro facial dos colaboradores'
              : 'Cadastre seu reconhecimento facial para login rápido'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          {canManageFaces && profiles.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* User list */}
          <ScrollArea className="h-[calc(100vh-280px)]">
            <div className="space-y-2">
              {filteredProfiles.map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{profile.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getSectorName(profile.sector_id)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {profile.hasFacialData ? (
                      <>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                          <Check className="h-3 w-3 mr-1" />
                          Cadastrado
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenCamera(profile)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenCamera(profile)}
                        className="gradient-primary text-xs"
                      >
                        <Camera className="h-4 w-4 mr-1" />
                        Cadastrar
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {filteredProfiles.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum colaborador encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={open => !open && handleCancelCamera()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedProfile?.hasFacialData ? 'Atualizar' : 'Cadastrar'} Face
            </DialogTitle>
            <DialogDescription>
              {selectedProfile?.name}
            </DialogDescription>
          </DialogHeader>
          
          {registering ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
              <p className="text-muted-foreground">Salvando dados faciais...</p>
            </div>
          ) : (
            <FacialCamera
              mode="register"
              onCapture={handleCapture}
              onCancel={handleCancelCamera}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
