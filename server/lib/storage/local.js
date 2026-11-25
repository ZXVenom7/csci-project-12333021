'use strict';

const fs = require('fs/promises');
const path = require('path');

/** Stores files on the server's disk. For local development and VPS hosting. */
function createLocalStorage({ localDir }) {
  function resolve(key) {
    const target = path.resolve(localDir, key);
    if (!target.startsWith(localDir + path.sep)) throw new Error('Invalid storage key');
    return target;
  }
  return {
    driver: 'local',
    localDir,
    async put(key, buffer) {
      const target = resolve(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
    },
    async remove(key) {
      await fs.rm(resolve(key), { force: true });
    },
    publicUrl(key) {
      return `/uploads/${key}`;
    },
  };
}

module.exports = { createLocalStorage };
