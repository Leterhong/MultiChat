'use strict';

// Standard Agent Skills API. Skills are real directories with SKILL.md; this
// route never accepts executable MCP configuration and exposes no direct
// execution endpoint.
const extensions = require('../extensions/manager');

module.exports = function registerSkills(app) {
  app.get('/api/skills', (req, res, next) => {
    try { res.json(extensions.listSkills()); } catch (error) { next(error); }
  });

  app.get('/api/skills/:id', (req, res, next) => {
    try {
      res.json(extensions.findSkill(req.params.id));
    } catch (error) { next(error); }
  });

  app.get('/api/skills/:id/diff', (req, res, next) => {
    try {
      const item = extensions.findSkill(req.params.id);
      res.json(extensions.gitDiff(item.path));
    } catch (error) { next(error); }
  });

  app.post('/api/skills', (req, res, next) => {
    try { res.status(201).json(extensions.createSkill(req.body || {})); }
    catch (error) { next(error); }
  });

  app.put('/api/skills/:id', (req, res, next) => {
    try {
      const body = req.body || {};
      if (Object.keys(body).every(key => key === 'enabled')) {
        return res.json(extensions.setSkillEnabled(req.params.id, body.enabled !== false));
      }
      const item = extensions.updateSkill(req.params.id, body);
      if (body.enabled !== undefined) extensions.setSkillEnabled(req.params.id, body.enabled !== false);
      res.json(item);
    } catch (error) { next(error); }
  });

  app.post('/api/skills/:id/toggle', (req, res, next) => {
    try { res.json(extensions.setSkillEnabled(req.params.id, req.body?.enabled !== false)); }
    catch (error) { next(error); }
  });

  app.delete('/api/skills/:id', (req, res, next) => {
    try { res.json(extensions.deleteSkill(req.params.id)); }
    catch (error) { next(error); }
  });
};
