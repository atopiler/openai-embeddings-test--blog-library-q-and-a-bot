import { PGChunk } from '@/types';
import endent from 'endent';
import Head from 'next/head'
import Image from 'next/image'
import { useState } from 'react';
import {Answer} from './../components/Answer/Answer';

export default function Home() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [chunks, setChunks] = useState<PGChunk[]>([]);
  const [loading, setLoading] = useState(false);


  const handleAnswer = async () => {

    setLoading(true);

    console.log(query);

    const searchResponse = await fetch('/api/search', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({query})
    });

    if (!searchResponse.ok) {
      return;
    }

    const results: PGChunk[] = await searchResponse.json();
    setChunks(results);
    console.log(results);

    //write the GPT prompt to send
    const prompt = endent`
    Use the following passages to answer the query: ${query}

    ${results.map((chunk) => chunk.content).join("\n")}
    ` 

    console.log(prompt);

    //request an answer from GPT based on the prompt
    const answerResponse = await fetch("/api/answer", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({prompt})
    });

    if (!answerResponse.ok) {
      setLoading(false);
      return;
    }

    const data = answerResponse.body;

    if (!data) {
      setLoading(false);
      return;
    }

    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const {value, done: doneReading} = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setAnswer((prev) => prev + chunkValue);
    }

    setLoading(false);
  }

  return (
    <>
      <Head>
        <title>Paul Graham GPT</title>
        <meta name="description" content="AI Q&A on PG's Essays" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex flex-col w-[350px]">
        <input 
          className="border text-black border-gray-300 rounded-md p-2"
          type="text"
          placeholder="Ask a question"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="bg-blue-500 hover:bg-blue-700 font-bold text-white py-2 px-4 rounded"
          onClick={handleAnswer}
          >
            Submit
        </button>

        <div className="mt-4">
          {
            loading
            ? <div>Loading...</div>
            : <Answer text={answer} />
          }
        </div>

        
      </div>
    </>
  );
}
