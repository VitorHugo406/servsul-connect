import { useState, useEffect, useCallback } from 'react';
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

const ADMIN_EMAIL = 'adminservchat@servsul.com.br';

interface UploadResult {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const [weeklyLimit, setWeeklyLimit] = useState(5);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const { user, profile, isAdmin } = useAuth();

  // Admin principal is exempt from limits
  const isMainAdmin = isAdmin && profile?.email === ADMIN_EMAIL;

  const getStartOfWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const checkWeeklyStatus = useCallback(async () => {
    if (!user || !profile) return;
    // Admin principal is exempt
    if (isMainAdmin) {
      setLimitReached(false);
      return;
    }

    try {
      // Get weekly limit using service-accessible query
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'weekly_file_limit')
        .maybeSingle();
      
      const limit = data?.value ? parseInt(data.value) || 5 : 5;
      setWeeklyLimit(limit);

      // Get current week count
      const startOfWeek = getStartOfWeek();
      const { count, error } = await supabase
        .from('attachments')
        .select('*', { count: 'exact', head: true })
        .eq('uploaded_by', profile.id)
        .gte('created_at', startOfWeek.toISOString());

      if (!error) {
        const currentCount = count || 0;
        setWeeklyCount(currentCount);
        setLimitReached(currentCount >= limit);
      }
    } catch {
      // ignore - use defaults
    }
  }, [user, profile, isMainAdmin]);

  useEffect(() => {
    checkWeeklyStatus();
  }, [checkWeeklyStatus]);

  const uploadFile = async (
    file: File,
    bucket: 'attachments' | 'avatars' = 'attachments'
  ): Promise<UploadResult | null> => {
    if (!user || !profile) {
      toast.error('Você precisa estar logado para fazer upload');
      return null;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('O arquivo é muito grande. O tamanho máximo é 2MB.');
      return null;
    }

    // Check weekly upload limit (skip for admin principal)
    if (bucket === 'attachments' && !isMainAdmin) {
      if (limitReached) {
        toast.error(`Limite semanal de ${weeklyLimit} arquivos atingido. Tente novamente na próxima semana.`);
        return null;
      }
      // Double-check from DB
      const startOfWeek = getStartOfWeek();
      const { count } = await supabase
        .from('attachments')
        .select('*', { count: 'exact', head: true })
        .eq('uploaded_by', profile.id)
        .gte('created_at', startOfWeek.toISOString());

      if ((count || 0) >= weeklyLimit) {
        setLimitReached(true);
        toast.error(`Limite semanal de ${weeklyLimit} arquivos atingido. Tente novamente na próxima semana.`);
        return null;
      }
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido.');
      return null;
    }

    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

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

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setProgress(100);

      // Refresh weekly status after successful upload
      if (bucket === 'attachments' && !isMainAdmin) {
        const newCount = weeklyCount + 1;
        setWeeklyCount(newCount);
        if (newCount >= weeklyLimit) {
          setLimitReached(true);
        }
      }

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

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Apenas imagens são permitidas para o avatar.');
      return null;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem é muito grande. O tamanho máximo é 2MB.');
      return null;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      await supabase.storage.from('avatars').remove([fileName]);

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

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      // Profiles are linked to Supabase Auth through `profiles.user_id`.
      // The version query also invalidates cached avatar URLs after replacements.
      const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id)
        .select('avatar_url')
        .maybeSingle();

      if (!updateError && !updatedProfile) {
        toast.error('Não foi possível localizar seu perfil para salvar a foto');
        return null;
      }

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error('Erro ao atualizar perfil');
        return null;
      }

      toast.success('Avatar atualizado com sucesso!');
      return avatarUrl;
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
    limitReached,
    weeklyLimit,
    weeklyCount,
    isMainAdmin,
  };
}
