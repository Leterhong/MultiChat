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

module.exports = { readPackageVersion, safeId };
