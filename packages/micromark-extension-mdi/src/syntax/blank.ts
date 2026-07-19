import type { Code, Construct, Effects, State } from "micromark-util-types";
import { markdownLineEnding, markdownSpace } from "micromark-util-character";
import { codes } from "micromark-util-symbol";

export const blank: Construct = {
	name: "mdiBlank",
	tokenize: tokenizeBlank,
};

function tokenizeBlank(effects: Effects, ok: State, nok: State): State {
	return start;

	function start(code: Code): State | undefined {
		effects.enter("mdiBlank");
		effects.enter("mdiBlankMarker");
		effects.consume(code);
		return code === codes.backslash ? trailing : code === codes.lessThan ? br : openBracket;
	}

	function trailing(code: Code): State | undefined {
		if (markdownSpace(code)) {
			effects.consume(code);
			return trailing;
		}
		return end(code);
	}

	function br(code: Code): State | undefined {
		if (code !== codes.lowercaseB) return nok(code);
		effects.consume(code);
		return brR;
	}

	function brR(code: Code): State | undefined {
		if (code !== codes.lowercaseR) return nok(code);
		effects.consume(code);
		return brClose;
	}

	function brClose(code: Code): State | undefined {
		if (code === codes.greaterThan) {
			effects.consume(code);
			return trailing;
		}
		if (markdownSpace(code)) {
			effects.consume(code);
			return brClose;
		}
		if (code !== codes.slash) return nok(code);
		effects.consume(code);
		return brSlashClose;
	}

	function brSlashClose(code: Code): State | undefined {
		if (code !== codes.greaterThan) return nok(code);
		effects.consume(code);
		return trailing;
	}

	function openBracket(code: Code): State | undefined {
		if (code !== codes.leftSquareBracket) return nok(code);
		effects.consume(code);
		return blankB;
	}

	function blankB(code: Code): State | undefined {
		if (code !== codes.lowercaseB) return nok(code);
		effects.consume(code);
		return blankL;
	}

	function blankL(code: Code): State | undefined {
		if (code !== codes.lowercaseL) return nok(code);
		effects.consume(code);
		return blankA;
	}

	function blankA(code: Code): State | undefined {
		if (code !== codes.lowercaseA) return nok(code);
		effects.consume(code);
		return blankN;
	}

	function blankN(code: Code): State | undefined {
		if (code !== codes.lowercaseN) return nok(code);
		effects.consume(code);
		return blankK;
	}

	function blankK(code: Code): State | undefined {
		if (code !== codes.lowercaseK) return nok(code);
		effects.consume(code);
		return closeBracket;
	}

	function closeBracket(code: Code): State | undefined {
		if (code !== codes.rightSquareBracket) return nok(code);
		effects.consume(code);
		return closeBracket2;
	}

	function closeBracket2(code: Code): State | undefined {
		if (code !== codes.rightSquareBracket) return nok(code);
		effects.consume(code);
		return trailing;
	}

	function end(code: Code): State | undefined {
		if (code !== null && !markdownLineEnding(code)) return nok(code);
		effects.exit("mdiBlankMarker");
		effects.exit("mdiBlank");
		return ok(code);
	}
}
