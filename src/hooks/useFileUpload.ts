import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/plain',
];

interface UploadResult {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user, profile } = useAuth();

  const checkWeeklyLimit = async (): Promise<boolean> => {
    if (!user) return false;
    
    // Calculate start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('attachments')
      .select('*', { count: 'exact', head: true })
      .eq('uploaded_by', profile?.id || '')
      .gte('created_at', startOfWeek.toISOString());

    if (error) {
      console.error('Error checking weekly limit:', error);
      return true; // Allow on error
    }

    return (count || 0) < 5;
  };

  const uploadFile = async (
    file: File,
    bucket: 'attachments' | 'avatars' = 'attachments'
  ): Promise<UploadResult | null> => {
    if (!user || !profile) {
      toast.error('Você precisa estar logado para fazer upload');
      return null;
    }

    // Validate file size (max 2MB)
    if (file.size > MAX_FILE_SIZE) {
      toast.error('O arquivo é muito grande. O tamanho máximo é 2MB.');
      return null;
    }

    // Check weekly upload limit (5 files per week)
    if (bucket === 'attachments') {
      const withinLimit = await checkWeeklyLimit();
      if (!withinLimit) {
        toast.error('Limite semanal de 5 arquivos atingido. Tente novamente na próxima semana.');
        return null;
      }
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido.');
      return null;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload do arquivo');
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setProgress(100);

      return {
        url: urlData.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) {
      toast.error('Você precisa estar logado para fazer upload');
      return null;
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Apenas imagens são permitidas para o avatar.');
      return null;
    }

    // Validate file size (max 2MB for avatars)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem é muito grande. O tamanho máximo é 2MB.');
      return null;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete existing avatar first
      await supabase.storage.from('avatars').remove([fileName]);

      // Upload new avatar
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Avatar upload error:', error);
        toast.error('Erro ao fazer upload do avatar');
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error('Erro ao atualizar perfil');
        return null;
      }

      toast.success('Avatar atualizado com sucesso!');
      return urlData.publicUrl;
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Erro ao fazer upload do avatar');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const isImage = (fileType: string) => ALLOWED_IMAGE_TYPES.includes(fileType);

  return {
    uploadFile,
    uploadAvatar,
    uploading,
    progress,
    isImage,
  };
}
