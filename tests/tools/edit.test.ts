import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { editTool } from "../../src/tools/edit.js";
import * as fs from "node:fs";
import * as utils from "../../src/tools/utils.js";
import crypto from "node:crypto";

vi.mock("node:fs");
vi.mock("../../src/tools/utils.js");

const handler = editTool.handler;

function randStr() {
    return crypto.randomBytes(6).toString("hex");
}

describe("editTool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(utils.safePath).mockReturnValue(true);
        vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        vi.spyOn(process, "cwd").mockReturnValue("/home/user/project");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("definition", () => {
        it("should have name 'edit' and require path, old_text, new_text", () => {
            expect(editTool.definition.name).toBe("edit");
            const req = (editTool.definition.input_schema as any).required;
            expect(req).toEqual(expect.arrayContaining(["path", "old_text", "new_text"]));
        });
    });

    describe("replacement correctness", () => {
        it("replaces the target and only the target in the written content", () => {
            const before = randStr(), target = randStr(), after = randStr(), replacement = randStr();
            const original = `${before} ${target} ${after}`;
            vi.mocked(fs.readFileSync).mockReturnValue(original);

            handler({ path: "f.txt", old_text: target, new_text: replacement });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;
            expect(written).toBe(`${before} ${replacement} ${after}`);
            // target 不再出现
            expect(written).not.toContain(target);
            // 周围内容不变
            expect(written).toContain(before);
            expect(written).toContain(after);
        });

        it("multi-line replacement preserves surrounding lines", () => {
            const lines = Array.from({ length: 5 }, () => randStr());
            vi.mocked(fs.readFileSync).mockReturnValue(lines.join("\n"));

            const oldText = `${lines[1]}\n${lines[2]}`;
            const newText = randStr();
            handler({ path: "f.txt", old_text: oldText, new_text: newText });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;
            expect(written).toBe(`${lines[0]}\n${newText}\n${lines[3]}\n${lines[4]}`);
        });

        it("deletion (new_text='') removes the target cleanly", () => {
            const a = randStr(), target = randStr(), b = randStr();
            vi.mocked(fs.readFileSync).mockReturnValue(`${a}${target}${b}`);

            handler({ path: "f.txt", old_text: target, new_text: "" });

            const written = vi.mocked(fs.writeFileSync).mock.calls[0]![1] as string;
            expect(written).toBe(`${a}${b}`);
        });
    });

    describe("line count in response", () => {
        it("reports the post-edit line count, not the pre-edit count", () => {
            // 替换后行数变化：1 行 → 3 行
            const original = "only-line";
            vi.mocked(fs.readFileSync).mockReturnValue(original);

            const result = handler({ path: "f.txt", old_text: "only-line", new_text: "a\nb\nc" });

            expect(result).toContain("3 lines");
        });
    });

    describe("uniqueness enforcement", () => {
        it("rejects when old_text appears 0 times", () => {
            vi.mocked(fs.readFileSync).mockReturnValue(`content: ${randStr()}`);

            expect(() =>
                handler({ path: "f.txt", old_text: randStr(), new_text: "x" })
            ).toThrow("old_text not found");
        });

        it("rejects when old_text appears N>1 times, reporting the exact count", () => {
            const token = randStr();
            const n = Math.floor(Math.random() * 5) + 2; // 2-6
            const content = Array(n).fill(token).join(" ");
            vi.mocked(fs.readFileSync).mockReturnValue(content);

            expect(() =>
                handler({ path: "f.txt", old_text: token, new_text: "x" })
            ).toThrow(`matches ${n} times`);
        });
    });

    describe("error propagation", () => {
        it("rejects unsafe path before reading the file", () => {
            vi.mocked(utils.safePath).mockReturnValue(false);

            expect(() => handler({ path: `../${randStr()}`, old_text: "a", new_text: "b" })).toThrow("permission");
            expect(fs.readFileSync).not.toHaveBeenCalled();
        });

        it("wraps readFileSync errors", () => {
            vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });

            expect(() => handler({ path: "f.txt", old_text: "a", new_text: "b" })).toThrow("Failed to read file");
        });

        it("wraps writeFileSync errors", () => {
            vi.mocked(fs.readFileSync).mockReturnValue("abc");
            vi.mocked(fs.writeFileSync).mockImplementation(() => { throw new Error("EACCES"); });

            expect(() => handler({ path: "f.txt", old_text: "abc", new_text: "xyz" })).toThrow("Failed to write file");
        });
    });
});
