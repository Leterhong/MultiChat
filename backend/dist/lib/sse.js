"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** Incremental WHATWG-style SSE decoder for arbitrarily split byte chunks. */
class SSEDecoder {
    buffer = '';
    push(chunk) {
        this.buffer += String(chunk || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const events = [];
        let boundary = this.buffer.indexOf('\n\n');
        while (boundary >= 0) {
            const block = this.buffer.slice(0, boundary);
            this.buffer = this.buffer.slice(boundary + 2);
            const data = this.dataFrom(block);
            if (data !== null)
                events.push(`data: ${data}`);
            boundary = this.buffer.indexOf('\n\n');
        }
        return events;
    }
    flush() {
        const block = this.buffer;
        this.buffer = '';
        const data = this.dataFrom(block);
        return data === null ? [] : [`data: ${data}`];
    }
    dataFrom(block) {
        if (!block.trim())
            return null;
        const values = [];
        for (const line of block.split('\n')) {
            if (!line || line.startsWith(':'))
                continue;
            const separator = line.indexOf(':');
            const field = separator < 0 ? line : line.slice(0, separator);
            if (field !== 'data')
                continue;
            let value = separator < 0 ? '' : line.slice(separator + 1);
            if (value.startsWith(' '))
                value = value.slice(1);
            values.push(value);
        }
        return values.length ? values.join('\n') : null;
    }
}
module.exports = { SSEDecoder };
//# sourceMappingURL=sse.js.map