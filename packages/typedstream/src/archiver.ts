import { AssertionError } from "node:assert";
import {
	allEncodingsMatchExpected,
	buildArrayEncoding,
	parseArrayEncoding,
	parseStructEncoding,
} from "./encodings";
import {
	Atom,
	BeginArray,
	BeginObject,
	BeginStruct,
	BeginTypedValues,
	ByteArray,
	CString,
	EndArray,
	EndObject,
	EndStruct,
	EndTypedValues,
	InvalidTypedStreamError,
	ObjectReference,
	Selector,
	SingleClass,
	TypedStreamReader,
} from "./stream";
import {
	archivedClassesByName,
	type KnownArchivedObject,
	type KnownStruct,
	structClassesByEncoding,
} from "./types/known_types";
// import all objc classes to register them
import "./types/foundation";
import { BPlistReader } from "./bplist";

type StreamEvent =
	| Atom
	| BeginArray
	| BeginObject
	| BeginStruct
	| BeginTypedValues
	| ByteArray
	| CString
	| EndArray
	| EndObject
	| EndStruct
	| EndTypedValues
	| ObjectReference
	| Selector
	| SingleClass;

export type ArchivedValue =
	| null
	| undefined
	| number
	| string
	| Buffer
	| CClass
	| CArray
	| GenericArchivedObject
	| KnownArchivedObject
	| GenericStruct
	| KnownStruct;

export class TypedGroup {
	encodings: Array<string>;
	values: Array<ArchivedValue>;
	constructor(encodings: Array<string>, values: Array<ArchivedValue>) {
		this.encodings = encodings;
		this.values = values;
	}
}

export class TypedValue extends TypedGroup {
	get encoding(): string {
		return this.encodings[0];
	}
	get value(): ArchivedValue {
		return this.values[0];
	}
	constructor(encoding: string, value: ArchivedValue) {
		super([encoding], [value]);
	}
}

export class CArray {
	elements: Array<ArchivedValue>;
	constructor(elements: Array<ArchivedValue>) {
		this.elements = elements;
	}
}

export class CClass {
	name: string;
	version: number;
	superclass?: CClass;
	constructor(name: string, version: number, superclass?: CClass) {
		this.name = name;
		this.version = version;
		this.superclass = superclass;
	}
}

export class GenericArchivedObject {
	clazz: CClass;
	contents: TypedGroup[];
	constructor(clazz: CClass, contents: TypedGroup[]) {
		this.clazz = clazz;
		this.contents = contents;
	}
}

export class GenericStruct {
	name?: string;
	fields: ArchivedValue[];
	constructor(fields: ArchivedValue[], name?: string) {
		this.name = name;
		this.fields = fields;
	}
}

class NO_LOOKAHEAD {}

export class Unarchiver {
	reader: TypedStreamReader | BPlistReader;
	binaryDecoding: Unarchiver.BinaryDecoding;
	private sharedObjectTable: Array<[ObjectReference.Type, ArchivedValue]> = [];

	constructor(
		reader: TypedStreamReader | BPlistReader,
		binaryDecoding = Unarchiver.BinaryDecoding.all,
	) {
		this.reader = reader;
		this.binaryDecoding = binaryDecoding;
	}

	static open(
		data: Buffer,
		binaryDecoding = Unarchiver.BinaryDecoding.all,
	): Unarchiver {
		try {
			return new Unarchiver(new TypedStreamReader(data), binaryDecoding);
		} catch (e: unknown) {
			if (e instanceof InvalidTypedStreamError) {
				return new Unarchiver(new BPlistReader(data), binaryDecoding);
			}
			throw e;
		}
	}

	private lookupReference(ref: ObjectReference): ArchivedValue {
		const [refType, obj] = this.sharedObjectTable[ref.number];
		if (ref.referencedType !== refType) {
			throw new EvalError(
				`Object reference type mismatch: reference should point to an object of type ${ref.referencedType}`,
			);
		}
		return obj;
	}

	decodeAnyUntypedValue(expectedEncoding: string): ArchivedValue {
		if (this.reader instanceof BPlistReader) {
			throw new Error("Operation not supported for datatype bplist");
		}
		const first = this.reader.next().value;

		if (
			first == null ||
			["number", "string"].includes(typeof first) ||
			first instanceof Buffer
		) {
			return first as null | number | string | Buffer;
		} else if (first instanceof ObjectReference) {
			return this.lookupReference(first);
		} else if (first instanceof CString) {
			const str = first.contents.toString("ascii");
			this.sharedObjectTable.push([
				ObjectReference.Type.C_STRING,
				str,
			]);
			return str;
		} else if (first instanceof Atom) {
			return first.contents;
		} else if (first instanceof Selector) {
			return first.name;
		} else if (first instanceof SingleClass) {
			// Read the superclass chain until (and including) the terminating Nil or reference.
			const singleClasses = [first];
			let nextClassEvent = this.reader.next().value;
			while (
				nextClassEvent !== undefined &&
				!(nextClassEvent instanceof ObjectReference)
			) {
				if (!(nextClassEvent instanceof SingleClass)) {
					throw new EvalError(
						`Expected SingleClass, ObjectReference, or undefined, not ${typeof nextClassEvent}`,
					);
				}
				singleClasses.push(nextClassEvent);
				nextClassEvent = this.reader.next().value;
			}

			// Resolve the possibly Nil superclass of the last literally stored class.
			const terminatingEvent = nextClassEvent;
			let nextSuperclass: CClass | undefined;
			if (terminatingEvent == null) {
				nextSuperclass = undefined;
			} else if (terminatingEvent instanceof ObjectReference) {
				nextSuperclass = this.lookupReference(terminatingEvent) as
					| CClass
					| undefined;
			} else {
				throw new AssertionError();
			}

			// Convert the SingleClass events from the stream into Class objects with a superclass.
			// (The terminating Nil or reference is not included in this list,
			// so that it doesn't get an object number assigned.)
			// This list is built up backwards,
			// because of how the SingleClass objects are stored in the stream -
			// each class is stored *before* its superclass,
			// but each Class object can only be constructed *after* its superclass Class has been constructed/looked up.
			// So we iterate over the SingleClass events in reverse order,
			// and store the Class objects in reverse order of construction,
			// so that in the end new_classes matches the order stored in the stream.
			const newClasses: CClass[] = [];
			for (const singleClass of singleClasses.reverse()) {
				nextSuperclass = new CClass(
					singleClass.name,
					singleClass.version,
					nextSuperclass,
				);
				newClasses.splice(0, 0, nextSuperclass);
			}

			// Object numbers for classes are assigned in the same order as they are stored in the stream.
			for (const newClass of newClasses) {
				this.sharedObjectTable.push([ObjectReference.Type.CLASS, newClass]);
			}

			const result = newClasses.at(0);
			if (result == null) throw new AssertionError();
			return result;
		} else if (first instanceof BeginObject) {
			// The object's number is assigned *before* its class information is read,
			// but at this point we can't create the object yet
			// (because we don't know its class),
			// so insert a placeholder value for now.
			// This placeholder value is only used to make object number assignments happen in the right order.
			// It's never used when actually looking up a reference,
			// because it's replaced immediately after the class information is fully read,
			// and the class information can only contain references to other classes and not objects.
			const placeholderIndex = this.sharedObjectTable.length;
			this.sharedObjectTable.push([ObjectReference.Type.OBJECT, undefined]);

			const archivedClass = this.decodeAnyUntypedValue("#");
			if (!(archivedClass instanceof CClass)) {
				throw new EvalError(
					`Object class must be a CClass, not ${typeof archivedClass}`,
				);
			}

			// Create the object.
			// Try to look up a known custom Python class for the archived class and create an instance of it.
			// If no custom class is known for the archived class,
			// create a generic object instead.

			const obj: GenericArchivedObject | KnownArchivedObject =
				archivedClassesByName
					.get(archivedClass.name)
					?.initFromUnarchiver(this, archivedClass) ??
				new GenericArchivedObject(archivedClass, []);

			// Now that the object is created,
			// replace the placeholder in the shared object table with the real object.
			this.sharedObjectTable[placeholderIndex] = [
				ObjectReference.Type.OBJECT,
				obj,
			];

			if (obj instanceof GenericArchivedObject) {
				let nextEvent = this.reader.next().value;
				while (!(nextEvent instanceof EndObject)) {
					obj.contents.push(this.decodeTypedValues(nextEvent));
					nextEvent = this.reader.next().value;
				}
			} else {
				if (!archivedClassesByName.get(archivedClass.name)?.consumeEnd) {
					const end = this.reader.next().value;
					if (!(end instanceof EndObject)) {
						throw new EvalError(
							`Expected EndObject, not ${end?.constructor.name}`,
						);
					}
				}
			}

			return obj;
		} else if (first instanceof ByteArray) {
			return new CArray([...first.data]);
		} else if (first instanceof BeginArray) {
			const expectedElementEncoding =
				parseArrayEncoding(expectedEncoding).elementTypeEncoding;
			// I really want a more idiomatic way to do this
			const decodedArray = [];
			for (let i = 0; i < first.length; i++) {
				decodedArray.push(this.decodeAnyUntypedValue(expectedElementEncoding));
			}
			const array: CArray = new CArray(decodedArray);

			const end = this.reader.next().value;
			if (!(end instanceof EndArray)) {
				throw new EvalError(`Expected EndArray, not ${typeof end}`);
			}

			return array;
		} else if (first instanceof BeginStruct) {
			const nodeStructClass = structClassesByEncoding.get(expectedEncoding);
			const expectedFieldEncodings =
				nodeStructClass?.fieldEncodings ??
				parseStructEncoding(expectedEncoding).fieldTypeEncodings;

			const fields = expectedFieldEncodings.map((e) =>
				this.decodeAnyUntypedValue(e),
			);

			const end = this.reader.next().value;
			if (!(end instanceof EndStruct)) {
				throw new EvalError(`Expected EndStruct, not ${typeof end}`);
			}

			if (nodeStructClass == null) {
				return new GenericStruct(fields, first.name);
			} else {
				return new nodeStructClass(fields);
			}
		} else {
			throw new EvalError(
				`Unexpected event at beginning of untyped value: ${first.constructor.name}`,
			);
		}
	}

	decodeTypedValues(
		lookahead: NO_LOOKAHEAD | StreamEvent = new NO_LOOKAHEAD(),
	) {
		if (this.reader instanceof BPlistReader) {
			throw new Error("Operation not supported for datatype bplist");
		}
		const begin =
			lookahead instanceof NO_LOOKAHEAD ? this.reader.next().value : lookahead;

		if (!(begin instanceof BeginTypedValues)) {
			throw new EvalError(
				`Expected BeginTypeValues, not ${begin?.constructor.name}`,
			);
		}

		// Single typed values are quite common,
		// so use a special subclass that's more convenient to use.
		const ret: TypedGroup =
			begin.encodings.length === 1
				? new TypedValue(
						begin.encodings[0],
						this.decodeAnyUntypedValue(begin.encodings[0]),
					)
				: new TypedGroup(
						begin.encodings,
						begin.encodings.map((e) => this.decodeAnyUntypedValue(e)),
					);

		const end = this.reader.next().value;
		if (!(end instanceof EndTypedValues)) {
			throw new EvalError(`Expected EndTypedValues, not ${typeof end}`);
		}

		return ret;
	}

	decodeValuesOfTypes(typeEncodings: string[]): ArchivedValue[] {
		if (typeEncodings.length === 0) {
			throw new TypeError("Expected at least one type encoding");
		}

		const group = this.decodeTypedValues();

		if (!allEncodingsMatchExpected(group.encodings, typeEncodings)) {
			throw new EvalError(
				`Expected type encodings ${typeEncodings}, but got type encodings ${group.encodings} in stream`,
			);
		}

		return group.values;
	}

	decodeValueOfType(typeEncoding: string) {
		return this.decodeValuesOfTypes([typeEncoding])[0];
	}

	decodeArray(elementTypeEncoding: string, length: number): CArray {
		return this.decodeValueOfType(
			buildArrayEncoding(length, elementTypeEncoding),
		) as CArray;
	}

	decodeDataObject() {
		const length = this.decodeValueOfType("i");
		if (typeof length !== "number" || length < 0) {
			throw new EvalError(`Data object length cannot be negative: ${length}`);
		}
		const dataArray = this.decodeArray("c", length);
		//TODO check array type
		return dataArray.elements;
	}

	decodeAll() {
		if (this.reader instanceof BPlistReader) {
			return this.reader.read();
		} else {
			const contents = [];

			while (true) {
				const lookahead = this.reader.next();
				if (lookahead.done) {
					break;
				}
				contents.push(this.decodeTypedValues(lookahead.value));
			}

			return contents;
		}
	}

	decodeSingleRoot() {
		const values = this.decodeAll();

		if (values.length === 0) {
			throw new EvalError("Archive contains no values");
		} else if (values.length > 1) {
			throw new EvalError(
				`Archive contains ${values.length} root values (expected exactly one root value)`,
			);
		} else {
			const rootGroup = values[0];
			if (rootGroup instanceof TypedValue) {
				return rootGroup.value;
			}
			if (rootGroup instanceof TypedGroup) {
				throw new EvalError(
					`Archive's root value is a group of ${rootGroup.values.length} values (expected exactly one root value)`,
				);
			}
			// For bplist data, return the root value directly
			return rootGroup;
		}
	}
}

export namespace Unarchiver {
	export enum BinaryDecoding {
		all,
		decodable,
		none,
	}
}
