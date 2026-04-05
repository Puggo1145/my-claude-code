import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeTool } from "../../src/tools/write.js";
import * as fs from "node:fs";
import * as utils from "../../src/tools/utils.js";
import crypto from "node:crypto";

vi.mock("node:fs");
vi.mock("../../src/tools/utils.js");

const handler = writeTool.handler;

function randStr() {
    return crypto.randomBytes(6).toString("hex");
}

describe("writeTool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(utils.safePath).mockReturnValue(true);
        vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        vi.spyOn(process, "cwd").mockReturnValue("/home/user/project");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("definition", () => {
        it("should have name 'write' and require path + content", () => {
            expect(writeTool.definition.name).toBe("write");
            const req = (writeTool.definition.input_schema as any).required;
            expect(req).toContain("path");
            expect(req).toContain("content");
        });
    });

    describe("content is written verbatim", () => {
        it("the exact content string is passed to writeFileSync", () => {
            const content = `${randStr()}\n${randStr()}\nspecial chars: \t"'<>&`;
            handler({ path: "out.txt", content });

            const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0]![1];
            expect(writtenContent).toBe(content);
        });
    });

    describe("line count in response", () => {
        it("reports correct line count for random N-line content", () => {
            const n = Math.floor(Math.random() * 50) + 1;
            const content = Array.from({ length: n }, () => randStr()).join("\n");

            const result = handler({ path: "f.txt", content });

            expect(result).toContain(`${n} lines`);
        });

        it("single line (no newline) reports 1", () => {
            const result = handler({ path: "f.txt", content: randStr() });
            expect(result).toContain("1 lines");
        });
    });

    describe("parent directory creation", () => {
        it("mkdirSync is called with recursive: true", () => {
            const p = `${randStr()}/${randStr()}/file.txt`;
            handler({ path: p, content: "x" });

            expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
        });
    });

    describe("error propagation", () => {
        it("rejects unsafe path before any I/O", () => {
            vi.mocked(utils.safePath).mockReturnValue(false);

            expect(() => handler({ path: `../${randStr()}`, content: "x" })).toThrow("permission");
            // 关键：确认没有调用写操作
            expect(fs.mkdirSync).not.toHaveBeenCalled();
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it("writeFileSync failure is wrapped in user-facing message", () => {
            const origMsg = randStr();
            vi.mocked(fs.writeFileSync).mockImplementation(() => { throw new Error(origMsg); });

            expect(() => handler({ path: "f.txt", content: "x" })).toThrow("Failed to write file");
        });

        it("mkdirSync failure is also caught", () => {
            vi.mocked(fs.mkdirSync).mockImplementation(() => { throw new Error("EACCES"); });

            expect(() => handler({ path: "d/f.txt", content: "x" })).toThrow("Failed to write file");
        });
    });
});
