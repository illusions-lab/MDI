import type { Extension } from "micromark-util-types";
import { codes } from "micromark-util-symbol";
import { botenAlias } from "./syntax/boten-alias.js";
import { blank } from "./syntax/blank.js";
import { blockMacro } from "./syntax/block-macro.js";
import { bracketMacro, bracketMacroClose } from "./syntax/bracket-macro.js";
import { ruby } from "./syntax/ruby.js";
import { tcy } from "./syntax/tcy.js";
import { mdiConstructs } from "./types.js";

export const MDI_SPEC_VERSION = "2.0";

export type { MdiConstructFamily, MdiContentType, MdiConstructInfo } from "./types.js";
export { mdiConstructs } from "./types.js";

/** micromark syntax extension for the currently implemented MDI 2.0 inline constructs. */
export function mdi(): Extension {
	return {
		text: {
			[codes.leftCurlyBrace]: ruby,
			[mdiConstructs.bracketMacro.triggers[0]!]: bracketMacro,
			[codes.rightSquareBracket]: bracketMacroClose,
			[mdiConstructs.tcy.triggers[0]!]: tcy,
			[mdiConstructs.botenAlias.triggers[0]!]: botenAlias,
		},
		flow: {
			[mdiConstructs.blank.triggers[0]!]: blank,
			[mdiConstructs.blank.triggers[1]!]: blank,
			[mdiConstructs.blank.triggers[2]!]: [blank, blockMacro],
		},
	};
}
