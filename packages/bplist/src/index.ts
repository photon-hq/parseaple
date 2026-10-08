// adapted from https://github.com/3breadt/dd-plist

import fs from "node:fs";

const debug = false;

/** Maximum object size in bytes to prevent heap exhaustion. */
export let maxObjectSize = 100 * 1000 * 1000; // 100Meg
/** Maximum object count allowed in the offset table. */
export let maxObjectCount = 32768;
/** Maximum allowed elements in a single array to prevent unbounded allocation. */
export let maxArrayLength = 1000000; // 1M elements
/** Maximum allowed recursion depth to prevent stack exhaustion. */
export let maxRecursionDepth = 1000;

// EPOCH = new SimpleDateFormat("yyyy MM dd zzz").parse("2001 01 01 GMT").getTime();
// Hardcoded to avoid static initializer exceptions.
const EPOCH = 978307200000;

/**
 * Represents a binary plist UID object.
 */
export class UID {
	UID: number;

	/**
	 * Creates an instance of a UID.
	 *
	 * @param id - The numeric identifier.
	 */
	constructor(id: number) {
		this.UID = id;
	}
}

/**
 * Union type representing all valid primitive and nested plist values.
 */
export type PlistValue =
	| null
	| boolean
	| number
	| bigint
	| string
	| Date
	| Buffer
	| UID
	| PlistValue[]
	| { [key: string]: PlistValue };

/**
 * Callback function type for asynchronous plist parsing.
 */
export type ParseCallback = (err: Error | null, result?: PlistValue[]) => void;

/**
 * Asynchronously parses a binary plist file or Buffer.
 *
 * @param fileNameOrBuffer - File path or raw Buffer containing binary plist data.
 * @param callback - Optional Node-style callback.
 * @returns A promise resolving to the parsed plist elements.
 */
export const parseFile = (
	fileNameOrBuffer: string | Buffer,
	callback?: ParseCallback,
): Promise<PlistValue[]> => {
	return new Promise((resolve, reject) => {
		const tryParseBuffer = (buffer: Buffer) => {
			let err: Error | null = null;
			let result: PlistValue[] | undefined;
			try {
				result = parseBuffer(buffer);
				resolve(result);
			} catch (ex) {
				err = ex as Error;
				reject(err);
			} finally {
				if (callback) callback(err, result);
			}
		};

		if (Buffer.isBuffer(fileNameOrBuffer)) {
			return tryParseBuffer(fileNameOrBuffer);
		}
		fs.readFile(fileNameOrBuffer, (err, data) => {
			if (err) {
				reject(err);
				if (callback) callback(err);
				return;
			}
			tryParseBuffer(data);
		});
	});
};

/**
 * Synchronously parses a binary plist file or Buffer.
 *
 * @param fileNameOrBuffer - File path or raw Buffer containing binary plist data.
 * @returns An array containing the parsed plist elements.
 */
export const parseFileSync = (fileNameOrBuffer: string | Buffer): PlistValue[] => {
	let buffer: Buffer;
	if (!Buffer.isBuffer(fileNameOrBuffer)) {
		buffer = fs.readFileSync(fileNameOrBuffer);
	} else {
		buffer = fileNameOrBuffer;
	}
	return parseBuffer(buffer);
};

/**
 * Parses a binary property list Buffer.
 *
 * @param buffer - Buffer containing the bplist binary payload.
 * @returns An array containing the root parsed plist value.
 */
export const parseBuffer = (buffer: Buffer): PlistValue[] => {
	// Check header
	const header = buffer.subarray(0, "bplist".length).toString("utf8");
	if (header !== "bplist") {
		throw new Error("Invalid binary plist. Expected 'bplist' at offset 0.");
	}

	// Minimum buffer length to contain a valid trailer (32 bytes)
	if (buffer.length < 32) {
		throw new Error("Buffer too small to contain a valid binary plist trailer");
	}

	// Handle trailer, last 32 bytes of the file
	const trailer = buffer.subarray(buffer.length - 32, buffer.length);
	// 6 null bytes (index 0 to 5)
	const offsetSize = trailer.readUInt8(6);
	if (debug) {
		console.log(`offsetSize: ${offsetSize}`);
	}
	const objectRefSize = trailer.readUInt8(7);
	if (debug) {
		console.log(`objectRefSize: ${objectRefSize}`);
	}
	const numObjects = readUInt64BE(trailer, 8);
	if (debug) {
		console.log(`numObjects: ${numObjects}`);
	}
	const topObject = readUInt64BE(trailer, 16);
	if (debug) {
		console.log(`topObject: ${topObject}`);
	}
	const offsetTableOffset = readUInt64BE(trailer, 24);
	if (debug) {
		console.log(`offsetTableOffset: ${offsetTableOffset}`);
	}

	if (numObjects > maxObjectCount) {
		throw new Error("maxObjectCount exceeded");
	}

	// Handle offset table
	const offsetTable: number[] = [];

	for (let i = 0; i < numObjects; i++) {
		const offsetBytes = buffer.subarray(
			offsetTableOffset + i * offsetSize,
			offsetTableOffset + (i + 1) * offsetSize,
		);
		offsetTable[i] = readUInt(offsetBytes, 0);
		if (debug) {
			console.log(
				`Offset for Object #${i} is ${offsetTable[i]} [${offsetTable[i].toString(16)}]`,
			);
		}
	}

	// Parses an object inside the currently parsed binary property list.
	let recursionDepth = 0;

	/**
	 * Recursively parses an object from the offset table.
	 *
	 * @param tableOffset - Index in the offset table.
	 * @returns The parsed PlistValue.
	 */
	const parseObject = (tableOffset: number): PlistValue => {
		if (recursionDepth >= maxRecursionDepth) {
			throw new Error(`Maximum recursion depth (${maxRecursionDepth}) exceeded`);
		}
		recursionDepth++;
		try {
			// Validate table offset is within bounds
			if (tableOffset < 0 || tableOffset >= offsetTable.length) {
				throw new Error(`Object reference ${tableOffset} out of bounds`);
			}
			const offset = offsetTable[tableOffset];
			// Validate byte offset is within buffer bounds
			if (offset < 0 || offset >= buffer.length) {
				throw new Error(`Object offset ${offset} out of bounds`);
			}
			const type = buffer[offset];
			const objType = (type & 0xf0) >> 4; // First 4 bits
			const objInfo = type & 0x0f; // Second 4 bits

			switch (objType) {
				case 0x0:
					return parseSimple();
				case 0x1:
					return parseInteger();
				case 0x8:
					return parseUID();
				case 0x2:
					return parseReal();
				case 0x3:
					return parseDate();
				case 0x4:
					return parseData();
				case 0x5: // ASCII
					return parsePlistString();
				case 0x6: // UTF-16
					return parsePlistString(true);
				case 0xa:
					return parseArray();
				case 0xd:
					return parseDictionary();
				default:
					throw new Error(`Unhandled type 0x${objType.toString(16)}`);
			}

			/**
			 * Parses simple types (null, bool, fill).
			 */
			function parseSimple(): PlistValue {
				switch (objInfo) {
					case 0x0: // null
						return null;
					case 0x8: // false
						return false;
					case 0x9: // true
						return true;
					case 0xf: // filler byte
						return null;
					default:
						throw new Error(`Unhandled simple type 0x${objType.toString(16)}`);
				}
			}

			/**
			 * Converts buffer to hex string with leading zero stripping.
			 */
			function bufferToHexString(buf: Buffer): string {
				let str = "";
				let i: number;
				for (i = 0; i < buf.length; i++) {
					if (buf[i] !== 0x00) {
						break;
					}
				}
				for (; i < buf.length; i++) {
					const part = `00${buf[i].toString(16)}`;
					str += part.substring(part.length - 2);
				}
				return str;
			}

			/**
			 * Parses integer objects (up to 128-bit BigInt).
			 */
			function parseInteger(): number | bigint {
				const length = 2 ** objInfo;
				if (length < maxObjectSize) {
					const data = buffer.subarray(offset + 1, offset + 1 + length);
					if (length === 16) {
						const str = bufferToHexString(data);
						return BigInt(`0x${str}`);
					}
					return data.reduce((acc, curr) => {
						acc <<= 8;
						acc |= curr & 255;
						return acc;
					}, 0);
				}
				throw new Error(
					`Too little heap space available! Wanted to read ${length} bytes, but only ${maxObjectSize} are available.`,
				);
			}

			/**
			 * Parses binary plist UID objects.
			 */
			function parseUID(): UID {
				const length = objInfo + 1;
				if (length < maxObjectSize) {
					return new UID(readUInt(buffer.subarray(offset + 1, offset + 1 + length)));
				}
				throw new Error(
					`Too little heap space available! Wanted to read ${length} bytes, but only ${maxObjectSize} are available.`,
				);
			}

			/**
			 * Parses real floating point numbers (float/double).
			 */
			function parseReal(): number {
				const length = 2 ** objInfo;
				if (length < maxObjectSize) {
					const realBuffer = buffer.subarray(offset + 1, offset + 1 + length);
					if (length === 4) {
						return realBuffer.readFloatBE(0);
					}
					if (length === 8) {
						return realBuffer.readDoubleBE(0);
					}
				}
				throw new Error(
					`Too little heap space available! Wanted to read ${length} bytes, but only ${maxObjectSize} are available.`,
				);
			}

			/**
			 * Parses date objects relative to Mac OS X epoch.
			 */
			function parseDate(): Date {
				if (objInfo !== 0x3) {
					console.error(`Unknown date type :${objInfo}. Parsing anyway...`);
				}
				const dateBuffer = buffer.subarray(offset + 1, offset + 9);
				return new Date(EPOCH + 1000 * dateBuffer.readDoubleBE(0));
			}

			/**
			 * Parses raw byte data blocks.
			 */
			function parseData(): Buffer {
				let dataoffset = 1;
				let length = objInfo;
				if (objInfo === 0xf) {
					const int_type = buffer[offset + 1];
					const intType = (int_type & 0xf0) / 0x10;
					if (intType !== 0x1) {
						console.error(`0x4: UNEXPECTED LENGTH-INT TYPE! ${intType}`);
					}
					const intInfo = int_type & 0x0f;
					const intLength = 2 ** intInfo;
					dataoffset = 2 + intLength;
					length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
				}
				if (length < maxObjectSize) {
					return buffer.subarray(offset + dataoffset, offset + dataoffset + length);
				}
				throw new Error(
					`Too little heap space available! Wanted to read ${length} bytes, but only ${maxObjectSize} are available.`,
				);
			}

			/**
			 * Parses ASCII or UTF-16 encoded strings.
			 */
			function parsePlistString(isUtf16 = false): string {
				let enc: BufferEncoding = "utf8";
				let length = objInfo;
				let stroffset = 1;
				if (objInfo === 0xf) {
					const int_type = buffer[offset + 1];
					const intType = (int_type & 0xf0) / 0x10;
					if (intType !== 0x1) {
						console.error(`UNEXPECTED LENGTH-INT TYPE! ${intType}`);
					}
					const intInfo = int_type & 0x0f;
					const intLength = 2 ** intInfo;
					stroffset = 2 + intLength;
					length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
				}
				// length is String character count -> multiply by 2 for UTF-16 byte length
				length *= isUtf16 ? 2 : 1;
				if (length < maxObjectSize) {
					let plistString = buffer.subarray(offset + stroffset, offset + stroffset + length);
					if (isUtf16) {
						plistString = swapBytes(plistString);
						enc = "ucs2";
					}
					return plistString.toString(enc);
				}
				throw new Error(
					`Too little heap space available! Wanted to read ${length} bytes, but only ${maxObjectSize} are available.`,
				);
			}

			/**
			 * Parses array objects and recursively decodes children.
			 */
			function parseArray(): PlistValue[] {
				let length = objInfo;
				let arrayoffset = 1;
				if (objInfo === 0xf) {
					const int_type = buffer[offset + 1];
					const intType = (int_type & 0xf0) / 0x10;
					if (intType !== 0x1) {
						console.error(`0xa: UNEXPECTED LENGTH-INT TYPE! ${intType}`);
					}
					const intInfo = int_type & 0x0f;
					const intLength = 2 ** intInfo;
					arrayoffset = 2 + intLength;
					length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
				}
				// Limit array element count to prevent unbounded memory allocation
				if (length > maxArrayLength) {
					throw new Error(`Array length ${length} exceeds maximum allowed (${maxArrayLength})`);
				}
				// Validate that length references fit within the buffer remaining after the header
				if (length > (buffer.length - (offset + arrayoffset)) / objectRefSize) {
					throw new Error("Array length exceeds available data");
				}
				if (length * objectRefSize > maxObjectSize) {
					throw new Error("Too little heap space available!");
				}
				const array: PlistValue[] = [];
				for (let i = 0; i < length; i++) {
					const objRef = readUInt(
						buffer.subarray(
							offset + arrayoffset + i * objectRefSize,
							offset + arrayoffset + (i + 1) * objectRefSize,
						),
					);
					array[i] = parseObject(objRef);
				}
				return array;
			}

			/**
			 * Parses dictionary key-value mappings.
			 */
			function parseDictionary(): { [key: string]: PlistValue } {
				let length = objInfo;
				let dictoffset = 1;
				if (objInfo === 0xf) {
					const int_type = buffer[offset + 1];
					const intType = (int_type & 0xf0) / 0x10;
					if (intType !== 0x1) {
						console.error(`0xD: UNEXPECTED LENGTH-INT TYPE! ${intType}`);
					}
					const intInfo = int_type & 0x0f;
					const intLength = 2 ** intInfo;
					dictoffset = 2 + intLength;
					length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
				}
				if (length * 2 * objectRefSize > maxObjectSize) {
					throw new Error("Too little heap space available!");
				}
				if (debug) {
					console.log(`Parsing dictionary #${tableOffset}`);
				}
				// Use Object.create(null) to prevent prototype pollution via __proto__ keys
				const dict: { [key: string]: PlistValue } = Object.create(null);
				for (let i = 0; i < length; i++) {
					const keyRef = readUInt(
						buffer.subarray(
							offset + dictoffset + i * objectRefSize,
							offset + dictoffset + (i + 1) * objectRefSize,
						),
					);
					const valRef = readUInt(
						buffer.subarray(
							offset + dictoffset + length * objectRefSize + i * objectRefSize,
							offset + dictoffset + length * objectRefSize + (i + 1) * objectRefSize,
						),
					);
					const key = parseObject(keyRef);
					const val = parseObject(valRef);
					if (debug) {
						console.log(`  DICT #${tableOffset}: Mapped ${key} to ${val}`);
					}
					// Ensure key is a string and not an arbitrary object reference
					if (typeof key === "string") {
						dict[key] = val;
					}
				}
				return dict;
			}
		} finally {
			recursionDepth--;
		}
	};

	return [parseObject(topObject)];
};

/**
 * Reads an unsigned integer from a buffer slice in big-endian byte order.
 *
 * @param buffer - Buffer slice containing integer bytes.
 * @param start - Starting offset in the buffer.
 * @returns Parsed numeric value.
 */
function readUInt(buffer: Buffer, start = 0): number {
	let l = 0;
	for (let i = start; i < buffer.length; i++) {
		l <<= 8;
		l |= buffer[i] & 0xff;
	}
	return l;
}

/**
 * Reads a 64-bit unsigned integer in big-endian order from buffer, discarding high order bits.
 *
 * @param buffer - Buffer containing 64-bit integer bytes.
 * @param start - Starting offset.
 * @returns 32-bit unsigned numeric representation.
 */
function readUInt64BE(buffer: Buffer, start: number): number {
	const data = buffer.subarray(start, start + 8);
	return data.readUInt32BE(4);
}

/**
 * Performs big-endian to little-endian byte swapping for 16-bit word sequences.
 *
 * @param buffer - Input byte buffer.
 * @returns A new Buffer copy with swapped byte pairs.
 */
function swapBytes(buffer: Buffer): Buffer {
	// Create a copy to avoid mutating the original underlying buffer
	const copy = Buffer.from(buffer);
	const len = copy.length;
	for (let i = 0; i < len; i += 2) {
		const a = copy[i];
		copy[i] = copy[i + 1];
		copy[i + 1] = a;
	}
	return copy;
}
