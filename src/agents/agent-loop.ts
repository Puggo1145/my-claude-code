import type { MessageParam, ToolUnion } from "@anthropic-ai/sdk/resources";
import type Anthropic from "@anthropic-ai/sdk";
import { toolProvider } from "../tools/index.js";
import { print, cutContent } from "../utils/print.js";

export async function agentLoop(messages: MessageParam[], client: Anthropic, model: string, systemPrompt: string, tools: ToolUnion[]): Promise<void> {
    let roundsSinceTodo = 0
    while (true) {
        let usedTodo = false;

        const response = await client.messages.create({
            model: model,
            system: systemPrompt,
            messages: messages,
            tools: tools,
            max_tokens: 8000
        });

        messages.push({ role: "assistant", content: response.content });

        if (response.stop_reason !== "tool_use") break;

        // run tools
        const results: MessageParam["content"] = [];
        for (const block of response.content) {
            if (block.type === "text") {
                print(block.text, "message");
            }

            if (block.type === "tool_use") {
                let output: string;

                const toolHandler = toolProvider.getToolHandler(block.name);
                if (!toolHandler) {
                    output = `[ERROR] Tool "${block.name}" does not exist. Available tools: ${toolProvider.listAllToolNames()}`;
                    print(output, "error");
                } else {
                    // execute tool
                    print(`running tool: ${block.name}`, "tool");
                    print(cutContent(JSON.stringify(block.input)), "tool");
                    try {
                        output = toolHandler(block.input);
                        print(`result:\n${cutContent(output)}`, "tool");
                    } catch (error) {
                        if (error instanceof Error && error.stack) {
                            output = `[ERROR] ${error.stack}`;
                        } else {
                            output = `[ERROR] ${block.name}: ${String(error)}`;
                        }
                        print(output, "error");
                    }
                }

                // build results
                results.push({
                    type: "tool_result",
                    // tool use id 必须和模型返回的 tool call block 一致
                    // 直接透传即可
                    tool_use_id: block.id,
                    content: output
                })

                if (block.name === "todo") {
                    usedTodo = true;
                }
            }
        }

        if (usedTodo) {
            roundsSinceTodo = 0;
        } else {
            roundsSinceTodo++;
        }

        messages.push({ role: "user", content: results });
        // remind agent to update todos if it hasn't used the tool in 3 rounds
        if (roundsSinceTodo >= 3) {
            messages.push({ role: "user", content: "<reminder>Update your todos.</reminder>" });
        }
    }
}


