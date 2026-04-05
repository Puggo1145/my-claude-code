import { describe, it, expect, vi, afterEach } from "vitest";
import { safePath } from "../../src/tools/utils.js";
import crypto from "node:crypto";

function randSegment() {
    return crypto.randomBytes(4).toString("hex");
}

describe("safePath", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("any single-segment relative path is safe", () => {
        const name = `${randSegment()}.txt`;
        expect(safePath(name)).toBe(true);
    });

    it("nested relative paths stay safe", () => {
        const p = `${randSegment()}/${randSegment()}/${randSegment()}.ts`;
        expect(safePath(p)).toBe(true);
    });

    it("a single '..' escapes and must be rejected", () => {
        expect(safePath(`../${randSegment()}`)).toBe(false);
    });

    it("N levels of '..' always escape", () => {
        const depth = Math.floor(Math.random() * 5) + 2; // 2-6
        const escape = Array(depth).fill("..").join("/") + `/${randSegment()}`;
        expect(safePath(escape)).toBe(false);
    });

    it("'..' hidden in the middle that still escapes is rejected", () => {
        // a/../../x  =>  resolve: cwd/../x  =>  escapes
        expect(safePath(`${randSegment()}/../../${randSegment()}`)).toBe(false);
    });

    it("'..' in the middle that does NOT escape is allowed", () => {
        // a/b/../c  =>  resolve: cwd/a/c  =>  inside cwd
        const a = randSegment();
        const b = randSegment();
        const c = randSegment();
        expect(safePath(`${a}/${b}/../${c}`)).toBe(true);
    });

    it("absolute path outside cwd is rejected", () => {
        expect(safePath(`/tmp/${randSegment()}`)).toBe(false);
    });

    it("'.' (cwd itself) is allowed", () => {
        expect(safePath(".")).toBe(true);
    });

    it("'./file' is equivalent to 'file' and is allowed", () => {
        const name = randSegment();
        expect(safePath(`./${name}`)).toBe(true);
    });

    // 这个测试验证 safePath 真的会拒绝——如果实现有 bug（比如只检查开头）
    // 那这条就会暴露出来
    it("tricky payload: valid prefix + escape suffix is rejected", () => {
        const valid = `src/${randSegment()}`;
        const payload = `${valid}/../../../${randSegment()}`;
        expect(safePath(payload)).toBe(false);
    });
});
