DO $$
DECLARE uid uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email='vitor.santospess@gmail.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
    VALUES ('00000000-0000-0000-0000-000000000000',uid,'authenticated','authenticated','vitor.santospess@gmail.com',extensions.crypt('Hugo4062006*',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"name":"Super Admin","display_name":"Super Admin","company_id":"00000000-0000-0000-0000-0000000000a1"}',now(),now(),'','','','');
    INSERT INTO auth.identities (id,user_id,provider_id,identity_data,provider,created_at,updated_at,last_sign_in_at)
    VALUES (gen_random_uuid(),uid,uid::text,jsonb_build_object('sub',uid::text,'email','vitor.santospess@gmail.com','email_verified',true),'email',now(),now(),now());
  END IF;
  SELECT id INTO uid FROM auth.users WHERE email='vitor.santospess@gmail.com';
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=uid) THEN
    INSERT INTO public.profiles (user_id,name,display_name,email,company_id) VALUES (uid,'Super Admin','Super Admin','vitor.santospess@gmail.com','00000000-0000-0000-0000-0000000000a1');
  END IF;
  UPDATE public.profiles SET company_id='00000000-0000-0000-0000-0000000000a1', autonomy_level='admin', is_active=true WHERE user_id=uid;
  INSERT INTO public.user_roles (user_id,role) VALUES (uid,'super_admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id,role) VALUES (uid,'admin') ON CONFLICT DO NOTHING;
END $$;