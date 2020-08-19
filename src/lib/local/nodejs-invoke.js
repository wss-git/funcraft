'use strict';

const path = require('path');
const { blue } = require('colors');
const docker = require('../docker');
const { generateVscodeDebugConfig } = require('../debug');
const fs = require('fs');
const { execSync, spawnSync, spawn } = require('child_process');
const { nodejsTgzUrl } = require('../utils/path');

const invokeNotDocker = require('./invoke-not-docker');
const os = require('os')

class LocalInvoke {
  constructor(serviceName, serviceRes, functionName, functionRes, debugPort, debugIde, baseDir, tmpDir, debuggerPath, debugArgs, nasBaseDir) {
    this.serviceName = serviceName;
    this.serviceRes = serviceRes;
    this.functionName = functionName;
    this.functionRes = functionRes;
    this.functionProps = functionRes.Properties;
    this.debugPort = debugPort;
    this.debugIde = debugIde;
    this.nasBaseDir = nasBaseDir;

    this.runtime = this.functionProps.Runtime;
    this.baseDir = baseDir;
    this.codeUri = path.resolve(this.baseDir, this.functionProps.CodeUri);
    this.tmpDir = tmpDir;
    this.debuggerPath = debuggerPath;
    this.debugArgs = debugArgs;
  }

  async init(event = '') {
    this.envs = await docker.generateDockerEnvs(this.baseDir, this.serviceName, this.serviceRes.Properties, this.functionName, this.functionProps, this.debugPort, null, this.nasConfig, false, this.debugIde, this.debugArgs);
    this.cmd = docker.generateDockerCmd(this.functionProps, false);
    const isWin = process.platform === 'win32';

    if(this.debugPort && this.debugIde) {
      const codeMount = await docker.resolveCodeUriToMount(this.codeUri, false);
      const vscodeDebugConfig = await generateVscodeDebugConfig(this.serviceName, this.functionName, this.runtime, codeMount.Source, this.debugPort);
      console.log(blue('you can paste these config to .vscode/launch.json, and then attach to your running function'));
      console.log('///////////////// config begin /////////////////');
      console.log(JSON.stringify(vscodeDebugConfig, null, 4));
      console.log('///////////////// config end /////////////////');
    }
    const shUir = path.resolve(process.cwd(), '.fun');
    if (isWin) {
      const configDir = path.join(process.env.HOME || os.homedir(), '.fcli');
      const { folder } = nodejsTgzUrl[this.runtime];
      
      await invokeNotDocker.downloadFile({ runtime: this.runtime });
      const LOG_PATH = `${configDir}/${folder}/var/log`;
      await invokeNotDocker.invoke({
        LOG_PATH,
        servicePath: `${configDir}/${folder}/src/server.js`,
        env: this.envs,
        codeUri: this.codeUri,
        event,
        kill9000Path: `${configDir}/${this.runtime}/kill9000.bat`,
      })
      // await invokeNotDocker.httprequest(this.envs)
      return;
    }

    
    if (!fs.existsSync(`${shUir}/function-compute-mock.sh`)) {
      await fs.writeFileSync(`${shUir}/function-compute-mock.sh`, require('./shFile/function-compute-mock'));
      execSync('chmod 777 *.sh', {
        cwd: shUir
      })
    }

    if (!fs.existsSync(`${shUir}/var/fc/runtime/${nodejsTgzUrl[this.runtime].folder}/agent.sh`)) {
      await fs.writeFileSync(`${shUir}/agent.sh`, require('./shFile/agent'));
      this.envs.AGENTDIR = `${shUir}/agent.sh`;
      this.envs.TGZURL = nodejsTgzUrl[this.runtime].url;
    }

    this.envs.FC_RUNTIME_FOLDER = nodejsTgzUrl[this.runtime].folder;

    spawnSync('./.fun/function-compute-mock.sh', ['--event', event, ...this.cmd], {
      cwd: process.cwd(),
      env: this.envs,
      stdio: 'inherit'
    })
  }
}

module.exports = LocalInvoke;