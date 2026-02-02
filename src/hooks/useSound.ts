import { useCallback, useRef } from 'react';

// Sound frequencies for different notification types
const SOUNDS = {
  // Notification sound - gentle chime
  notification: {
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5 - major chord
    duration: 0.15,
    type: 'sine' as OscillatorType,
    volume: 0.3,
  },
  // Message sent - soft pop
  messageSent: {
    frequencies: [440], // A4
    duration: 0.08,
    type: 'sine' as OscillatorType,
    volume: 0.2,
  },
  // Message received - gentle ding
  messageReceived: {
    frequencies: [587.33, 783.99], // D5, G5
    duration: 0.12,
    type: 'sine' as OscillatorType,
    volume: 0.25,
  },
  // Success - pleasant ascending
  success: {
    frequencies: [392, 493.88, 587.33], // G4, B4, D5
    duration: 0.1,
    type: 'sine' as OscillatorType,
    volume: 0.2,
  },
  // Deep notification - for important alerts
  deepNotification: {
    frequencies: [196, 246.94], // G3, B3 - deeper tones
    duration: 0.2,
    type: 'sine' as OscillatorType,
    volume: 0.35,
  },
};

type SoundType = keyof typeof SOUNDS;

export function useSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((soundType: SoundType) => {
    try {
      const audioContext = getAudioContext();
      const sound = SOUNDS[soundType];
      
      // Resume context if suspended
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;
      const masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
      masterGain.gain.value = sound.volume;

      sound.frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(masterGain);
        
        oscillator.type = sound.type;
        oscillator.frequency.value = freq;
        
        // Smooth envelope
        const startTime = now + (index * sound.duration * 0.3);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + sound.duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + sound.duration + 0.1);
      });
    } catch (error) {
      console.warn('Could not play sound:', error);
    }
  }, [getAudioContext]);

  const playNotification = useCallback(() => playSound('notification'), [playSound]);
  const playMessageSent = useCallback(() => playSound('messageSent'), [playSound]);
  const playMessageReceived = useCallback(() => playSound('messageReceived'), [playSound]);
  const playSuccess = useCallback(() => playSound('success'), [playSound]);
  const playDeepNotification = useCallback(() => playSound('deepNotification'), [playSound]);

  return {
    playSound,
    playNotification,
    playMessageSent,
    playMessageReceived,
    playSuccess,
    playDeepNotification,
  };
}
