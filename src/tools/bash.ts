import type { ToolDef } from "./index.js";
import { execSync } from "node:child_process";

const definition: ToolDef = {
    name: "bash",
    description: "Execute a bash command and return stdout/stderr. Dangerous commands (rm -rf, sudo, shutdown, reboot, mkfs, dd, etc.) are blocked.",
    input_schema: {
        type: "object",
        properties: {
            command: {
                type: "string",
                description: "The bash command to execute"
            },
            timeout: {
                type: "number",
                description: "Timeout in milliseconds (default: 10000)"
            }
        },
        required: ["command"]
    },
};


function handler({ command, timeout = 10000 }: { command: string; timeout?: number }): string {
    const DANGEROUS_PATTERNS = [
        /\brm\s+(-[^\s]*)?r/,       // rm -r, rm -rf, rm -fr, etc.
        /\bsudo\b/,
        /\bshutdown\b/,
        /\breboot\b/,
        /\bmkfs\b/,
        /\bdd\b/,
        /\b:(){ :|:& };:/,          // fork bomb
        />\s*\/dev\/sd/,            // overwrite disk
        /\bchmod\s+777\b/,
        /\bchown\s+-R\b/,
        /\bkill\s+-9\s+1\b/,
        /\binit\s+0\b/,
        /\bsystemctl\s+(poweroff|halt)\b/,
    ];
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
            throw new Error(`Dangerous command detected: "${command}"`);
        }
    }

    try {
        const result = execSync(command, {
            timeout,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"],
            maxBuffer: 1024 * 1024,
        });
        return result || "(no output)";
    } catch (err: any) {
        if (err.killed) {
            throw new Error(`Command timed out after ${timeout}ms`);
        }
        const stderr = err.stderr || "";
        const stdout = err.stdout || "";
        throw new Error(`Exit code ${err.status}\n${stdout}\n${stderr}`.trim());
    }
}

export const bashTool = {
    definition,
    handler
};
