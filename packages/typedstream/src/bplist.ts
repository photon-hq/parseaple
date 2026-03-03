import { parseBuffer, type UID } from "@parseaple/bplist";
import { TypedGroup, Unarchiver } from "./archiver";

type BPlistValue =
	| string
	| number
	| bigint
	| boolean
	| null
	| Date
	| Buffer
	| UID
	| TypedGroup
	| BPlistValue[]
	| { [key: string]: BPlistValue };

export class BPlistReader {
	data: Buffer;
	constructor(data: Buffer) {
		this.data = data;
	}
	private nameMap: { [key: string]: string } = {
		ec: "editedContent",
		ep: "editedParts",
		rp: "retractedParts",
		euh: "editingUserHandle",
		bcg: "backwardsCompatibilityGuid",
		d: "date",
		t: "text",
		otr: "originalTextRange",
		amc: "associatedMessageContent",
		ams: "associatedMessageSummary",
	};
	private process(data: BPlistValue): BPlistValue {
		if (Array.isArray(data)) {
			const arr = [];
			for (const el of data) {
				arr.push(this.process(el));
			}
			return arr;
		} else if (data == null) {
			return data;
		} else if (data instanceof Buffer) {
			try {
				const decoded = Unarchiver.open(data).decodeAll();
				if (decoded.length === 1) {
					return decoded[0];
				}
				return decoded;
			} catch {
				return data;
			}
		} else if (data instanceof TypedGroup) {
			return data;
		} else if (typeof data === "object") {
			const obj = data as { [key: string]: BPlistValue };
			const keys = Object.keys(obj);
			if ("0" in obj && !("1" in obj)) {
				return this.process(obj["0"]);
			}
			// ranges
			if ("lo" in obj && "le" in obj && keys.length === 2) {
				return [obj.lo, obj.le];
			}
			for (const key of keys) {
				if (key in this.nameMap) {
					obj[this.nameMap[key]] = obj[key];
					delete obj[key];
					obj[this.nameMap[key]] = this.process(obj[this.nameMap[key]]);
				} else {
					obj[key] = this.process(obj[key]);
				}
			}
			return obj;
		}
		return data;
	}
	read() {
		const data = parseBuffer(this.data);
		this.process(data);
		return data;
	}
}
