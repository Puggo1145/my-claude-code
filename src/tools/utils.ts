import path from "node:path";

export function safePath(inputPath: string): boolean {
    const workDir = process.cwd();
    const resolved = path.resolve(workDir, inputPath);
    const rel = path.relative(workDir, resolved);

    // 相对路径以 ".." 开头说明逃逸了工作目录，是绝对路径说明跨盘符（Windows）
    return !rel.startsWith('..') && !path.isAbsolute(rel);
}
