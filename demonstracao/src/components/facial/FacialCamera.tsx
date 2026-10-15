import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { cn } from '@/lib/utils';

interface FacialCameraProps {
  onCapture: (descriptor: Float32Array, imageDataUrl: string) => void;
  onCancel: () => void;
  mode: 'register' | 'login';
  className?: string;
}

export function FacialCamera({ onCapture, onCancel, mode, className }: FacialCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureSuccess, setCaptureSuccess] = useState(false);
  
  const {
    isModelLoaded,
    isLoading,
    error,
    isCameraActive,
    startCamera,
    stopCamera,
    captureFace,
    setError,
  } = useFaceRecognition();

  useEffect(() => {
    if (videoRef.current && isModelLoaded) {
      startCamera(videoRef.current);
    }

    return () => {
      stopCamera();
    };
  }, [isModelLoaded, startCamera, stopCamera]);

  const handleCapture = async () => {
    setIsCapturing(true);
    setError(null);
    
    const result = await captureFace();
    
    if (result) {
      setCaptureSuccess(true);
      setTimeout(() => {
        onCapture(result.descriptor, result.imageDataUrl);
      }, 500);
    }
    
    setIsCapturing(false);
  };

  const handleRetry = () => {
    setCaptureSuccess(false);
    setError(null);
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Camera view */}
      <div className="relative w-full max-w-sm aspect-[3/4] bg-muted rounded-2xl overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 z-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Carregando modelos...</p>
          </div>
        )}
        
        {!isLoading && !isCameraActive && (
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
        {isCameraActive && !captureSuccess && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-60 border-4 border-dashed border-primary/50 rounded-full" />
          </div>
        )}

        {/* Success overlay */}
        {captureSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20 z-10">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-green-700 font-medium mt-2">Rosto capturado!</p>
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

      {/* Instructions */}
      <p className="text-sm text-muted-foreground text-center">
        {mode === 'register' 
          ? 'Posicione seu rosto dentro do círculo e clique em capturar'
          : 'Posicione seu rosto dentro do círculo para entrar'
        }
      </p>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-sm">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 min-w-0"
          disabled={isCapturing}
        >
          <X className="h-4 w-4 mr-1 flex-shrink-0" />
          <span className="truncate">Cancelar</span>
        </Button>
        
        {error ? (
          <Button
            onClick={handleRetry}
            className="flex-1 min-w-0"
          >
            <RefreshCw className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="truncate">Tentar novamente</span>
          </Button>
        ) : (
          <Button
            onClick={handleCapture}
            disabled={!isCameraActive || isLoading || isCapturing || captureSuccess}
            className="flex-1 min-w-0 gradient-primary"
          >
            {isCapturing ? (
              <>
                <div className="h-4 w-4 mr-1 flex-shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span className="truncate">Capturando...</span>
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-1 flex-shrink-0" />
                <span className="truncate">Capturar</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
