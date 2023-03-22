import { PGEssay, PGJSON } from "@/types";
import { loadEnvConfig } from "@next/env";
import fs from "fs";
import { Configuration, OpenAIApi} from "openai";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig("");

const generateEmbeddings = async (essays: PGEssay[]) => {
    const configuration = new Configuration({apiKey: process.env.OPENAI_API_KEY});
    const openai = new OpenAIApi(configuration);

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (let i = 0; i < essays.length; i++) {
        const essay = essays[i];

        if (i > 88) {
            for (let j = 0; j < essay.chunks.length; j++) {
                const chunk = essay.chunks[j];

                if ((i == 89 && j > 6) || i >89) {
                    //create embedding from chunk
                    const embeddingResponse = await openai.createEmbedding({
                        model: 'text-embedding-ada-002',
                        input: chunk.content
                    });

                    //destructure data into embedding object
                    const [{embedding}] = embeddingResponse.data.data;

                    //upload embedding to DB
                    const {data, error} = await supabase
                        .from('paul_graham_essays')
                        .insert({
                            essay_title: chunk.essay_title,
                            essay_url: chunk.essay_url,
                            essay_date: chunk.essay_url,
                            content: chunk.content,
                            content_tokens: chunk.content_tokens,
                            embedding
                        })
                        .select("*");

                        if (error) {
                            console.log('error', i, j);
                        } else {
                            console.log('saved', i, j);
                            console.log(essay.title);
                        }

                        //add delay to avoid any potential rate limit issues
                        await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
        }
    }
}


console.log('yo');


(async() => {
    console.log('hellow');
    const json: PGJSON = JSON.parse(fs.readFileSync('scripts/pg.json', 'utf8'));

    console.log('hi');
    await generateEmbeddings(json.essays);
})();