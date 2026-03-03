import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BeginObject,
	BeginTypedValues,
	EndObject,
	EndTypedValues,
	SingleClass,
	TypedStreamReader,
} from "../src/stream";

// Archived NSString("string value") — from the upstream Python test suite
const STRING_DATA = Buffer.from(
	"\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x08NSString\x01\x84\x84\x08NSObject\x00\x85\x84\x01+\x0cstring value\x86",
	"binary",
);

const FIXTURES = join(import.meta.dirname, "fixtures");

describe("TypedStreamReader", () => {
	it("throws on an empty buffer", () => {
		expect(() => new TypedStreamReader(Buffer.alloc(0))).toThrow();
	});

	it("throws on a garbage buffer", () => {
		expect(() =>
			new TypedStreamReader(Buffer.from("not a typedstream")),
		).toThrow();
	});

	it("emits the correct event sequence for a known NSString archive", () => {
		const reader = new TypedStreamReader(STRING_DATA);
		const events = [...reader];
		expect(events).toEqual([
			new BeginTypedValues(["@"]),
			new BeginObject(),
			new SingleClass("NSString", 1),
			new SingleClass("NSObject", 0),
			undefined,
			new BeginTypedValues(["+"]),
			Buffer.from("string value"),
			new EndTypedValues(),
			new EndObject(),
			new EndTypedValues(),
		]);
	});

	for (const name of ["Emacs.clr", "Empty2D macOS 10.14.gcx", "Empty2D macOS 13.gcx"]) {
		it(`reads all events from fixture "${name}" without throwing`, () => {
			const data = readFileSync(join(FIXTURES, name));
			const reader = new TypedStreamReader(data);
			expect(() => { for (const _ of reader) {} }).not.toThrow();
		});
	}
});
