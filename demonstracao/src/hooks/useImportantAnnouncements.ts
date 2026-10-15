 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 interface ImportantAnnouncement {
   id: string;
   title: string;
   content: string;
   border_style: string;
   created_at: string;
   start_at: string | null;
   expire_at: string | null;
 }
 
 export function useImportantAnnouncements() {
   const { user } = useAuth();
   const [pendingAnnouncement, setPendingAnnouncement] = useState<ImportantAnnouncement | null>(null);
   const [allAnnouncements, setAllAnnouncements] = useState<ImportantAnnouncement[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchAnnouncements = useCallback(async () => {
     if (!user) {
       setLoading(false);
       return;
     }
 
     try {
       const now = new Date().toISOString();
       
       // Fetch all active announcements that are within the date range
       const { data: announcements, error: announcementsError } = await supabase
         .from('important_announcements')
         .select('*')
         .eq('is_active', true)
         .or(`start_at.is.null,start_at.lte.${now}`)
         .or(`expire_at.is.null,expire_at.gte.${now}`)
         .order('created_at', { ascending: false });
 
       if (announcementsError) {
         console.error('Error fetching important announcements:', announcementsError);
         setLoading(false);
         return;
       }
 
       if (!announcements || announcements.length === 0) {
         setLoading(false);
         return;
       }
 
       // Fetch which announcements this user has already read
       const { data: reads, error: readsError } = await supabase
         .from('important_announcement_reads')
         .select('announcement_id')
         .eq('user_id', user.id);
 
       if (readsError) {
         console.error('Error fetching announcement reads:', readsError);
         setLoading(false);
         return;
       }
 
       const readIds = new Set(reads?.map(r => r.announcement_id) || []);
       
       // Filter to valid announcements (within date range)
       const validAnnouncements = announcements.filter(a => {
         const now = new Date();
         if (a.start_at && new Date(a.start_at) > now) return false;
         if (a.expire_at && new Date(a.expire_at) < now) return false;
         return true;
       });
       
       // Store all valid announcements for the chatbot
       setAllAnnouncements(validAnnouncements);
       
       // Find the first unread announcement
       const unreadAnnouncement = validAnnouncements.find(a => !readIds.has(a.id));
       
       if (unreadAnnouncement) {
         setPendingAnnouncement(unreadAnnouncement);
       }
     } catch (error) {
       console.error('Error in useImportantAnnouncements:', error);
     } finally {
       setLoading(false);
     }
   }, [user]);
 
   useEffect(() => {
     fetchAnnouncements();
   }, [fetchAnnouncements]);
 
   const markAsRead = useCallback(async (announcementId: string) => {
     if (!user) return;
 
     try {
       await supabase
         .from('important_announcement_reads')
         .insert({
           announcement_id: announcementId,
           user_id: user.id,
         });
       
       setPendingAnnouncement(null);
     } catch (error) {
       console.error('Error marking announcement as read:', error);
     }
   }, [user]);
 
   const dismissAnnouncement = useCallback(() => {
     if (pendingAnnouncement) {
       markAsRead(pendingAnnouncement.id);
     }
   }, [pendingAnnouncement, markAsRead]);
 
   return {
     pendingAnnouncement,
     allAnnouncements,
     loading,
     dismissAnnouncement,
     refetch: fetchAnnouncements,
   };
 }