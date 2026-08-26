'use strict';
const ctx = require('../lib/context');
const usage = require('../lib/usage');

module.exports = function registerUsage(app) {
  app.get('/api/usage', (req, res) => {
    res.json(usage.usageSummary(ctx.store, {
      range: req.query.range,
      offsetMinutes: req.query.offset,
      projectId: req.query.projectId,
    }));
  });
};
