
'use strict';

const fs = require('fs-extra');
const path = require('path');
const uuid = require('uuid');
const tempDir = require('temp-dir');

const { red } = require('colors');
const { detectTmpDir } = require('../tpl');

async function ensureTmpDir(tmpDir, tplPath, serviceName, functionName) {

  const absTmpDir = tmpDir ? path.resolve(tmpDir) : path.resolve(detectTmpDir(tplPath), serviceName, functionName);

  if (await fs.pathExists(absTmpDir)) {

    const stats = await fs.lstat(absTmpDir);

    if (stats.isFile()) {
      throw new Error(red(`'${absTmpDir}' should be a directory.`));
    }
  } else {
    await fs.ensureDir(absTmpDir, {
      mode: parseInt('0777', 8)
    });
  }

  return absTmpDir;
}

async function generateRandomZipPath(zipName = 'code.zip') {
  const randomDirName = uuid.v4();
  const randomDir = path.join(tempDir, randomDirName);

  await fs.ensureDir(randomDir);
  const zipPath = path.join(randomDir, zipName);

  return {
    zipPath,
    randomDir
  };
}


const nodejsTgzUrl = {
  nodejs12: {
    url: 'https://fc-docker.oss-cn-shanghai.aliyuncs.com/nodejs12.tgz',
    folder: 'nodejs12',
  },
  nodejs10: {
    url: 'https://my-fc-testt.oss-cn-shanghai.aliyuncs.com/nodejs10.tgz',
    folder: 'nodejs10',
  },
  nodejs8: {
    url: 'https://my-fc-testt.oss-cn-shanghai.aliyuncs.com/nodejs6.tgz',
    folder: 'nodejs6',
  },
  nodejs6: {
    url: 'https://my-fc-testt.oss-cn-shanghai.aliyuncs.com/nodejs6.tgz',
    folder: 'nodejs6',
  },
}

module.exports = { ensureTmpDir, generateRandomZipPath, nodejsTgzUrl };