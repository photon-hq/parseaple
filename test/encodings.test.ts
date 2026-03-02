import { describe, expect, it } from "vitest";
import {
	allEncodingsMatchExpected,
	buildArrayEncoding,
	buildStructEncoding,
	encodingMatchesExpected,
	parseArrayEncoding,
	parseStructEncoding,
	splitEncodings,
} from "../src/encodings";

describe("splitEncodings", () => {
	it("splits a single primitive", () => {
		expect([...splitEncodings("i")]).toEqual(["i"]);
	});

	it("splits multiple primitives", () => {
		expect([...splitEncodings("id")]).toEqual(["i", "d"]);
	});

	it("keeps an array encoding together", () => {
		expect([...splitEncodings("[10i]")]).toEqual(["[10i]"]);
	});

	it("keeps a struct encoding together", () => {
		expect([...splitEncodings("{CGPoint=dd}")]).toEqual(["{CGPoint=dd}"]);
	});

	it("splits a struct followed by a primitive", () => {
		expect([...splitEncodings("{CGPoint=dd}i")]).toEqual([
			"{CGPoint=dd}",
			"i",
		]);
	});

	it("returns empty array for empty string", () => {
		expect([...splitEncodings("")]).toEqual([]);
	});
});

describe("parseArrayEncoding", () => {
	it("parses a simple array encoding", () => {
		expect(parseArrayEncoding("[10i]")).toEqual({
			length: 10,
			elementTypeEncoding: "i",
		});
	});

	it("parses a byte array encoding", () => {
		expect(parseArrayEncoding("[256c]")).toEqual({
			length: 256,
			elementTypeEncoding: "c",
		});
	});

	it("throws on missing opening bracket", () => {
		expect(() => parseArrayEncoding("10i]")).toThrow();
	});

	it("throws on missing closing bracket", () => {
		expect(() => parseArrayEncoding("[10i")).toThrow();
	});
});

describe("buildArrayEncoding", () => {
	it("builds a simple array encoding", () => {
		expect(buildArrayEncoding(10, "i")).toBe("[10i]");
	});

	it("throws on negative length", () => {
		expect(() => buildArrayEncoding(-1, "i")).toThrow();
	});

	it("round-trips with parseArrayEncoding", () => {
		const enc = buildArrayEncoding(42, "d");
		expect(parseArrayEncoding(enc)).toEqual({
			length: 42,
			elementTypeEncoding: "d",
		});
	});
});

describe("parseStructEncoding", () => {
	it("parses a named struct", () => {
		expect(parseStructEncoding("{CGPoint=dd}")).toEqual({
			name: "CGPoint",
			fieldTypeEncodings: ["d", "d"],
		});
	});

	it("parses an unnamed struct", () => {
		expect(parseStructEncoding("{dd}")).toEqual({
			name: undefined,
			fieldTypeEncodings: ["d", "d"],
		});
	});

	it("parses a single-field struct", () => {
		expect(parseStructEncoding("{NSSize=ff}")).toEqual({
			name: "NSSize",
			fieldTypeEncodings: ["f", "f"],
		});
	});

	it("throws on missing opening brace", () => {
		expect(() => parseStructEncoding("CGPoint=dd}")).toThrow();
	});

	it("throws on missing closing brace", () => {
		expect(() => parseStructEncoding("{CGPoint=dd")).toThrow();
	});
});

describe("buildStructEncoding", () => {
	it("builds a named struct encoding", () => {
		expect(buildStructEncoding(["d", "d"], "CGPoint")).toBe("{CGPoint=dd}");
	});

	it("builds an unnamed struct encoding", () => {
		expect(buildStructEncoding(["d", "d"])).toBe("{dd}");
	});

	it("round-trips with parseStructEncoding", () => {
		const enc = buildStructEncoding(["f", "f"], "NSSize");
		expect(parseStructEncoding(enc)).toEqual({
			name: "NSSize",
			fieldTypeEncodings: ["f", "f"],
		});
	});
});

describe("encodingMatchesExpected", () => {
	it("matches identical primitive encodings", () => {
		expect(encodingMatchesExpected("i", "i")).toBe(true);
	});

	it("rejects different primitive encodings", () => {
		expect(encodingMatchesExpected("i", "d")).toBe(false);
	});

	it("matches named structs with same name and fields", () => {
		expect(
			encodingMatchesExpected("{CGPoint=dd}", "{CGPoint=dd}"),
		).toBe(true);
	});

	it("matches wildcard '?' struct name against any name", () => {
		expect(encodingMatchesExpected("{?=dd}", "{CGPoint=dd}")).toBe(true);
	});

	it("rejects structs with different field counts", () => {
		expect(encodingMatchesExpected("{CGPoint=d}", "{CGPoint=dd}")).toBe(false);
	});

	it("matches identical array encodings", () => {
		expect(encodingMatchesExpected("[10i]", "[10i]")).toBe(true);
	});

	it("rejects arrays with different lengths", () => {
		expect(encodingMatchesExpected("[5i]", "[10i]")).toBe(false);
	});
});

describe("allEncodingsMatchExpected", () => {
	it("matches when all encodings match", () => {
		expect(allEncodingsMatchExpected(["i", "d"], ["i", "d"])).toBe(true);
	});

	it("rejects when lengths differ", () => {
		expect(allEncodingsMatchExpected(["i"], ["i", "d"])).toBe(false);
	});

	it("rejects when one encoding mismatches", () => {
		expect(allEncodingsMatchExpected(["i", "f"], ["i", "d"])).toBe(false);
	});

	it("matches empty arrays", () => {
		expect(allEncodingsMatchExpected([], [])).toBe(true);
	});
});
