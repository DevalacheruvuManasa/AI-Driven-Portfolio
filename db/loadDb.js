import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";
import OpenAI from "openai";
import sampleData from "./sample-data.json" with { type: "json" };
console.log(process.env.OPENAI_API_KEY);  // This should print your OpenAI API key if loaded correctly


const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
});

const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
    namespace: process.env.ASTRA_DB_NAMESPACE
});

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});

const createCollection = async () => {
    try {
        await db.createCollection("portfolio", {
            vector: {
                dimension: 1536
            }
        });
    } catch (error) {
        console.log("Collection already exists");
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadData = async () => {
    try {
        const collection = await db.collection("portfolio");
        for await (const { id, info, description } of sampleData) {
            const chunks = await splitter.splitText(description);
            for await (const chunk of chunks) {
                const { data } = await openai.embeddings.create({
                    input: chunk,
                    model: "text-embedding-3-small"
                });

                await collection.insertOne({
                    document_id: id,
                    $vector: data[0]?.embedding,
                    info,
                    description: chunk
                });

                // Add delay between API calls
                await delay(500); // 500ms delay between requests
            }
        }
        console.log("Data added successfully");
    } catch (error) {
        console.error("Error while loading data:", error);
    }
};

createCollection().then(() => loadData());
