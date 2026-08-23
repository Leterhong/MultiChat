'use strict';

// MCP servers are managed independently from skills and plugins. Tool schemas
// are discovered from the live server via tools/list.
const extensions = require('../extensions/manager');

module.exports = function registerMcpServers(app) {
  app.get('/api/mcp-servers', (req, res, next) => {
    try { res.json(extensions.listMcpServers()); } catch (error) { next(error); }
  });

  app.post('/api/mcp-servers', (req, res, next) => {
    try { res.status(201).json(extensions.createMcpServer(req.body || {})); }
    catch (error) { next(error); }
  });

  app.put('/api/mcp-servers/:id', (req, res, next) => {
    try { res.json(extensions.updateMcpServer(req.params.id, req.body || {})); }
    catch (error) { next(error); }
  });

  app.delete('/api/mcp-servers/:id', (req, res, next) => {
    try { res.json(extensions.deleteMcpServer(req.params.id)); }
    catch (error) { next(error); }
  });

  app.post('/api/mcp-servers/:id/discover', async (req, res, next) => {
    try { res.json(await extensions.discoverMcpTools(req.params.id, true)); }
    catch (error) { next(error); }
  });

  app.post('/api/mcp-servers/sync/codex', (req, res, next) => {
    try { res.json(extensions.syncCodexMcpConfig()); }
    catch (error) { next(error); }
  });
};
