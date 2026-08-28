"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const path = require('path');
function readPackageVersion() {
    const candidates = [
        path.join(__dirname, '..', 'package.json'),
        path.join(__dirname, '..', '..', 'package.json'),
    ];
    for (const file of candidates) {
        try {
            const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (pkg.version)
                return pkg.version;
        }
        catch {
            // Source and compiled builds have different __dirname depths.
        }
    }
    return '0.0.0';
}
function safeId(value, label = 'id') {
    const id = String(value || '').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)) {
        throw new Error(`invalid ${label}`);
    }
    return id;
}
module.exports = { readPackageVersion, safeId };
//# sourceMappingURL=catalog.js.map