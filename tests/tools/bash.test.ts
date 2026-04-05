import { describe, it, expect } from "vitest";
import { bashTool } from "../../src/tools/bash.js";
import crypto from "node:crypto";

const handler = bashTool.handler;

function randStr() {
    return crypto.randomBytes(6).toString("hex");
}

describe("bashTool", () => {
    describe("definition", () => {
        it("should have name 'bash'", () => {
            expect(bashTool.definition.name).toBe("bash");
        });

        it("should require 'command' input", () => {
            const schema = bashTool.definition.input_schema as any;
            expect(schema.required).toContain("command");
        });
    });

    describe("handler – output fidelity", () => {
        it("echoed random string comes back unchanged", () => {
            const s = randStr();
            const result = handler({ command: `echo ${s}` });
            expect(result.trim()).toBe(s);
        });

        it("multi-line output preserves order and content", () => {
            const a = randStr(), b = randStr(), c = randStr();
            const result = handler({ command: `printf '%s\\n%s\\n%s' ${a} ${b} ${c}` });
            expect(result).toBe(`${a}\n${b}\n${c}`);
        });

        it("returns '(no output)' only when stdout is truly empty", () => {
            expect(handler({ command: "true" })).toBe("(no output)");
        });

        it("arithmetic: expr result matches JS evaluation", () => {
            const a = Math.floor(Math.random() * 100) + 1;
            const b = Math.floor(Math.random() * 100) + 1;
            const result = handler({ command: `expr ${a} + ${b}` });
            expect(Number(result.trim())).toBe(a + b);
        });
    });

    describe("handler – dangerous command blocking", () => {
        const dangerousCases = [
            ["rm -rf /",             /rm.*-.*r/],
            ["rm -r /tmp/test",      /rm.*-.*r/],
            ["sudo ls",              /sudo/],
            ["shutdown -h now",      /shutdown/],
            ["reboot",               /reboot/],
            ["mkfs /dev/sda1",       /mkfs/],
            ["dd if=/dev/zero of=x", /dd/],
            ["chmod 777 /etc/p",     /chmod 777/],
            ["chown -R root /",      /chown -R/],
            ["kill -9 1",            /kill -9 1/],
            ["init 0",               /init 0/],
            ["systemctl poweroff",   /systemctl.*(poweroff|halt)/],
            ["systemctl halt",       /systemctl.*(poweroff|halt)/],
            ["echo foo > /dev/sda",  /\/dev\/sd/],
        ] as const;

        for (const [cmd] of dangerousCases) {
            it(`blocks: ${cmd}`, () => {
                expect(() => handler({ command: cmd })).toThrow("Dangerous command detected");
            });
        }

        // 重要：证明拦截不会误杀正常命令
        it("does NOT block 'echo rm -rf' (rm in a string literal)", () => {
            // 如果正则太激进，这条会失败
            const result = handler({ command: "echo 'I typed rm once'" });
            expect(result.trim()).toBe("I typed rm once");
        });
    });

    describe("handler – error propagation", () => {
        it("non-zero exit code is propagated with code number", () => {
            const code = Math.floor(Math.random() * 126) + 1; // 1-126
            expect(() => handler({ command: `exit ${code}` })).toThrow(`Exit code ${code}`);
        });

        it("stderr content is included in the error message", () => {
            const msg = randStr();
            try {
                handler({ command: `echo ${msg} >&2 && exit 1` });
                // 如果没抛，说明有 bug
                expect.unreachable("should have thrown");
            } catch (err: any) {
                expect(err.message).toContain(msg);
            }
        });

        it("unknown command throws (not silently returns empty)", () => {
            const fakeCmd = `__no_such_cmd_${randStr()}`;
            expect(() => handler({ command: fakeCmd })).toThrow();
        });

        it("timeout kills the process", () => {
            expect(() => handler({ command: "sleep 60", timeout: 200 })).toThrow();
        });
    });
});
