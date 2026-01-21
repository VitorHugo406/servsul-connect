-- Create table to store facial descriptors for users
CREATE TABLE public.user_facial_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  profile_id UUID NOT NULL UNIQUE,
  facial_descriptors JSONB NOT NULL, -- Array of 128-dimensional face descriptors
  face_image_url TEXT, -- Optional reference image
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  registered_by UUID NOT NULL -- Who registered this face
);

-- Enable RLS
ALTER TABLE public.user_facial_data ENABLE ROW LEVEL SECURITY;

-- Users can view their own facial data
CREATE POLICY "Users can view their own facial data"
ON public.user_facial_data
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all facial data
CREATE POLICY "Admins can view all facial data"
ON public.user_facial_data
FOR SELECT
USING (is_admin());

-- Admins can insert facial data for anyone
CREATE POLICY "Admins can insert facial data"
ON public.user_facial_data
FOR INSERT
WITH CHECK (is_admin());

-- Users can insert their own facial data
CREATE POLICY "Users can insert their own facial data"
ON public.user_facial_data
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admins can update any facial data
CREATE POLICY "Admins can update any facial data"
ON public.user_facial_data
FOR UPDATE
USING (is_admin());

-- Users can update their own facial data
CREATE POLICY "Users can update their own facial data"
ON public.user_facial_data
FOR UPDATE
USING (user_id = auth.uid());

-- Admins can delete any facial data
CREATE POLICY "Admins can delete any facial data"
ON public.user_facial_data
FOR DELETE
USING (is_admin());

-- Users can delete their own facial data
CREATE POLICY "Users can delete their own facial data"
ON public.user_facial_data
FOR DELETE
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_facial_data_updated_at
BEFORE UPDATE ON public.user_facial_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for face images (optional reference images)
INSERT INTO storage.buckets (id, name, public) VALUES ('face-images', 'face-images', false);

-- Storage policies for face images
CREATE POLICY "Users can upload their own face images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'face-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own face images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'face-images' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin()));

CREATE POLICY "Admins can manage all face images"
ON storage.objects
FOR ALL
USING (bucket_id = 'face-images' AND is_admin());