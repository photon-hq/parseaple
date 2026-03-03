# bplist

Binary Mac OS X Plist (property list) parser for Node.js.

Modern TypeScript rewrite of [node-bplist-parser](https://github.com/joeferner/node-bplist-parser) with full type safety and ESM support.

## Features

- ✨ **Modern TypeScript** - Full type definitions included
- 🚀 **ESM First** - Native ES Module support
- 🔒 **Type Safe** - Comprehensive TypeScript types for all plist values
- ⚡ **Fast** - Efficient binary parsing
- 📦 **Zero Dependencies** - No external runtime dependencies

## Installation

```bash
npm install bplist
# or
pnpm add bplist
# or
yarn add bplist
```

## Usage

### Basic Example

```typescript
import * as bplist from 'bplist';

// Parse from file (async)
const [data] = await bplist.parseFile('myPlist.bplist');
console.log(data);

// Parse from file (sync)
const [data] = bplist.parseFileSync('myPlist.bplist');
console.log(data);

// Parse from buffer
const buffer = Buffer.from(/* ... */);
const [data] = bplist.parseBuffer(buffer);
console.log(data);
```

### With TypeScript

```typescript
import { parseFile, type UID } from 'bplist';

const [plist] = await parseFile('Info.plist');

// TypeScript knows the possible types
if (typeof plist === 'object' && plist !== null && !Array.isArray(plist)) {
  const bundleId = plist['CFBundleIdentifier'];
  console.log('Bundle ID:', bundleId);
}
```

### Callback Style (Legacy)

```typescript
import { parseFile } from 'bplist';

parseFile('myPlist.bplist', (err, data) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log(data);
});
```

## API

### `parseFile(fileNameOrBuffer, callback?)`

Parse a binary plist file or buffer asynchronously.

**Parameters:**
- `fileNameOrBuffer` - File path (string) or Buffer
- `callback` - Optional callback function `(err, result) => void`

**Returns:** `Promise<PlistValue[]>`

### `parseFileSync(fileNameOrBuffer)`

Parse a binary plist file or buffer synchronously.

**Parameters:**
- `fileNameOrBuffer` - File path (string) or Buffer

**Returns:** `PlistValue[]`

### `parseBuffer(buffer)`

Parse a binary plist buffer.

**Parameters:**
- `buffer` - Buffer containing binary plist data

**Returns:** `PlistValue[]`

### Types

The parser returns values that can be:
- `null`
- `boolean`
- `number`
- `bigint` (for 64-bit integers)
- `string`
- `Date`
- `Buffer` (for binary data)
- `UID` (for UID objects)
- `Array<PlistValue>`
- `{ [key: string]: PlistValue }`

### UID Class

Binary plists can contain UID references. These are represented as:

```typescript
class UID {
  UID: number;
  constructor(id: number);
}
```

Example:
```typescript
const [plist] = await parseFile('archived.plist');
// plist might contain: { $top: { root: { UID: 1 } } }
```

## Configuration

You can adjust memory limits if needed:

```typescript
import { maxObjectSize, maxObjectCount } from 'bplist';

// Adjust limits (use with caution)
maxObjectSize = 200 * 1000 * 1000; // 200MB
maxObjectCount = 65536; // Max number of objects
```

## Original Authors

- **Joe Ferner** - Original bplist-parser implementation
- **Brett Zamir** - Contributor

## Modernization

- **qwerzl** - TypeScript rewrite and modernization

## License

MIT License

Copyright (c) 2012 Near Infinity Corporation

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.