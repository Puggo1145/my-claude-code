import type { MessageParam, ToolUnion } from "@anthropic-ai/sdk/resources";
import type Anthropic from "@anthropic-ai/sdk";
import { toolProvider } from "../tools/index.js";
import { print } from "../utils/print.js";

export async function agentLoop(messages: MessageParam[], client: Anthropic, model: string, systemPrompt: string, tools: ToolUnion[]): Promise<void> {
    while (true) {
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
                    try {
                        output = toolHandler(block.input);
                        print(`result: ${output}`, "tool");
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
            }
        }
        messages.push({ role: "user", content: results });
    }
}
