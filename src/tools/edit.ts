import type { ToolDef } from "./index.js";
import { safePath } from "./utils.js";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const definition: ToolDef = {
    name: "edit",
    description: "Edit a file by replacing exact text matches. The old_text must match exactly once in the file.",
    input_schema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "The file path to edit (relative to your working directory)"
            },
            old_text: {
                type: "string",
                description: "The exact text to find and replace (must match exactly once)"
            },
            new_text: {
                type: "string",
                description: "The text to replace old_text with"
            }
        },
        required: ["path", "old_text", "new_text"]
    },
};

function handler({ path: filePath, old_text: oldText, new_text: newText }: { path: string; old_text: string; new_text: string }): string {
    if (!safePath(filePath)) {
        return `[BLOCKED] You don't have permission to access a path out of the current working directory.
Please double check your path input: ${filePath}.
Your current working directory is: ${process.cwd()}`;
    }

    const resolved = path.resolve(process.cwd(), filePath);

    let content: string;
    try {
        content = readFileSync(resolved, "utf-8");
    } catch (err: any) {
        return `[ERROR] Failed to read file: ${err.message}`;
    }

    const occurrences = content.split(oldText).length - 1;

    if (occurrences === 0) {
        return `[ERROR] old_text not found in ${filePath}. Make sure it matches exactly (including whitespace and indentation).`;
    }
    if (occurrences > 1) {
        return `[ERROR] old_text matches ${occurrences} times in ${filePath}. It must match exactly once. Provide more surrounding context to make it unique.`;
    }

    const updated = content.replace(oldText, newText);

    try {
        writeFileSync(resolved, updated, "utf-8");
    } catch (err: any) {
        return `[ERROR] Failed to write file: ${err.message}`;
    }

    const lineCount = updated.split("\n").length;
    return `Successfully edited ${filePath} (${lineCount} lines)`;
}

export const editTool = {
    definition,
    handler,
};
