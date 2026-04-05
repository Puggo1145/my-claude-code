import type { ToolDef } from "./index.js";
import { safePath } from "./utils.js";
import { readFileSync } from "node:fs";
import path from "node:path";

const definition: ToolDef = {
    name: "read",
    description: "Read a file's content within the current working directory.",
    input_schema: {
        type: "object",
        properties: {
            path: {
                type: "string",
                description: "The file path to read (relative to your working directory)"
            },
            from: {
                type: "number",
                description: "Start line number (0-based, inclusive). Defaults to 0."
            },
            to: {
                type: "number",
                description: "End line number (0-based, inclusive). Defaults to the last line."
            }
        },
        required: ["path"]
    },
};

function handler({ path: filePath, from, to }: { path: string; from?: number; to?: number }): string {
    if (!safePath(filePath)) {
        throw new Error(`You don't have permission to access a path out of the current working directory.
Please double check your path input: ${filePath}.
Your current working directory is: ${process.cwd()}`);
    }

    const resolved = path.resolve(process.cwd(), filePath);

    let content: string;
    try {
        content = readFileSync(resolved, "utf-8");
    } catch (err: any) {
        throw new Error(`Failed to read file: ${err.message}`);
    }

    const lines = content.split("\n");
    const totalLines = lines.length;

    // 模型默认最多读取1000行
    const MAX_LINES = 1000;
    const start = from ?? 0;
    const end = to ?? Math.min(start + MAX_LINES - 1, totalLines - 1);

    if (start < 0) {
        throw new Error(`"from" must not be less than 0 (got ${start})`);
    }
    if (end >= totalLines) {
        throw new Error(`"to" must not exceed max line index ${totalLines - 1} (got ${end})`);
    }
    if (start > end) {
        throw new Error(`"from" (${start}) must not be greater than "to" (${end})`);
    }

    const selected = lines.slice(start, end + 1);
    const numbered = selected.map((line, i) => `${start + i + 1} | ${line}`);

    // 提示还有多少行没有读取
    const remaining = totalLines - 1 - end;
    const suffix = to === undefined && remaining > 0
        ? `\n... ${remaining} more lines`
        : "";

    return `File: ${filePath} (${totalLines} lines)
${numbered.join("\n")}${suffix}`;
}

export const readTool = {
    definition,
    handler,
};
