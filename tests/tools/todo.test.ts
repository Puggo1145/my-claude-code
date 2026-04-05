import { describe, it, expect } from "vitest";
import { todoTool } from "../../src/tools/todo.js";
import crypto from "node:crypto";

const handler = todoTool.handler;

function randStr() {
    return crypto.randomBytes(6).toString("hex");
}

type Status = "PENDING" | "IN_PROGRESS" | "COMPLETED";
const ALL_STATUSES: Status[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const STATUS_MARKERS: Record<Status, string> = {
    PENDING: "[ ]",
    IN_PROGRESS: "[>]",
    COMPLETED: "[x]",
};

describe("todoTool", () => {
    describe("definition", () => {
        it("should have name 'todo' and require 'items'", () => {
            expect(todoTool.definition.name).toBe("todo");
            expect((todoTool.definition.input_schema as any).required).toContain("items");
        });
    });

    describe("rendering", () => {
        it("each status renders the correct marker (random pick)", () => {
            const status = ALL_STATUSES[Math.floor(Math.random() * 3)]!;
            const text = randStr();
            const result = handler({ items: [{ id: "1", text, status }] });

            expect(result).toContain(`${STATUS_MARKERS[status]} #1: ${text}`);
        });

        it("completed count is accurate for random mix", () => {
            const n = Math.floor(Math.random() * 8) + 2; // 2-9
            let completedCount = 0;
            let hasInProgress = false;

            const items = Array.from({ length: n }, (_, i) => {
                let status: Status;
                if (!hasInProgress && Math.random() < 0.2) {
                    status = "IN_PROGRESS";
                    hasInProgress = true;
                } else if (Math.random() < 0.5) {
                    status = "COMPLETED";
                    completedCount++;
                } else {
                    status = "PENDING";
                }
                return { id: String(i + 1), text: randStr(), status };
            });

            const result = handler({ items });

            expect(result).toContain(`${completedCount}/${n} completed`);
        });

        it("empty list returns exactly 'No todos.'", () => {
            expect(handler({ items: [] })).toBe("No todos.");
        });
    });

    describe("id auto-generation", () => {
        it("missing id defaults to 1-based index string", () => {
            const n = Math.floor(Math.random() * 5) + 2;
            const items = Array.from({ length: n }, () => ({
                text: randStr(),
                status: "PENDING" as const,
            }));

            const result = handler({ items });

            for (let i = 0; i < n; i++) {
                expect(result).toContain(`#${i + 1}:`);
            }
        });
    });

    describe("state replacement", () => {
        it("second call completely replaces first call's items", () => {
            const oldText = randStr();
            const newText = randStr();

            handler({ items: [{ id: "1", text: oldText, status: "PENDING" }] });
            const result = handler({ items: [{ id: "2", text: newText, status: "COMPLETED" }] });

            expect(result).not.toContain(oldText);
            expect(result).toContain(newText);
            expect(result).toContain("1/1 completed");
        });
    });

    describe("validation – must reject bad input", () => {
        it("rejects > 10 items", () => {
            const items = Array.from({ length: 11 }, (_, i) => ({
                id: String(i), text: randStr(), status: "PENDING" as const,
            }));
            expect(() => handler({ items })).toThrow("Max 10 todos allowed");
        });

        it("allows exactly 10 items", () => {
            const items = Array.from({ length: 10 }, (_, i) => ({
                id: String(i + 1), text: randStr(), status: "PENDING" as const,
            }));
            expect(() => handler({ items })).not.toThrow();
        });

        it("rejects missing text", () => {
            expect(() => handler({ items: [{ id: "1", status: "PENDING" }] })).toThrow("is required");
        });

        it("rejects missing status", () => {
            expect(() => handler({ items: [{ id: "1", text: randStr() }] })).toThrow("status is required");
        });

        it("rejects an invented status string", () => {
            const fakeStatus = randStr();
            expect(() =>
                handler({ items: [{ id: "1", text: randStr(), status: fakeStatus as any }] })
            ).toThrow("invalid status");
        });

        it("rejects multiple IN_PROGRESS items", () => {
            expect(() =>
                handler({
                    items: [
                        { id: "1", text: randStr(), status: "IN_PROGRESS" },
                        { id: "2", text: randStr(), status: "IN_PROGRESS" },
                    ],
                })
            ).toThrow("Only one task can be IN_PROGRESS at a time");
        });

        it("allows exactly one IN_PROGRESS among many", () => {
            const items = [
                { id: "1", text: randStr(), status: "COMPLETED" as const },
                { id: "2", text: randStr(), status: "IN_PROGRESS" as const },
                { id: "3", text: randStr(), status: "PENDING" as const },
            ];
            expect(() => handler({ items })).not.toThrow();
        });
    });
});
