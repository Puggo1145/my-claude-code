import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readTool } from "../../src/tools/read.js";
import * as fs from "node:fs";
import * as utils from "../../src/tools/utils.js";
import crypto from "node:crypto";

vi.mock("node:fs");
vi.mock("../../src/tools/utils.js");

const handler = readTool.handler;

function randLines(n: number): string[] {
    return Array.from({ length: n }, () => crypto.randomBytes(8).toString("hex"));
}

describe("readTool", () => {
    beforeEach(() => {
        vi.mocked(utils.safePath).mockReturnValue(true);
        vi.spyOn(process, "cwd").mockReturnValue("/home/user/project");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("definition", () => {
        it("should have name 'read' and require 'path'", () => {
            expect(readTool.definition.name).toBe("read");
            expect((readTool.definition.input_schema as any).required).toContain("path");
        });
    });

    describe("line numbering correctness", () => {
        it("every line in the output carries the correct 1-based number", () => {
            const lines = randLines(20);
            vi.mocked(fs.readFileSync).mockReturnValue(lines.join("\n"));

            const result = handler({ path: "f.txt" });

            for (let i = 0; i < lines.length; i++) {
                // 行号从 1 开始，格式 "N | content"
                expect(result).toContain(`${i + 1} | ${lines[i]}`);
            }
        });

        it("from/to slices the right lines (random range)", () => {
            const lines = randLines(50);
            vi.mocked(fs.readFileSync).mockReturnValue(lines.join("\n"));

            const from = Math.floor(Math.random() * 20);      // 0-19
            const to = from + Math.floor(Math.random() * 20);  // from..(from+19)

            const result = handler({ path: "f.txt", from, to });

            // 被选中的行必须出现
            for (let i = from; i <= to; i++) {
                expect(result).toContain(`${i + 1} | ${lines[i]}`);
            }
            // 范围外的行不能出现
            if (from > 0) {
                expect(result).not.toContain(`${from} | ${lines[from - 1]}`);
            }
            if (to < lines.length - 1) {
                expect(result).not.toContain(`${to + 2} | ${lines[to + 1]}`);
            }
        });
    });

    describe("total line count in header", () => {
        it("header reports the correct total, not the sliced count", () => {
            const n = Math.floor(Math.random() * 100) + 10;
            const lines = randLines(n);
            vi.mocked(fs.readFileSync).mockReturnValue(lines.join("\n"));

            const result = handler({ path: "f.txt", from: 0, to: 2 });

            expect(result).toContain(`(${n} lines)`);
        });
    });

    describe("MAX_LINES truncation", () => {
        it("without explicit 'to', only first 1000 lines are returned", () => {
            const n = 1000 + Math.floor(Math.random() * 50) + 1; // 1001-1050
            const lines = randLines(n);
            vi.mocked(fs.readFileSync).mockReturnValue(lines.join("\n"));

            const result = handler({ path: "f.txt" });

            // line 1001 应出现（0-based index 999）
            expect(result).toContain(`1000 | ${lines[999]}`);
            // line 1002 不该出现
            expect(result).not.toContain(`1001 | ${lines[1000]}`);
            // 提示剩余行数
            const remaining = n - 1000;
            expect(result).toContain(`... ${remaining} more lines`);
        });

        it("explicit 'to' suppresses the remaining-lines hint", () => {
            const lines = randLines(10);
            vi.mocked(fs.readFileSync).mockReturnValue(lines.join("\n"));

            const result = handler({ path: "f.txt", from: 0, to: 3 });
            expect(result).not.toContain("more lines");
        });
    });

    describe("error cases actually reject bad input", () => {
        it("rejects unsafe path", () => {
            vi.mocked(utils.safePath).mockReturnValue(false);
            expect(() => handler({ path: `../${crypto.randomBytes(4).toString("hex")}` })).toThrow("permission");
        });

        it("rejects negative 'from'", () => {
            vi.mocked(fs.readFileSync).mockReturnValue("a\nb");
            const negFrom = -(Math.floor(Math.random() * 10) + 1);
            expect(() => handler({ path: "f.txt", from: negFrom })).toThrow('"from" must not be less than 0');
        });

        it("rejects 'to' beyond file length", () => {
            const n = Math.floor(Math.random() * 10) + 3;
            vi.mocked(fs.readFileSync).mockReturnValue(randLines(n).join("\n"));
            expect(() => handler({ path: "f.txt", from: 0, to: n + 5 })).toThrow('"to" must not exceed');
        });

        it("rejects from > to", () => {
            vi.mocked(fs.readFileSync).mockReturnValue(randLines(10).join("\n"));
            const from = 7, to = 3;
            expect(() => handler({ path: "f.txt", from, to })).toThrow(`"from" (${from}) must not be greater than "to" (${to})`);
        });

        it("rejects nonexistent file", () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });
            expect(() => handler({ path: "nope.txt" })).toThrow("Failed to read file");
        });
    });
});
