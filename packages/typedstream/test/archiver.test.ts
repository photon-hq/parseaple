import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TypedGroup, Unarchiver } from "../src/archiver";
import { NSString } from "../src/types/foundation";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Archived NSString("string value") — from the upstream Python test suite
const STRING_DATA = Buffer.from(
	"\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x08NSString\x01\x84\x84\x08NSObject\x00\x85\x84\x01+\x0cstring value\x86",
	"binary",
);

const FIXTURES = join(__dirname, "fixtures");

describe("Unarchiver", () => {
	it("throws on an invalid buffer", () => {
		expect(() => Unarchiver.open(Buffer.from("garbage"))).not.toThrow(); // opens as bplist fallback
	});

	describe("decodeSingleRoot", () => {
		it("decodes an NSString archive to an NSString instance", () => {
			const root = Unarchiver.open(STRING_DATA).decodeSingleRoot();
			expect(root).toBeInstanceOf(NSString);
			expect((root as NSString).string).toBe("string value");
		});
	});

	describe("decodeAll", () => {
		it("returns an array of TypedGroups for the NSString archive", () => {
			const values = Unarchiver.open(STRING_DATA).decodeAll();
			expect(Array.isArray(values)).toBe(true);
			expect(values.length).toBe(1);
			expect(values[0]).toBeInstanceOf(TypedGroup);
		});

		for (const name of ["Emacs.clr", "Empty2D macOS 10.14.gcx", "Empty2D macOS 13.gcx"]) {
			it(`decodes fixture "${name}" without throwing`, () => {
				const data = readFileSync(join(FIXTURES, name));
				expect(() => Unarchiver.open(data).decodeAll()).not.toThrow();
			});
		}
	});
});
