import type { ArchivedValue, CClass, Unarchiver } from "../archiver";
import { buildStructEncoding } from "../encodings";

// biome-ignore lint/complexity/noStaticOnlyClass: abstract base class used for instanceof checks
export abstract class KnownArchivedObject {
	static archivedName: string;
	static consumeEnd: boolean;
	static initFromUnarchiver(
		_unarchiver: Unarchiver,
		_archivedClass: CClass,
	): KnownArchivedObject {
		throw new Error("Method not implemented");
	}
}

export interface KnownArchivedObjectDerived {
	archivedName: string;
	consumeEnd: boolean;
	initFromUnarchiver(
		unarchiver: Unarchiver,
		archivedClass: CClass,
	): KnownArchivedObject;
}
export const archivedClassesByName = new Map<
	string,
	KnownArchivedObjectDerived
>();

export function archivedClass(archivedName: string, consumeEnd = false) {
	return (target: KnownArchivedObjectDerived) => {
		target.archivedName = archivedName;
		target.consumeEnd = consumeEnd;
		archivedClassesByName.set(archivedName, target);
	};
}

export abstract class KnownStruct {
	static structName: string;
	static fieldEncodings: string[];
	static encoding: string;
	protected constructor(_fields: ArchivedValue[]) {}
}

export type KnownStructDerived = {
	new (fields: ArchivedValue[]): KnownStruct;
} & typeof KnownStruct;
export const structClassesByEncoding = new Map<string, KnownStructDerived>();

export function structClass(structName: string, fieldEncodings: string[]) {
	return (target: KnownStructDerived) => {
		target.structName = structName;
		target.fieldEncodings = fieldEncodings;
		target.encoding = buildStructEncoding(fieldEncodings, structName);
		structClassesByEncoding.set(target.encoding, target);
	};
}
