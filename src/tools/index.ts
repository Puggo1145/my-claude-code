import type { Tool as AnthropicToolDef } from "@anthropic-ai/sdk/resources";
import { bashTool } from "./bash.js";
import { readTool } from "./read.js";
import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { todoTool } from "./todo.js";

export type ToolName = string;
export type ToolDef = AnthropicToolDef;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (input: any) => string;

interface Tool {
    definition: ToolDef;
    handler: ToolHandler
}

class ToolProvider {
    private tools: Record<ToolName, Tool>;

    constructor() {
        this.tools = {};
    }

    register(
        toolName: ToolName,
        tool: Tool
    ) {
        this.tools[toolName] = tool;
    }

    getToolHandler(toolName: string): ToolHandler | null {
        if (!(toolName in this.tools)) return null;

        // return tool handler
        return this.tools[toolName]!.handler;
    }

    getToolDefinitions(): Array<Tool["definition"]> {
        return Object.values(this.tools).map(tool => tool.definition);
    }

    listAllToolNames(): string {
        return Object.keys(this.tools).join(", ");
    }
}

const toolProvider = new ToolProvider();
toolProvider.register("bash", bashTool);
toolProvider.register("read", readTool);
toolProvider.register("write", writeTool);
toolProvider.register("edit", editTool);
toolProvider.register("todo", todoTool);

export { toolProvider };
