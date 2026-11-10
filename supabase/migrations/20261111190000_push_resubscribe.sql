-- When the browser replaces a push subscription by itself (pushsubscriptionchange), the service worker swaps the
-- endpoint on the server, so notifications and calls keep arriving without opening the app. The old endpoint is the proof.
CREATE OR REPLACE FUNCTION public.push_resubscribe(_old text, _new text, _p256dh text, _auth text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.web_push_subscriptions SET endpoint = _new, p256dh = _p256dh, auth = _auth WHERE endpoint = _old AND _new LIKE 'https://%';
$$;
REVOKE ALL ON FUNCTION public.push_resubscribe(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.push_resubscribe(text, text, text, text) TO anon, authenticated;
