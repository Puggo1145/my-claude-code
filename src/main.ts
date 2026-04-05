import type { MessageParam, ToolUnion } from "@anthropic-ai/sdk/resources";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { toolProvider } from "./tools/index.js";

function getModel() {
    const MODEL = process.env.MODEL;
    if (!MODEL) {
        throw new Error("MODEL is not set");
    }
    return MODEL;
}

const SYSTEM_PROMPT = `You are a coding agent at ${process.cwd()}. 
Use the todo tool to plan for multi-step tasks at the first
Prefer tool over prose.`;
const TOOLS: ToolUnion[] = toolProvider.getToolDefinitions();

import { createInterface } from "node:readline/promises";
import { agentLoop } from "./agents/agent-loop.js";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const model = getModel();

async function main() {
    const messages: MessageParam[] = [];
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    while (true) {
        const query = await rl.question("Input: ");
        if (query.trim().toLowerCase() === "q") {
            rl.close();
            break;
        }
        messages.push({ role: "user", content: query });
        await agentLoop(messages, client, model, SYSTEM_PROMPT, TOOLS);
        const responseContent = messages[messages.length - 1]?.content;
        if (Array.isArray(responseContent)) {
            for (const block of responseContent) {
                if (block.type === "text") {
                    console.log(block.text);
                }
            }
        }
    }
}

main();
