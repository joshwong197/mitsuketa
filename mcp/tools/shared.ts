// Shared per-request context handed to every tool handler.

export interface ToolContext {
    req?: { headers?: Record<string, string | string[] | undefined> };
}
