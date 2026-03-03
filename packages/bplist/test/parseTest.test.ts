// tests are adapted from https://github.com/TooTallNate/node-plist

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as bplist from "../src/index";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("bplist-parser", () => {
	it("iTunes Small", async () => {
		const file = join(__dirname, "fixtures", "iTunes-small.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);
		
		expect(dict).toBeDefined();
		expect((dict as any)["Application Version"]).toBe("9.0.3");
		expect((dict as any)["Library Persistent ID"]).toBe("6F81D37F95101437");
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("sample1", async () => {
		const file = join(__dirname, "fixtures", "sample1.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["CFBundleIdentifier"]).toBe("com.apple.dictionary.MySample");
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("sample2", async () => {
		const file = join(__dirname, "fixtures", "sample2.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["PopupMenu"][2]["Key"]).toBe(
			"\n        #import <Cocoa/Cocoa.h>\n\n#import <MacRuby/MacRuby.h>\n\nint main(int argc, char *argv[])\n{\n  return macruby_main(\"rb_main.rb\", argc, argv);\n}\n",
		);
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("airplay", async () => {
		const file = join(__dirname, "fixtures", "airplay.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["duration"]).toBe(5555.0495000000001);
		expect((dict as any)["position"]).toBe(4.6269989039999997);
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("utf16", async () => {
		const file = join(__dirname, "fixtures", "utf16.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["CFBundleName"]).toBe("sellStuff");
		expect((dict as any)["CFBundleShortVersionString"]).toBe("2.6.1");
		expect((dict as any)["NSHumanReadableCopyright"]).toBe("©2008-2012, sellStuff, Inc.");
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("utf16chinese", async () => {
		const file = join(__dirname, "fixtures", "utf16_chinese.plist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["CFBundleName"]).toBe("天翼阅读");
		expect((dict as any)["CFBundleDisplayName"]).toBe("天翼阅读");
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("uid", async () => {
		const file = join(__dirname, "fixtures", "uid.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["$objects"][1]["NS.keys"]).toEqual([
			{ UID: 2 },
			{ UID: 3 },
			{ UID: 4 },
		]);
		expect((dict as any)["$objects"][1]["NS.objects"]).toEqual([
			{ UID: 5 },
			{ UID: 6 },
			{ UID: 7 },
		]);
		expect((dict as any)["$top"]["root"]).toEqual({ UID: 1 });
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});

	it("int64", async () => {
		const file = join(__dirname, "fixtures", "int64.bplist");
		const startTime = Date.now();

		const [dict] = await bplist.parseFile(file);
		const endTime = Date.now();
		console.log(`Parsed "${file}" in ${endTime - startTime}ms`);

		expect((dict as any)["zero"]).toBe(0);
		expect((dict as any)["int32item"]).toBe(1234567890);
		expect((dict as any)["int32itemsigned"]).toBe(-1234567890);
		expect((dict as any)["int64item"]).toBe(12345678901234567890n);
		expect(dict).toEqual(bplist.parseFileSync(file)[0]);
	});
});