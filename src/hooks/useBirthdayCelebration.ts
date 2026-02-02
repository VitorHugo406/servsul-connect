import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import confetti from 'canvas-confetti';

const CELEBRATION_STORAGE_KEY = 'servchat_birthday_celebrated';

export function useBirthdayCelebration() {
  const { profile } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);

  const checkBirthday = useCallback(() => {
    if (!profile?.birth_date) return false;

    const today = new Date();
    const [year, month, day] = profile.birth_date.split('-').map(Number);
    
    // Check if today is the birthday
    const isToday = today.getMonth() + 1 === month && today.getDate() === day;
    
    if (!isToday) return false;

    // Check if already celebrated today
    const todayKey = `${CELEBRATION_STORAGE_KEY}_${profile.id}_${today.toISOString().split('T')[0]}`;
    const alreadyCelebrated = localStorage.getItem(todayKey);
    
    if (alreadyCelebrated) return false;

    return true;
  }, [profile]);

  const triggerCelebration = useCallback(() => {
    if (!profile) return;

    const today = new Date();
    const todayKey = `${CELEBRATION_STORAGE_KEY}_${profile.id}_${today.toISOString().split('T')[0]}`;
    
    // Mark as celebrated
    localStorage.setItem(todayKey, 'true');
    
    // Show celebration modal
    setShowCelebration(true);

    // Fire confetti
    const duration = 5000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: ReturnType<typeof setInterval> = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
      });
    }, 250);

    // Also trigger center burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'],
      zIndex: 9999,
    });
  }, [profile]);

  useEffect(() => {
    if (checkBirthday()) {
      // Small delay to let the page load
      const timeout = setTimeout(() => {
        triggerCelebration();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [checkBirthday, triggerCelebration]);

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  return {
    showCelebration,
    closeCelebration,
    userName: profile?.display_name || profile?.name || 'Usuário',
  };
}
