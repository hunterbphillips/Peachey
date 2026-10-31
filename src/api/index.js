import { makeSupabaseApi } from './supabaseApi.js';
import { makeDemoApi } from './demoApi.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const forceDemo = import.meta.env.VITE_FORCE_DEMO === '1' ||
  new URLSearchParams(window.location.search).has('demo');

// With no Supabase keys configured, Peachey runs as a demo with sample friends.
export const api = !forceDemo && url && key ? makeSupabaseApi(url, key) : makeDemoApi();
