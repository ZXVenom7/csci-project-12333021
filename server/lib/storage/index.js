'use strict';

const { config } = require('../../config');

let storage;

function getStorage() {
  if (!storage) {
    storage = config.storage.driver === 's3'
      ? require('./s3').createS3Storage(config.storage.s3)
      : require('./local').createLocalStorage(config.storage);
  }
  return storage;
}

module.exports = { getStorage };
