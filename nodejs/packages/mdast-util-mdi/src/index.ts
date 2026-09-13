export const MDI_SPEC_VERSION = "2.1";

export type {
	MdiPhrasingContent,
	MdiComment,
	MdiRuby,
	MdiTcy,
	MdiBreak,
	MdiBlank,
	MdiEm,
	MdiNoBreak,
	MdiWarichu,
	MdiKern,
	MdiPagebreak,
} from "./types.js";

export { mdiToMarkdown } from "./to-markdown.js";
export { mdastToMdiSource } from "./source.js";
