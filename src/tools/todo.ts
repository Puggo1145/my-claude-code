import type { ToolDef } from "./index.js";

const definition: ToolDef = {
    name: "todo",
    description: "Todo plan for multi-step tasks. Update task list and track progress. Mark a todo as 'IN_PROGRESS' before starting and 'COMPLETED' when done.",
    input_schema: { 
        type: "object", 
        properties: { 
            items: { 
                type: "array", 
                items: { 
                    type: "object", 
                    properties: { 
                        id: { 
                            type: "string" 
                        }, 
                        text: { 
                            type: "string" 
                        }, 
                        status: { 
                            type: "string", 
                            enum: ["PENDING", "IN_PROGRESS", "COMPLETED"] 
                        } 
                    }, 
                    required: ["id", "text", "status"] 
                } 
            } 
        }, 
        required: ["items"]
    }
}

type TodoItemStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

interface TodoItem {
    id: string;
    text: string;
    status: TodoItemStatus;
}
type UnvalidatedTodoItem = Partial<TodoItem>;

const STATUS_MARKER: Record<TodoItemStatus, string> = {
    PENDING: "[ ]",
    IN_PROGRESS: "[>]",
    COMPLETED: "[x]"
}

class TodoManager {
    private items: TodoItem[];

    constructor() {
        this.items = [];
    }

    update(items: UnvalidatedTodoItem[]): string {
        if (items.length > 10) {
            throw new Error("Max 10 todos allowed");
        }

        const validated: TodoItem[] = [];
        // ensure there is only one in_progress todo item
        let in_progress_count = 0;

        // validate incoming items
        let current_item_index = 0;
        for (const item of items) {
            const id = item.id ?? String(current_item_index + 1);

            const text = item.text;
            if (!text) {
                throw new Error(`Item ${item.id} is required`);
            }

            const status = item.status;
            if (!status) {
                throw new Error(`Item ${item.id}: status is required`)
            }
            if (!["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) {
                throw new Error(`Item ${item.id}: invalid status ${status}`);
            }

            if (status === "IN_PROGRESS") in_progress_count++;

            validated.push({
                id,
                text,
                status
            });

            current_item_index++;
        }
        // there can only be one in progress count
        if (in_progress_count > 1) {
            throw new Error("Only one task can be IN_PROGRESS at a time");
        }

        this.items = validated;
        return this.render();
    }

    render(): string {
        if (this.items.length === 0) {
            return "No todos."
        }
        const lines: string[] = []
        let done = 0;
        for (const item of this.items) {
            if (item.status === "COMPLETED") {
                done++;
            }
            lines.push(`${STATUS_MARKER[item.status]} #${item.id}: ${item.text}`);
        }
        lines.push(`\n${done}/${this.items.length} completed`);
        return lines.join("\n");
    }
}

const todoManager = new TodoManager();

export const todoTool = {
    handler: ({ items }: { items: UnvalidatedTodoItem[] }) => todoManager.update(items),
    definition
};
