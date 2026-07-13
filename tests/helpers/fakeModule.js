const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Injects a fake implementation for a require()d module by pre-populating
// Node's module cache with the resolved absolute path. Must be called
// before anything require()s the real module (or a module that requires it).
function fakeModule(relPath, exportsObj) {
  const resolved = require.resolve(path.join(ROOT, relPath));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

module.exports = { fakeModule, ROOT };
