 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 
 export interface Task {
   id: string;
   task_number: number;
   title: string;
   description: string | null;
   status: 'todo' | 'in_progress' | 'review' | 'done';
   priority: 'low' | 'medium' | 'high' | 'urgent';
   assigned_to: string | null;
   created_by: string;
   sector_id: string | null;
   due_date: string | null;
   position: number;
   created_at: string;
   updated_at: string;
   assignee?: {
     id: string;
     name: string;
     display_name: string | null;
     avatar_url: string | null;
   };
 }
 
 export interface TaskComment {
   id: string;
   task_id: string;
   author_id: string;
   content: string;
   created_at: string;
   author?: {
     id: string;
     name: string;
     display_name: string | null;
     avatar_url: string | null;
   };
 }
 
 export function useTasks() {
   const { profile } = useAuth();
   const [tasks, setTasks] = useState<Task[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchTasks = useCallback(async () => {
     try {
       const { data, error } = await supabase
         .from('tasks')
         .select(`
           *,
           assignee:profiles!tasks_assigned_to_fkey(id, name, display_name, avatar_url)
         `)
         .order('position', { ascending: true });
 
       if (error) throw error;
       setTasks((data || []) as Task[]);
     } catch (error) {
       console.error('Error fetching tasks:', error);
     } finally {
       setLoading(false);
     }
   }, []);
 
   useEffect(() => {
     fetchTasks();
 
     const channel = supabase
       .channel('tasks-changes')
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'tasks' },
         () => fetchTasks()
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [fetchTasks]);
 
   const createTask = async (task: {
     title: string;
     description?: string;
     status?: string;
     priority?: string;
     assigned_to?: string;
     sector_id?: string;
     due_date?: string;
   }) => {
     if (!profile) return { error: new Error('Not authenticated') };
 
     try {
       const { data, error } = await supabase
         .from('tasks')
         .insert({
           ...task,
           created_by: profile.id,
           status: task.status || 'todo',
           priority: task.priority || 'medium',
         })
         .select()
         .single();
 
       if (error) throw error;
       return { data, error: null };
     } catch (error) {
       console.error('Error creating task:', error);
       return { data: null, error };
     }
   };
 
   const updateTask = async (id: string, updates: Partial<Task>) => {
     try {
       const { error } = await supabase
         .from('tasks')
         .update(updates)
         .eq('id', id);
 
       if (error) throw error;
       return { error: null };
     } catch (error) {
       console.error('Error updating task:', error);
       return { error };
     }
   };
 
   const deleteTask = async (id: string) => {
     try {
       const { error } = await supabase
         .from('tasks')
         .delete()
         .eq('id', id);
 
       if (error) throw error;
       return { error: null };
     } catch (error) {
       console.error('Error deleting task:', error);
       return { error };
     }
   };
 
   const moveTask = async (taskId: string, newStatus: string, newPosition: number) => {
     try {
       const { error } = await supabase
         .from('tasks')
         .update({ status: newStatus, position: newPosition })
         .eq('id', taskId);
 
       if (error) throw error;
       
       setTasks(prev => prev.map(t => 
         t.id === taskId ? { ...t, status: newStatus as Task['status'], position: newPosition } : t
       ));
       
       return { error: null };
     } catch (error) {
       console.error('Error moving task:', error);
       return { error };
     }
   };
 
   return {
     tasks,
     loading,
     createTask,
     updateTask,
     deleteTask,
     moveTask,
     refetch: fetchTasks,
   };
 }
 
 export function useTaskComments(taskId: string | null) {
   const { profile } = useAuth();
   const [comments, setComments] = useState<TaskComment[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchComments = useCallback(async () => {
     if (!taskId) {
       setLoading(false);
       return;
     }
 
     try {
       const { data, error } = await supabase
         .from('task_comments')
         .select(`
           *,
           author:profiles(id, name, display_name, avatar_url)
         `)
         .eq('task_id', taskId)
         .order('created_at', { ascending: true });
 
       if (error) throw error;
       setComments((data || []) as TaskComment[]);
     } catch (error) {
       console.error('Error fetching comments:', error);
     } finally {
       setLoading(false);
     }
   }, [taskId]);
 
   useEffect(() => {
     fetchComments();
   }, [fetchComments]);
 
   const addComment = async (content: string) => {
     if (!taskId || !profile) return { error: new Error('Not authenticated') };
 
     try {
       const { error } = await supabase
         .from('task_comments')
         .insert({
           task_id: taskId,
           author_id: profile.id,
           content,
         });
 
       if (error) throw error;
       await fetchComments();
       return { error: null };
     } catch (error) {
       console.error('Error adding comment:', error);
       return { error };
     }
   };
 
   return {
     comments,
     loading,
     addComment,
     refetch: fetchComments,
   };
 }