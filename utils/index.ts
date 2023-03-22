import {createClient} from "@supabase/supabase-js";
import {createParser, ParsedEvent, ReconnectInterval} from "eventsource-parser";


export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);
