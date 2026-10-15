import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';

interface UseFaceRecognitionOptions {
  onFaceDetected?: (descriptor: Float32Array) => void;
  onError?: (error: string) => void;
}

export function useFaceRecognition(options: UseFaceRecognitionOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [detectedFace, setDetectedFace] = useState<Float32Array | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        
        setIsModelLoaded(true);
        console.log('Face-api models loaded successfully');
      } catch (err) {
        console.error('Error loading face-api models:', err);
        setError('Erro ao carregar modelos de reconhecimento facial');
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Start camera
  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      videoRef.current = videoElement;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      
      streamRef.current = stream;
      videoElement.srcObject = stream;
      await videoElement.play();
      setIsCameraActive(true);
      setError(null);
      
      return true;
    } catch (err) {
      console.error('Error starting camera:', err);
      setError('Erro ao acessar a câmera. Verifique as permissões.');
      return false;
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
    setDetectedFace(null);
  }, []);

  // Detect face and get descriptor
  const detectFace = useCallback(async (): Promise<Float32Array | null> => {
    if (!videoRef.current || !isModelLoaded) {
      return null;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        setDetectedFace(detection.descriptor);
        options.onFaceDetected?.(detection.descriptor);
        return detection.descriptor;
      }
      
      return null;
    } catch (err) {
      console.error('Error detecting face:', err);
      return null;
    }
  }, [isModelLoaded, options]);

  // Capture face for registration
  const captureFace = useCallback(async (): Promise<{ descriptor: Float32Array; imageDataUrl: string } | null> => {
    if (!videoRef.current || !isModelLoaded) {
      setError('Câmera ou modelos não estão prontos');
      return null;
    }

    try {
      // Detect face
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setError('Nenhum rosto detectado. Posicione seu rosto na câmera.');
        return null;
      }

      // Capture image from video
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
      }
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

      setDetectedFace(detection.descriptor);
      setError(null);
      
      return {
        descriptor: detection.descriptor,
        imageDataUrl,
      };
    } catch (err) {
      console.error('Error capturing face:', err);
      setError('Erro ao capturar rosto. Tente novamente.');
      return null;
    }
  }, [isModelLoaded]);

  // Compare faces - returns distance (lower = more similar, < 0.6 is usually a match)
  const compareFaces = useCallback((descriptor1: Float32Array, descriptor2: Float32Array): number => {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }, []);

  // Find matching face from array of descriptors
  const findMatchingFace = useCallback((
    targetDescriptor: Float32Array,
    storedDescriptors: { userId: string; profileId: string; descriptor: number[] }[],
    threshold: number = 0.5
  ): { userId: string; profileId: string; distance: number } | null => {
    let bestMatch: { userId: string; profileId: string; distance: number } | null = null;

    for (const stored of storedDescriptors) {
      const storedFloat32 = new Float32Array(stored.descriptor);
      const distance = faceapi.euclideanDistance(targetDescriptor, storedFloat32);
      
      if (distance < threshold && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = {
          userId: stored.userId,
          profileId: stored.profileId,
          distance,
        };
      }
    }

    return bestMatch;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    isModelLoaded,
    isLoading,
    error,
    isCameraActive,
    detectedFace,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    detectFace,
    captureFace,
    compareFaces,
    findMatchingFace,
    setError,
  };
}
