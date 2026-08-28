'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const importer = require('../extensions/importer');
module.exports = function registerExtensionImport(app) {
    app.post('/api/extensions/import/:kind/inspect', (req, res, next) => {
        try {
            res.json(importer.inspect(req.params.kind, req.body || {}));
        }
        catch (error) {
            next(error);
        }
    });
    app.post('/api/extensions/import/:kind/install', (req, res, next) => {
        try {
            res.status(201).json(importer.install(req.params.kind, req.body || {}));
        }
        catch (error) {
            next(error);
        }
    });
};
//# sourceMappingURL=extensions-import.js.map