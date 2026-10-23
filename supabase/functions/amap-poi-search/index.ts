/* global Deno */
import { createPoiSearchHandler } from './handler.ts';

Deno.serve(createPoiSearchHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  supabaseKey: Deno.env.get('SUPABASE_ANON_KEY'),
  amapKey: Deno.env.get('AMAP_WEB_SERVICE_KEY'),
}));
