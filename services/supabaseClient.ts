import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxpgqszphxhqbsxdodkn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q5QRo3M03XETwkbyU4E5Cw_AR9J1ODG';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);