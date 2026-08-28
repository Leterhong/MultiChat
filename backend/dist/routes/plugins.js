'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Plugins are packages discovered through repo/managed marketplace.json files.
// Their components are referenced in place; they are never flattened into
// skills.json or agents.json.
const extensions = require('../extensions/manager');
module.exports = function registerPlugins(app) {
    app.get('/api/plugins', (req, res, next) => {
        try {
            res.json(extensions.listPlugins());
        }
        catch (error) {
            next(error);
        }
    });
    app.get('/api/plugins/:id/diff', (req, res, next) => {
        try {
            res.json(extensions.pluginDiff(req.params.id));
        }
        catch (error) {
            next(error);
        }
    });
    app.post('/api/plugins/:id/toggle', (req, res, next) => {
        try {
            res.json(extensions.setPluginEnabled(req.params.id, req.body?.enabled !== false));
        }
        catch (error) {
            next(error);
        }
    });
    app.delete('/api/plugins/:id', (req, res, next) => {
        try {
            res.json(extensions.deleteImportedPlugin(req.params.id));
        }
        catch (error) {
            next(error);
        }
    });
};
//# sourceMappingURL=plugins.js.map