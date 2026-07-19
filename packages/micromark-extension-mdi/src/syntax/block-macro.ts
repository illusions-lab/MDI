import type { Code, Construct, Effects, State } from "micromark-util-types";
import { markdownLineEnding, markdownSpace } from "micromark-util-character";
import { codes } from "micromark-util-symbol";

export const blockMacro: Construct = {
	name: "mdiBlockMacro",
	tokenize: tokenizeBlockMacro,
};

function tokenizeBlockMacro(effects: Effects, ok: State, nok: State): State {
	let name = "";
	let parameter = "";
	let hasParameter = false;

	return start;

	function start(code: Code): State | undefined {
		effects.enter("mdiBlockMacro");
		effects.enter("mdiBlockMacroMarker");
		effects.consume(code);
		return secondOpen;
	}

	function secondOpen(code: Code): State | undefined {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.consume(code);
		effects.exit("mdiBlockMacroMarker");
		effects.enter("mdiBlockMacroName");
		return readName;
	}

	function readName(code: Code): State | undefined {
		if (code !== null && code >= codes.lowercaseA && code <= codes.lowercaseZ) {
			name += String.fromCodePoint(code);
			effects.consume(code);
			return readName;
		}
		effects.exit("mdiBlockMacroName");
		if (name !== "pagebreak" && name !== "indent" && name !== "bottom") return nok(code);
		if (code === codes.colon) {
			hasParameter = true;
			effects.enter("mdiBlockMacroParamMarker");
			effects.consume(code);
			effects.exit("mdiBlockMacroParamMarker");
			effects.enter("mdiBlockMacroParam");
			return readParameter;
		}
		return close(code);
	}

	function readParameter(code: Code): State | undefined {
		if (code !== null && !markdownLineEnding(code) && code !== codes.rightSquareBracket) {
			parameter += String.fromCodePoint(code);
			effects.consume(code);
			return readParameter;
		}
		effects.exit("mdiBlockMacroParam");
		return close(code);
	}

	function close(code: Code): State | undefined {
		if (code !== codes.rightSquareBracket) return nok(code);
		if (!completeSyntax(name, hasParameter, parameter)) return nok(code);
		effects.enter("mdiBlockMacroMarker");
		effects.consume(code);
		return secondClose;
	}

	function secondClose(code: Code): State | undefined {
		if (code !== codes.rightSquareBracket) return nok(code);
		effects.consume(code);
		effects.exit("mdiBlockMacroMarker");
		return trailing;
	}

	function trailing(code: Code): State | undefined {
		if (markdownSpace(code)) {
			effects.consume(code);
			return trailing;
		}
		if (code !== null && !markdownLineEnding(code)) return nok(code);
		effects.exit("mdiBlockMacro");
		return ok(code);
	}
}

function completeSyntax(name: string, hasParameter: boolean, parameter: string): boolean {
	if (name === "indent") return hasParameter;
	if (name === "bottom") return !hasParameter || parameter.length > 0;
	return !hasParameter || parameter.length > 0;
}
