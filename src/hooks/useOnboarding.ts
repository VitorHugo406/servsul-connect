import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ONBOARDING_COMPLETED_KEY = 'servchat_onboarding_completed';

export function useOnboarding() {
  const { user, profile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setShowOnboarding(false);
      setLoading(false);
      return;
    }

    // Check if user has completed onboarding
    const checkOnboarding = async () => {
      try {
        // First check localStorage for quick access
        const localCompleted = localStorage.getItem(`${ONBOARDING_COMPLETED_KEY}_${user.id}`);
        if (localCompleted === 'true') {
          setShowOnboarding(false);
          setLoading(false);
          return;
        }

        // Check if user was created recently (within last 5 minutes = new user)
        const createdAt = new Date(profile.created_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
        
        // If user was created more than 5 minutes ago, they're not new
        if (diffMinutes > 5) {
          // Mark as completed to avoid future checks
          localStorage.setItem(`${ONBOARDING_COMPLETED_KEY}_${user.id}`, 'true');
          setShowOnboarding(false);
          setLoading(false);
          return;
        }

        // New user - show onboarding
        setShowOnboarding(true);
        setLoading(false);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setShowOnboarding(false);
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [user, profile]);

  const completeOnboarding = useCallback(() => {
    if (user) {
      localStorage.setItem(`${ONBOARDING_COMPLETED_KEY}_${user.id}`, 'true');
    }
    setShowOnboarding(false);
  }, [user]);

  const resetOnboarding = useCallback(() => {
    if (user) {
      localStorage.removeItem(`${ONBOARDING_COMPLETED_KEY}_${user.id}`);
      setShowOnboarding(true);
    }
  }, [user]);

  return {
    showOnboarding,
    loading,
    completeOnboarding,
    resetOnboarding,
  };
}
