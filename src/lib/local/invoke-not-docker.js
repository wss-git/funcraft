const fs = require('fs')
const fse = require('fs-extra');
const os = require('os')
const iconv = require('iconv-lite')
const path = require('path');
const { execSync, spawnSync, spawn, exec } = require('child_process');
const { extractZipTo } = require('../package/zip')
const request = require('request');
const uuid = require('uuid');

// const url="http://localhost:9000/invoke";
const url="http://[::1]:9000/invoke";

async function downloadFile({ runtime }) {
  const configDir = path.join(process.env.HOME || os.homedir(), '.fcli');
  const filename = `${runtime}.zip`;
  const endFileName = `${configDir}/${filename}`;

  if (!fs.existsSync(`${configDir}/${runtime}/src/server.js`)) {
    await new Promise(r => {
      const rs = fs.createReadStream(path.join(__dirname, `../../runtimeServer/${filename}`));
      const ws = fs.createWriteStream(endFileName);
      rs.pipe(ws);
      rs.on('end', () => {
        ws.end();
        r();
      })
    });
    try {
      await extractZipTo(endFileName, configDir);
    } catch(e) {
      await fse.remove(endFileName);
      throw `Unzip ${endFileName} error`
    }
    await fse.remove(endFileName);
  }
}


async function httprequest(env, event = '', callback) {
  const {
    FC_MEMORY_SIZE = 128,
    FC_TIMEOUT,
    FC_FUNCTION_NAME,
    FC_HANDLER = 'index.handler',
    FC_INITIALIZATIONIMEOUT = 3,
    FC_INITIALIZER = "",
    FC_ACCOUND_ID,
    FC_REGION,
    FC_SERVICE_NAME,
    FC_ACCESS_KEY_ID,
    FC_ACCESS_KEY_SECRET,
  } = env;

  const headers = {
    "Content-Type": "application/octet-stream",
    "x-fc-request-id": uuid.v4(),
    "x-fc-function-name": FC_FUNCTION_NAME,
    "x-fc-function-memory": FC_MEMORY_SIZE,
    "x-fc-function-timeout": FC_TIMEOUT,
    "x-fc-function-handler": FC_HANDLER,
    "x-fc-initialization-timeout": FC_INITIALIZATIONIMEOUT,
    "x-fc-function-initializer": FC_INITIALIZER,
    "x-fc-account-id": FC_ACCOUND_ID,
    "x-fc-region": FC_REGION,
    "x-fc-service-name": FC_SERVICE_NAME,
    "x-fc-service-logproject": "",
    "x-fc-service-logstore": "",
    "x-fc-access-key-id": FC_ACCESS_KEY_ID,
    "x-fc-access-key-secret": FC_ACCESS_KEY_SECRET,
    "x-fc-security-token": "",
  }

  request({
    url,
    method: "POST",
    headers: headers,
    body: Buffer.from(JSON.stringify(event))
  }, function(error, response, body) {
    if (error) {
      console.log('error::', error);
    } else {
      console.log(body);
    }
    callback(response.body);
  });
}

async function invoke({
  env, codeUri, servicePath, LOG_PATH, event, kill9000Path
}) {
  for(const key in env) {
    if (env[key] && typeof env[key] === 'string') {
      env[key] = env[key].replace(/\\/, '/');
    }
  }
  
  await new Promise(async (r) => {
    const cmdPath = process.platform === 'win32' ? 'node' : '/usr/local/bin/node';
    const bat = spawn(`${cmdPath} ${env.DEBUG_OPTIONS || ''} ${servicePath}`, {
      env: {
        ...process.env,
        FC_SERVER_PORT: 9000,
        FC_SERVER_PATH: codeUri,
        FC_SERVER_LOG_PATH: LOG_PATH,
        FC_SERVER_LOG_LEVEL: 'silly',
        FC_FUNC_CODE_PATH: codeUri,
        FC_FUNC_LOG_PATH: LOG_PATH,
        ...env,
        PATH: process.env.PATH
      },
      encoding: 'buffer',
      shell: true,
    })

    const callback = () => {
      bat.kill();
      r();
      if (process.platform === 'win32') {
        exec(kill9000Path, {
          shell: true,
          encoding: 'buffer',
        });
      }
    }
    
    bat.stderr.on('data', (data) => {
      const buffer = Buffer.from(data);
      const str = iconv.decode(buffer, 'gbk');
      console.log(str);
    });
    
    bat.on('close', (code) => { });
  
    bat.stdout.on('data', (data) => {
      const d = data.toString();
      if (d.includes('-----BEGIN-----')) {
        httprequest(env, event, callback);
      } else {
        console.log(d);
      }
    });
  })
}

module.exports = {
  downloadFile, invoke, httprequest
}
