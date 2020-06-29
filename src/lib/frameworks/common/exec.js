'use strict';

const process = require('child_process');

function exec(cmd, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Executing command '${cmd}'...`);
    process.exec(cmd, { cwd }, (error, stdout, stderr) => {
      console.log(stdout);

      if (error) {
        console.error(stderr);

        reject(error);
        return ;
      }

      resolve();
    });
  });
}

// 执行命令行，如果执行错误但错误的回调函数返回 true，则不抛异常
function executeCheckError({
  cmd,
  cwd,
  errorCallback = () => {}
}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing command '${cmd}'...`);
    process.exec(cmd, cwd, (error, stdout, stderr) => {
      if (error && !errorCallback(error)) {
        reject(error);
        return ;
      }
      resolve({
        stdout,
        error,
        stderr
      });
    });
  });
}

module.exports = {
  exec,
  executeCheckError
};