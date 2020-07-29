'use strict';

const path = require('path');
const { blue } = require('colors');
const docker = require('../docker');
const { generateVscodeDebugConfig } = require('../debug');
const fs = require('fs');
const { execSync, spawnSync, spawn } = require('child_process');

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
    

    if(this.debugPort && this.debugIde) {
      const codeMount = await docker.resolveCodeUriToMount(this.codeUri, false);
      const vscodeDebugConfig = await generateVscodeDebugConfig(this.serviceName, this.functionName, this.runtime, codeMount.Source, this.debugPort);
      console.log(blue('you can paste these config to .vscode/launch.json, and then attach to your running function'));
      console.log('///////////////// config begin /////////////////');
      console.log(JSON.stringify(vscodeDebugConfig, null, 4));
      console.log('///////////////// config end /////////////////');
    }

    const shUir = path.resolve(process.cwd(), '.fun');
    execSync(`cp -rf ${path.resolve(__dirname, '../../script/function-compute-mock.sh')} ${shUir}/function-compute-mock.sh && chmod 777 *.sh`, {
      cwd: shUir
    })

    if (!fs.existsSync(`${shUir}/var/fc/runtime/${nodejsTgzUrl[this.runtime].folder}/agent.sh`)) {
      this.envs.AGENTDIR = path.resolve(__dirname, '../../script/agent.sh');
      this.envs.TGZURL = nodejsTgzUrl[this.runtime].url;
    }

    this.envs.FC_RUNTIME_FOLDER = nodejsTgzUrl[this.runtime].folder;

    spawnSync('./.fun/function-compute-mock.sh', ['--event', event , ...this.cmd], {
      cwd: process.cwd(),
      env: this.envs,
      stdio: 'inherit'
    })
  }
}

module.exports = LocalInvoke;