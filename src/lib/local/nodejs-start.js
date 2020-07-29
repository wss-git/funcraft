var AsyncLock = require('async-lock');
var lock = new AsyncLock();
const path = require('path');
const fs = require('fs-extra');
const streams = require('memory-streams');
const { getHttpRawBody, generateHttpParams, parseHttpTriggerHeaders, validateHeader } = require('../local/http');
const docker = require('../docker');
const dockerOpts = require('../docker-opts');
const { validateSignature, parseOutputStream } = require('./http');
const definition = require('../definition');
const extract = require('extract-zip');
const { execSync, spawnSync } = require('child_process');
const { nodejsTgzUrl } = require('../utils/path');

const _ = require('lodash');

function isZipArchive(codeUri) {
  return codeUri.endsWith('.zip') || codeUri.endsWith('.jar') || codeUri.endsWith('.war');
}

async function processZipCodeIfNecessary(codeUri) {

  if (!isZipArchive(codeUri)) { return null; }

  const tmpCodeDir = path.join(tmpDir, uuid.v4());

  await fs.ensureDir(tmpCodeDir);

  console.log(`codeUri is a zip format, will unzipping to ${tmpCodeDir}`);

  return await new Promise((resolve, reject) => {
    // use extract-zip instead of unzipper  https://github.com/alibaba/funcraft/issues/756
    extract(codeUri, { dir: tmpCodeDir }, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(tmpCodeDir);
    });
  });
}

class LocalHttpInvoke {
  constructor(serviceName, serviceRes, functionName, functionRes, debugPort, debugIde, baseDir, tmpDir, authType, endpointPrefix, debuggerPath, debugArgs, nasBaseDir) {
    this.serviceName = serviceName;
    this.serviceRes = serviceRes;
    this.functionName = functionName;
    this.functionRes = functionRes;
    this.functionProps = functionRes.Properties;
    this.debugPort = debugPort;
    this.debugIde = debugIde;
    this.nasBaseDir = nasBaseDir;
    this.endpointPrefix = endpointPrefix;

    this.runtime = this.functionProps.Runtime;
    this.baseDir = baseDir;
    this.codeUri = path.resolve(this.baseDir, this.functionProps.CodeUri);
    this.tmpDir = tmpDir;
    this.debuggerPath = debuggerPath;
    this.debugArgs = debugArgs;
    this.isAnonymous = authType === 'ANONYMOUS' || authType === 'anonymous';

    this.init();
  }

  async init() {
    this.nasConfig = definition.findNasConfigInService(this.serviceRes);
    this.dockerUser = await dockerOpts.resolveDockerUser({ nasConfig: this.nasConfig });
    this.nasMounts = await docker.resolveNasConfigToMounts(this.baseDir, this.serviceName, this.nasConfig, this.nasBaseDir || path.join(this.baseDir, DEFAULT_NAS_PATH_SUFFIX));
    this.unzippedCodeDir = await processZipCodeIfNecessary(this.codeUri);
    this.codeMount = await docker.resolveCodeUriToMount(this.unzippedCodeDir || this.codeUri);
    this.nasMappingsMount = await docker.resolveNasYmlToMount(this.baseDir, this.serviceName);
    this.tmpDirMount = await docker.resolveTmpDirToMount(this.tmpDir);
    this.debuggerMount = await docker.resolveDebuggerPathToMount(this.debuggerPath);
    this.passwdMount = await docker.resolvePasswdMount();

    const allMount = _.compact([this.codeMount, ...this.nasMounts, ...this.nasMappingsMount, this.passwdMount]);

    if (!_.isEmpty(this.tmpDirMount)) {
      allMount.push(this.tmpDirMount);
    }

    if (!_.isEmpty(this.debuggerMount)) {
      allMount.push(this.debuggerMount);
    }

    this.mounts = allMount;

    const shUir = path.resolve(process.cwd(), '.fun');
    execSync(`cp -rf ${path.resolve(__dirname, '../../script/function-compute-mock.sh')} ${shUir}/function-compute-mock.sh && chmod 777 *.sh`, {
      cwd: shUir
    })
  }

  async localInvoke(req, res) {
    await lock.acquire('invoke', async () => {
      const event = await getHttpRawBody(req);

      const httpParams = generateHttpParams(req, this.endpointPrefix);
  
      const envs = await docker.generateDockerEnvs(this.baseDir, this.serviceName, this.serviceRes.Properties, this.functionName, this.functionProps, this.debugPort, httpParams, this.nasConfig, true, this.debugIde);
  
      const cmd = docker.generateDockerCmd(this.functionProps, true, this._invokeInitializer, null);

      if (!this.isAnonymous) {
        if (!await validateSignature(req, res, req.method)) { return; }
      }

      const shUir = path.resolve(process.cwd(), '.fun');
      if (!fs.existsSync(`${shUir}/var/fc/runtime/${nodejsTgzUrl[this.runtime].folder}/agent.sh`)) {
        envs.AGENTDIR = path.resolve(__dirname, '../../script/agent.sh');
        envs.TGZURL = nodejsTgzUrl[this.runtime].url;
      }

      envs.FC_RUNTIME_FOLDER = nodejsTgzUrl[this.runtime].folder;

      if(this.debugPort && this.debugIde) {
        const codeMount = await docker.resolveCodeUriToMount(this.codeUri, false);
        await docker.showDebugIdeTipsForVscode(this.serviceName, this.functionName, this.runtime, codeMount.Source, this.debugPort);
      }

      spawnSync('./.fun/function-compute-mock.sh', cmd, {
        cwd: process.cwd(),
        env: envs,
        stdio: 'inherit'
      })
    });
  }
}


module.exports = LocalHttpInvoke
