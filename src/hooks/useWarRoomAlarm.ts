import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useWarRoomAlarm() {
  const { user } = useAuth();
  const [pendingWarRoomId, setPendingWarRoomId] = useState<string | null>(null);
  const [isAlarming, setIsAlarming] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkPendingWarRooms = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('war_room_members')
      .select('war_room_id, has_acknowledged, war_room:war_rooms!war_room_members_war_room_id_fkey(id, status)')
      .eq('user_id', user.id)
      .eq('has_acknowledged', false);

    if (error || !data) return;

    // Filter only active war rooms
    const pending = data.filter((d: any) => d.war_room?.status === 'active');
    
    if (pending.length > 0) {
      setPendingWarRoomId(pending[0].war_room_id);
      setIsAlarming(true);
    } else {
      setPendingWarRoomId(null);
      setIsAlarming(false);
    }
  }, [user]);

  // Initial check and realtime subscription
  useEffect(() => {
    checkPendingWarRooms();

    if (!user) return;

    const channel = supabase
      .channel('war-room-alarm')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'war_room_members', filter: `user_id=eq.${user.id}` }, () => {
        checkPendingWarRooms();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'war_room_members', filter: `user_id=eq.${user.id}` }, () => {
        checkPendingWarRooms();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, checkPendingWarRooms]);

  // Alarm sound + vibration
  useEffect(() => {
    if (isAlarming) {
      // Create alarm sound using oscillator
      const playAlarm = () => {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.15;
          osc.type = 'square';
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          
          setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 660;
            gain2.gain.value = 0.15;
            osc2.type = 'square';
            osc2.start();
            osc2.stop(ctx.currentTime + 0.3);
          }, 350);
        } catch (e) {
          // AudioContext may not be available
        }
      };

      playAlarm();
      intervalRef.current = setInterval(playAlarm, 4000);

      // Vibration
      if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500]);
        vibrationRef.current = setInterval(() => {
          navigator.vibrate([500, 200, 500]);
        }, 4000);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (vibrationRef.current) clearInterval(vibrationRef.current);
      if ('vibrate' in navigator) navigator.vibrate(0);
    };
  }, [isAlarming]);

  const dismissAlarm = useCallback(() => {
    setIsAlarming(false);
    setPendingWarRoomId(null);
  }, []);

  return { isAlarming, pendingWarRoomId, dismissAlarm, recheckAlarm: checkPendingWarRooms };
}
