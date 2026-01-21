import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all facial data with profile info
    const { data: facialData, error: facialError } = await supabase
      .from('user_facial_data')
      .select(`
        user_id,
        profile_id,
        facial_descriptors
      `);

    if (facialError) {
      console.error('Error fetching facial data:', facialError);
      throw new Error('Erro ao buscar dados faciais');
    }

    // Get profile info for each user
    const faces = [];
    for (const face of facialData || []) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', face.profile_id)
        .single();

      if (profile) {
        // Get the first descriptor from the array
        const descriptors = face.facial_descriptors as number[][];
        if (descriptors && descriptors.length > 0) {
          faces.push({
            userId: face.user_id,
            profileId: face.profile_id,
            email: profile.email,
            name: profile.name,
            descriptor: descriptors[0], // Use first descriptor
          });
        }
      }
    }

    console.log(`Found ${faces.length} registered faces`);

    return new Response(
      JSON.stringify({ faces }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in get-facial-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
