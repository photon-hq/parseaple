# @parseaple/bplist

A TypeScript parser for Apple's binary property list (bplist) format.

Based on [node-bplist-parser](https://github.com/joeferner/node-bplist-parser) by Joe Ferner.

Many thanks to Joe Ferner for the original implementation.

[![CI](https://github.com/photon-ai/parseaple/workflows/CI/badge.svg)](https://github.com/photon-ai/parseaple/actions)
[![npm version](https://img.shields.io/npm/v/@parseaple/bplist)](https://www.npmjs.com/package/@parseaple/bplist)
[![license](https://img.shields.io/npm/l/@parseaple/bplist)](./LICENSE)

## What is bplist?

Binary property list (bplist) is a compact binary serialization format used by Apple for storing structured data. It's commonly found in macOS and iOS system files, application preferences, `Info.plist` files, and various other configuration files. Binary plists are more efficient than their XML counterparts and support additional data types like dates, binary data, and UID references.

## Installation

```
npm install @parseaple/bplist
```

## Usage

### Parse a file

```js
import * as bplist from "@parseaple/bplist";

const [data] = await bplist.parseFile("Info.plist");
console.log(data);
```

### Parse synchronously

```js
import * as bplist from "@parseaple/bplist";

const [data] = bplist.parseFileSync("Info.plist");
console.log(data);
```

### Parse from buffer

```js
import * as bplist from "@parseaple/bplist";
import { readFileSync } from "node:fs";

const buffer = readFileSync("myPlist.bplist");
const [data] = bplist.parseBuffer(buffer);
console.log(data);
```

### Legacy callback style

```js
import { parseFile } from "@parseaple/bplist";

parseFile("myPlist.bplist", (err, data) => {
  if (err) throw err;
  console.log(data);
});
```

## Supported types

The library supports all standard binary plist types:

- Null (`null`)
- Boolean (`true`, `false`)
- Integer (including 64-bit `bigint`)
- Real (floating-point numbers)
- Date (`Date` objects)
- Data (`Buffer` objects)
- ASCII String and UTF-16 String (`string`)
- UID (represented as `{ UID: number }`)
- Array (`Array`)
- Dictionary (`Object`)

## Development

```
bun install
bun run build
bun run test
```

## License

MIT