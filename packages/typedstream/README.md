# @parseaple/typedstream

A TypeScript parser for Apple's typedstream/NSArchiver binary format.

Based on [node-typedstream](https://github.com/BlueBubblesApp/node-typedstream) and [python-typedstream](https://github.com/dgelessus/python-typedstream).

Many thanks to Elliot Nash, this package is largely based on their prior effort in [node-typedstream](https://github.com/BlueBubblesApp/node-typedstream).

[![CI](https://github.com/photon-ai/parseaple/workflows/CI/badge.svg)](https://github.com/photon-ai/parseaple/actions)
[![npm version](https://img.shields.io/npm/v/@parseaple/typedstream)](https://www.npmjs.com/package/@parseaple/typedstream)
[![license](https://img.shields.io/npm/l/@parseaple/typedstream)](./LICENSE)

## What is typedstream?

`typedstream` is a binary serialization format used by Apple's `NSArchiver` / `NSUnarchiver` classes (the predecessor to `NSKeyedArchiver`). It appears in various macOS and iOS files, including `.clr` (color palettes), `.gcx` (Grapher documents), and other legacy archive formats.

## Installation

```
npm install @parseaple/typedstream
```

## Usage

### Decode a single root object

```js
import { Unarchiver } from "@parseaple/typedstream";
import { readFileSync } from "node:fs";

const data = readFileSync("path/to/file.clr");
const root = Unarchiver.open(data).decodeSingleRoot();
console.log(root);
```

### Decode all root values

```js
import { Unarchiver } from "@parseaple/typedstream";
import { readFileSync } from "node:fs";

const data = readFileSync("path/to/archive");
const values = Unarchiver.open(data).decodeAll();
console.log(values);
```

### Low-level stream reading

```js
import { TypedStreamReader } from "@parseaple/typedstream";
import { readFileSync } from "node:fs";

const data = readFileSync("path/to/archive");
const reader = new TypedStreamReader(data);

for (const event of reader) {
  console.log(event);
}
```

## Supported types

The library includes built-in support for common Foundation types:

- `NSString` / `NSMutableString`
- `NSData` / `NSMutableData`
- `NSArray` / `NSMutableArray`
- `NSDictionary` / `NSMutableDictionary`
- `NSAttributedString` / `NSMutableAttributedString`
- `NSColor`
- `NSFont`
- Common C structs (`NSPoint`, `NSSize`, `NSRect`, `CGPoint`, `CGSize`, `CGRect`)

Objects with unrecognized class names are decoded as `GenericArchivedObject` instances, preserving their full contents for inspection.

Binary property list (bplist) archives are also supported as a fallback format.

## Development

```
bun install
bun run build
bun run test
```

## License

MIT
