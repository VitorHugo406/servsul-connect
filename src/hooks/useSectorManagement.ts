 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 
 export interface Sector {
   id: string;
   name: string;
   color: string;
   icon: string | null;
   created_at: string;
 }
 
 export function useSectorManagement() {
   const [sectors, setSectors] = useState<Sector[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchSectors = useCallback(async () => {
     try {
       const { data, error } = await supabase
         .from('sectors')
         .select('*')
         .order('name');
 
       if (error) throw error;
       setSectors(data || []);
     } catch (error) {
       console.error('Error fetching sectors:', error);
     } finally {
       setLoading(false);
     }
   }, []);
 
   useEffect(() => {
     fetchSectors();
   }, [fetchSectors]);
 
   const createSector = async (name: string, color: string) => {
     try {
       const { data, error } = await supabase
         .from('sectors')
         .insert({ name, color })
         .select()
         .single();
 
       if (error) throw error;
       await fetchSectors();
       return { data, error: null };
     } catch (error) {
       console.error('Error creating sector:', error);
       return { data: null, error };
     }
   };
 
   const updateSector = async (id: string, updates: Partial<Sector>) => {
     try {
       const { error } = await supabase
         .from('sectors')
         .update(updates)
         .eq('id', id);
 
       if (error) throw error;
       await fetchSectors();
       return { error: null };
     } catch (error) {
       console.error('Error updating sector:', error);
       return { error };
     }
   };
 
   const deleteSector = async (id: string) => {
     try {
       const { error } = await supabase
         .from('sectors')
         .delete()
         .eq('id', id);
 
       if (error) throw error;
       await fetchSectors();
       return { error: null };
     } catch (error) {
       console.error('Error deleting sector:', error);
       return { error };
     }
   };
 
   return {
     sectors,
     loading,
     createSector,
     updateSector,
     deleteSector,
     refetch: fetchSectors,
   };
 }