import fs from 'fs';

/**
 * Parses a local MP4 file to read its duration in seconds.
 * Scans top-level atoms and parses the movie header (mvhd) in moov.
 * Extremely lightweight and does not load full video contents.
 */
export function getMp4Duration(filePath: string): number {
    if (!fs.existsSync(filePath)) {
        console.warn(`[MP4Parser] File not found: ${filePath}`);
        return 0;
    }
    const fd = fs.openSync(filePath, 'r');
    try {
        const fileInfo = fs.fstatSync(fd);
        const fileSize = fileInfo.size;
        
        function readAtom(offset: number, endOffset: number): { duration: number } | null {
            let current = offset;
            const header = Buffer.alloc(8);
            
            while (current + 8 <= endOffset) {
                fs.readSync(fd, header, 0, 8, current);
                const size = header.readUInt32BE(0);
                const type = header.toString('ascii', 4, 8);
                
                if (size === 0) {
                    // Extends to end of file
                    break;
                }
                
                let atomSize = size;
                let headerSize = 8;
                if (size === 1) {
                    const largeSizeBuf = Buffer.alloc(8);
                    fs.readSync(fd, largeSizeBuf, 0, 8, current + 8);
                    // Read 64-bit size
                    atomSize = Number(largeSizeBuf.readBigUInt64BE(0));
                    headerSize = 16;
                }
                
                if (type === 'moov') {
                    const result = readAtom(current + headerSize, current + atomSize);
                    if (result) return result;
                } else if (type === 'mvhd') {
                    // Read mvhd content
                    const mvhdBuf = Buffer.alloc(atomSize - headerSize);
                    fs.readSync(fd, mvhdBuf, 0, mvhdBuf.length, current + headerSize);
                    
                    const version = mvhdBuf.readUInt8(0);
                    let timescale = 0;
                    let duration = 0;
                    
                    if (version === 0) {
                        timescale = mvhdBuf.readUInt32BE(12);
                        duration = mvhdBuf.readUInt32BE(16);
                    } else if (version === 1) {
                        timescale = mvhdBuf.readUInt32BE(20);
                        duration = Number(mvhdBuf.readBigUInt64BE(24));
                    }
                    
                    if (timescale > 0) {
                        return { duration: duration / timescale };
                    }
                }
                
                current += atomSize;
            }
            return null;
        }
        
        const result = readAtom(0, fileSize);
        return result ? result.duration : 0;
    } catch (err) {
        console.error(`[MP4Parser] Error parsing ${filePath}:`, err);
        return 0;
    } finally {
        fs.closeSync(fd);
    }
}
