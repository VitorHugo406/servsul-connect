import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, AlertCircle, Loader2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface FacialLoginCameraProps {
  onSuccess: (userId: string, email: string) => void;
  onCancel: () => void;
  className?: string;
}

interface StoredFaceData {
  userId: string;
  profileId: string;
  email: string;
  name: string;
  descriptor: number[];
}

export function FacialLoginCamera({ onSuccess, onCancel, className }: FacialLoginCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [matchedUser, setMatchedUser] = useState<{ name: string; email: string } | null>(null);
  const [storedFaces, setStoredFaces] = useState<StoredFaceData[]>([]);
  const [loadingFaces, setLoadingFaces] = useState(true);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    isModelLoaded,
    isLoading,
    error,
    isCameraActive,
    startCamera,
    stopCamera,
    detectFace,
    findMatchingFace,
    setError,
  } = useFaceRecognition();

  // Fetch all registered faces
  useEffect(() => {
    const fetchFaces = async () => {
      try {
        // Use edge function to get all facial data (bypasses RLS for login)
        const { data, error } = await supabase.functions.invoke('get-facial-data');
        
        if (error) {
          console.error('Error fetching facial data:', error);
          setError('Erro ao carregar dados faciais');
          return;
        }

        if (data?.faces) {
          setStoredFaces(data.faces);
        }
      } catch (err) {
        console.error('Error fetching faces:', err);
        setError('Erro ao carregar dados faciais');
      } finally {
        setLoadingFaces(false);
      }
    };

    fetchFaces();
  }, [setError]);

  // Start camera when models are loaded
  useEffect(() => {
    if (videoRef.current && isModelLoaded && !loadingFaces) {
      startCamera(videoRef.current);
    }

    return () => {
      stopCamera();
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [isModelLoaded, loadingFaces, startCamera, stopCamera]);

  // Continuous face scanning
  const startScanning = useCallback(async () => {
    if (!isCameraActive || storedFaces.length === 0) return;

    setIsScanning(true);
    
    const scan = async () => {
      const descriptor = await detectFace();
      
      if (descriptor) {
        const match = findMatchingFace(
          descriptor,
          storedFaces.map(f => ({
            userId: f.userId,
            profileId: f.profileId,
            descriptor: f.descriptor,
          })),
          0.5 // Threshold - lower = more strict
        );

        if (match) {
          const matchedFace = storedFaces.find(f => f.userId === match.userId);
          if (matchedFace) {
            setMatchedUser({ name: matchedFace.name, email: matchedFace.email });
            
            // Stop scanning
            if (scanIntervalRef.current) {
              clearInterval(scanIntervalRef.current);
            }
            
            // Trigger success after short delay
            setTimeout(() => {
              onSuccess(matchedFace.userId, matchedFace.email);
            }, 1000);
          }
        }
      }
    };

    // Scan every 500ms
    scanIntervalRef.current = setInterval(scan, 500);
    scan(); // Initial scan
  }, [isCameraActive, storedFaces, detectFace, findMatchingFace, onSuccess]);

  useEffect(() => {
    if (isCameraActive && storedFaces.length > 0 && !isScanning && !matchedUser) {
      startScanning();
    }
  }, [isCameraActive, storedFaces, isScanning, matchedUser, startScanning]);

  const isLoadingState = isLoading || loadingFaces;

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Camera view */}
      <div className="relative w-full max-w-sm aspect-[3/4] bg-muted rounded-2xl overflow-hidden">
        {isLoadingState && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 z-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Carregando modelos...' : 'Carregando dados faciais...'}
            </p>
          </div>
        )}
        
        {!isLoadingState && !isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center px-4">
              Aguardando permissão da câmera...
            </p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover",
            !isCameraActive && "hidden"
          )}
        />

        {/* Face guide overlay */}
        {isCameraActive && !matchedUser && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={cn(
              "w-48 h-60 border-4 border-dashed rounded-full transition-colors",
              isScanning ? "border-primary animate-pulse" : "border-primary/50"
            )} />
          </div>
        )}

        {/* Scanning overlay */}
        {isScanning && !matchedUser && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="bg-background/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Procurando rosto...</span>
            </div>
          </div>
        )}

        {/* Match success overlay */}
        {matchedUser && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20 z-10">
            <UserCheck className="h-16 w-16 text-green-500" />
            <p className="text-green-700 font-medium mt-2">Bem-vindo, {matchedUser.name}!</p>
            <p className="text-sm text-green-600">Entrando...</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* No faces registered warning */}
      {!loadingFaces && storedFaces.length === 0 && (
        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-100 px-3 py-2 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Nenhum rosto cadastrado no sistema</span>
        </div>
      )}

      {/* Instructions */}
      <p className="text-sm text-muted-foreground text-center">
        Posicione seu rosto dentro do círculo para entrar automaticamente
      </p>

      {/* Cancel button */}
      <Button
        variant="outline"
        onClick={onCancel}
        className="w-full max-w-sm"
      >
        <X className="h-4 w-4 mr-2" />
        Voltar para login tradicional
      </Button>
    </div>
  );
}
