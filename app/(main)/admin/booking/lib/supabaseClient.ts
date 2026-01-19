
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (supabaseUrl.includes('placeholder')) {
    console.warn('WARNING: Supabase URL is missing or using placeholder!');
}
console.log('Supabase initialized with key prefix:', supabaseKey.substring(0, 10) + '...');
if (supabaseKey !== 'placeholder-key' && !supabaseKey.startsWith('eyJ') && !supabaseKey.startsWith('sb_publishable_')) {
    console.warn('WARNING: Your Supabase Anon Key format looks unusual. Please ensure it is the "anon / public" key.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
