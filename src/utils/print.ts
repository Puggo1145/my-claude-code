import { type InspectColor, styleText } from "node:util";

type PrintTypeConfig = {
    color: InspectColor;
}

const printType: Record<string, PrintTypeConfig> = {
    message: {
        color: "reset"
    },
    tool: {
        color: "gray"
    },
    error: {
        color: "red"
    },
    default: {
        color: "reset"
    },
}

export function print(
    text: string, 
    type: keyof typeof printType = "default"
) {
    console.log(styleText(printType[type]!.color, text) + "\n");
}

export function cutContent(content: string, maxLines = 10, maxLength = 500): string {
    if (content.length <= maxLength) return content;

    const lines = content.split("\n");
    if (lines.length <= maxLines) {
        return content.slice(0, maxLength) + `... (${content.length - maxLength} more chars)`;
    }

    const truncated = lines.slice(0, maxLines);
    truncated.push(`... (${lines.length - maxLines} more lines)`);
    return truncated.join("\n");
}
