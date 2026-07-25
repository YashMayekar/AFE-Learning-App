import fs from 'fs';

/**
 * Parses a local MKV (Matroska/WebM) file to read its duration in seconds.
 * Reads the EBML header and Segment→Info→Duration element.
 * Lightweight: only reads the first ~64KB of the file.
 */
export function getMkvDuration(filePath: string): number {
    if (!fs.existsSync(filePath)) {
        console.warn(`[MKVParser] File not found: ${filePath}`);
        return 0;
    }

    const fd = fs.openSync(filePath, 'r');
    try {
        // Read first 64KB — Segment Info with Duration is almost always within this range
        const bufSize = Math.min(fs.fstatSync(fd).size, 65536);
        const buf = Buffer.alloc(bufSize);
        fs.readSync(fd, buf, 0, bufSize, 0);

        // EBML Element IDs we care about
        const SEGMENT_ID = 0x18538067;
        const INFO_ID = 0x1549A966;
        const DURATION_ID = 0x4489;
        const TIMECODE_SCALE_ID = 0x2AD7B1;

        let timecodeScale = 1000000; // default 1ms
        let durationValue = 0;

        // Parse EBML variable-length integer (VINT)
        function readVINT(offset: number): { value: number; length: number } | null {
            if (offset >= buf.length) return null;
            const firstByte = buf[offset];
            if (firstByte === 0) return null;

            let length = 1;
            let mask = 0x80;
            while (length <= 8 && (firstByte & mask) === 0) {
                length++;
                mask >>= 1;
            }
            if (length > 8 || offset + length > buf.length) return null;

            let value = firstByte & (mask - 1);
            for (let i = 1; i < length; i++) {
                value = (value * 256) + buf[offset + i];
            }
            return { value, length };
        }

        // Read an EBML Element ID (variable length, 1-4 bytes)
        function readElementID(offset: number): { id: number; length: number } | null {
            if (offset >= buf.length) return null;
            const firstByte = buf[offset];
            if (firstByte === 0) return null;

            let length = 1;
            if ((firstByte & 0x80) !== 0) length = 1;
            else if ((firstByte & 0x40) !== 0) length = 2;
            else if ((firstByte & 0x20) !== 0) length = 3;
            else if ((firstByte & 0x10) !== 0) length = 4;
            else return null;

            if (offset + length > buf.length) return null;

            let id = 0;
            for (let i = 0; i < length; i++) {
                id = (id * 256) + buf[offset + i];
            }
            return { id, length };
        }

        // Scan through EBML elements looking for Segment→Info→Duration
        function scanElements(offset: number, endOffset: number, depth: number): boolean {
            while (offset + 2 < endOffset && offset < buf.length) {
                const elemId = readElementID(offset);
                if (!elemId || elemId.length === 0) break;

                const sizeResult = readVINT(offset + elemId.length);
                if (!sizeResult) break;

                const dataOffset = offset + elemId.length + sizeResult.length;
                const dataSize = sizeResult.value;

                // Check for "unknown" size (all 1s) - treat as container that extends to end
                const maxVintValue = (1 << (7 * sizeResult.length)) - 1;
                const isUnknownSize = dataSize === maxVintValue;

                if (elemId.id === SEGMENT_ID) {
                    // Segment is a container — recurse into it
                    const segEnd = isUnknownSize ? endOffset : Math.min(dataOffset + dataSize, endOffset);
                    if (scanElements(dataOffset, segEnd, depth + 1)) return true;
                } else if (elemId.id === INFO_ID) {
                    // Info is a container — recurse into it  
                    const infoEnd = isUnknownSize ? endOffset : Math.min(dataOffset + dataSize, endOffset);
                    if (scanElements(dataOffset, infoEnd, depth + 1)) return true;
                } else if (elemId.id === TIMECODE_SCALE_ID) {
                    // TimecodeScale: unsigned integer
                    if (dataSize <= 8 && dataOffset + dataSize <= buf.length) {
                        timecodeScale = 0;
                        for (let i = 0; i < dataSize; i++) {
                            timecodeScale = (timecodeScale * 256) + buf[dataOffset + i];
                        }
                    }
                } else if (elemId.id === DURATION_ID) {
                    // Duration: float (4 or 8 bytes)
                    if (dataOffset + dataSize <= buf.length) {
                        if (dataSize === 4) {
                            durationValue = buf.readFloatBE(dataOffset);
                        } else if (dataSize === 8) {
                            durationValue = buf.readDoubleBE(dataOffset);
                        }
                        return true; // Found it
                    }
                }

                if (isUnknownSize) break;
                offset = dataOffset + dataSize;
            }
            return false;
        }

        scanElements(0, bufSize, 0);

        if (durationValue > 0) {
            // Duration is in timecodeScale units. Convert to seconds.
            const durationSeconds = (durationValue * timecodeScale) / 1e9;
            return durationSeconds;
        }

        return 0;
    } catch (err) {
        console.error(`[MKVParser] Error parsing ${filePath}:`, err);
        return 0;
    } finally {
        fs.closeSync(fd);
    }
}
