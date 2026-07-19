const ESCAPABLE = /[{}|^\[\]:《》\\]/g;

export function escapeMdi(value: string): string {
	return value.replace(ESCAPABLE, "\\$&");
}
