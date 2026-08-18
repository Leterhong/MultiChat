const fs = require('fs');
const path = require('path');

function readPackageVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function safeId(value, label = 'id') {
  const id = String(value || '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id)) {
    throw new Error(`invalid ${label}`);
  }
  return id;
}

function normalizePackage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('package must be a JSON object');
  }
  const result = { ...input };
  if (result.id) result.id = safeId(result.id, 'package id');
  if (result.type && !['mcp', 'bundle'].includes(result.type)) {
    throw new Error('package type must be mcp or bundle');
  }
  if (result.skills !== undefined && !Array.isArray(result.skills)) {
    throw new Error('skills must be an array');
  }
  if (result.agents !== undefined && !Array.isArray(result.agents)) {
    throw new Error('agents must be an array');
  }
  if (result.type === 'mcp') {
    if (!result.mcp || typeof result.mcp !== 'object' || typeof result.mcp.command !== 'string' || !Array.isArray(result.mcp.args)) {
      throw new Error('mcp package requires mcp.command and mcp.args');
    }
  }
  return result;
}

module.exports = { readPackageVersion, safeId, normalizePackage };
