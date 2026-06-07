import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { error } = await db
        .from('seniors')
        .update({ phone: '+919255435752' })
        .eq('id', '06e1b56d-b762-4341-aee6-7d4902e5d1a8');

    if (error) {
        console.log('❌ Error:', error.message);
    } else {
        console.log('✅ Maggie phone number updated!');
    }
}

run();