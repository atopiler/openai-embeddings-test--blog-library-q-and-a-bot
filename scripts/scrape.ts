import { PGChunk, PGEssay, PGJSON } from '@/types';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { prev } from 'cheerio/lib/api/traversing';
import { encode } from 'gpt-3-encoder';
import fs from 'fs';

const BASE_URL = "http://www.paulgraham.com";
const CHUNK_SIZE = 200;


const getLinks = async () => {
  const html = await axios.get(`${BASE_URL}/articles.html`);
  const $ = cheerio.load(html.data);

  const linkArr: { url: string; title: string }[] = [];

  const tables = $("table");

  tables.each((i, table) => {
    //list of articles is found in the 3rd table of the page DOM
    if (i === 2) {
      const links = $(table).find("a");

      links.each((i, link) => {
        const url = $(link).attr("href");
        const title = $(link).text();

        //make sure that all values exist and that what we extracted
        //is a valid links
        if (url && title && url.endsWith(".html") && title) {
          const linkObj = {
            url,
            title
          }

          linkArr.push(linkObj);

        }
      })
    }
  })

  return linkArr;
};

const getEssay = async (url: string, title: string) => {

  let essay: PGEssay = {
    title: "",
    url: "",
    date: "",
    content: "",
    tokens: 0,
    chunks: []
  };

  const html = await axios.get(`${BASE_URL}/${url}`);
  const $ = cheerio.load(html.data);

  const tables = $("table");

  tables.each((i, table) => {
    //main content is found in the 2nd table of the essay page DOM
    if (i === 1) {
      const text = $(table).text();

      //clean the main content text to remove any noise
      let cleanedText = text.replace(/\s+/g, " ")
        .replace(/\.([a-zA-Z])/g, ". $1");

      //find the date string  
      const split = cleanedText.match(/([A-Z][a-z]+ [0-9]{4})/);
      let dateStr = "";
      let textWithoutDate = "";

      //if we found the date, set values for date and the main content
      if (split) {
        dateStr = split[0];
        textWithoutDate = cleanedText.replace(dateStr, "");
      }

      //clean the essay text
      let essayText = textWithoutDate.replace(/\n/g, " ").trim();

      essay = {
        title,
        url: `${BASE_URL}/${url}`,
        date: dateStr,
        content: essayText,
        tokens: encode(essayText).length,
        chunks: []
      };
    }
  });

  return essay;
};


const getChunks = async (essay: PGEssay) => {
  //get data off of array
  const { title, url, date, content } = essay;

  let essayTextChunks: string[] = [];

  if (encode(content).length > CHUNK_SIZE) {
    const sentences = content.split(". ");
    let chunkText = "";

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokenLength = encode(sentence).length;
      const chunkTextTokenLength = encode(chunkText).length;

      //if we've reached over 200 tokens, store the chunk and 
      //start a new current chunk
      if (chunkTextTokenLength + sentenceTokenLength > CHUNK_SIZE) {
        essayTextChunks.push(chunkText.trim());
        chunkText = "";
      }

      //add the next sentence to the current chunk
      if (sentence[sentence.length - 1].match(/[a-z0-9]/i)) {
        chunkText += sentence + ". ";
      } else {
        chunkText += sentence + " ";
      }
    }

    essayTextChunks.push(chunkText.trim());
  } else {
    //if the entire content is less than 200 tokens, just store it all
    //as a single chunk.
    essayTextChunks.push(content.trim());
  }

  const essayChunks: PGChunk[] = essayTextChunks.map((chunkText, i) => {
    const chunk: PGChunk = {
      essay_title: title,
      essay_url: url,
      essay_date: date,
      content: chunkText,
      content_tokens: encode(chunkText).length,
      embedding: []
    };

    return chunk;
  });

  //make sure that the last chunk isn't just a small remaining piece
  //of text.  If last chunk is <100 tokens, then just append it to 
  //the previous chunk and remove the last chunk so we don't have any
  //small and less useful chunks
  if (essayChunks.length > 1) {
    for (let i = 0; i < essayChunks.length; i++) {
      const chunk = essayChunks[i];
      const prevChunk = essayChunks[i-1];

      if (chunk.content_tokens < 100 && prevChunk) {
        prevChunk.content += " " + chunk.content;
        prevChunk.content_tokens = encode(prevChunk.content).length;
        //remove last chunk from essayChunks
        essayChunks.splice(i, 1);
      }
    }
  }

  const chunkedEssay: PGEssay = {
    ...essay,
    chunks: essayChunks
  };

  return chunkedEssay;
};


(async () => {
  const links = await getLinks();

  let essays: PGEssay[] = [];

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const essay = await getEssay(link.url, link.title);
    const chunkedEssay = await getChunks(essay);

    essays.push(chunkedEssay);
  }

  //save as json
  const essaysJSON: PGJSON = {
    //goes through essays and adds up token count across all
    tokens: essays.reduce((acc, essay) => acc + essay.tokens, 0),
    essays
  };

  fs.writeFileSync("scripts/pg.json", JSON.stringify(essaysJSON));


})();