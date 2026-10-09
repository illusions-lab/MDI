// Local types for the Node loader. This package stays free of @types/node so the
// browser entry does not inherit Node globals.
declare module "node:fs/promises" {
	export function readFile(path: string): Promise<Uint8Array>;
	export function stat(path: string): Promise<{ size: number; isFile(): boolean }>;
}

declare module "node:path" {
	export function resolve(...paths: string[]): string;
}

declare module "node:url" {
	export function fileURLToPath(url: string): string;
}
