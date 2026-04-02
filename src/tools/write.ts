import type { ToolDef } from "./index.js";
import { safePath } from "./utils.js";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const definition: ToolDef = {
    name: "write",
    description: "Create or overwrite a file within the current working directory.",
    input_schema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "The file path to write to (relative to your working directory)"
            },
            content: {
                type: "string",
                description: "The content to write to the file"
            }
        },
        required: ["path", "content"]
    },
};

function handler({ path: filePath, content }: { path: string; content: string }): string {
    if (!safePath(filePath)) {
        return `[BLOCKED] You don't have permission to access a path out of the current working directory.
Please double check your path input: ${filePath}.
Your current working directory is: ${process.cwd()}`;
    }

    const resolved = path.resolve(process.cwd(), filePath);

    try {
        mkdirSync(path.dirname(resolved), { recursive: true });
        writeFileSync(resolved, content, "utf-8");
    } catch (err: any) {
        return `[ERROR] Failed to write file: ${err.message}`;
    }

    const lineCount = content.split("\n").length;
    return `Successfully wrote to ${filePath} (${lineCount} lines)`;
}

export const writeTool = {
    definition,
    handler,
};
