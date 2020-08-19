module.exports = `#!/bin/bash
###################################################################
# To start the server, use this script.
#
# The server is configured with environment variables. The full list
# of environment variables can be seen in ./src/constant.js
###################################################################

export FC_SERVER_PORT=\${FC_SERVER_PORT:=9000}
export FC_SERVER_PATH=\${FC_SERVER_PATH:=\${CURDIR}}
export FC_SERVER_LOG_PATH=\${FC_SERVER_LOG_PATH:=\${CURDIR}/.fun/var/log}
export FC_SERVER_LOG_LEVEL=\${FC_SERVER_LOG_LEVEL:=silly}
export FC_FUNC_CODE_PATH=\${FC_FUNC_CODE_PATH:=\${CURDIR}}
export FC_FUNC_LOG_PATH=\${FC_FUNC_LOG_PATH:=\${CURDIR}/.fun/var/log}


export FC_FUNC_CODE_PATH=\${CURDIR}
export FC_FUNC_LOG_PATH="\${CURDIR}/var/log"


Help() {
    echo "Usage:"
    echo "      $0 command"
    echo "Commands"
    echo "      start               start up server"
    echo "      help                print help page"
}


if [ $# -eq 0 ]
then
    echo "Missing arguments."
    Help
    exit 0;
fi


# echo "$(cd "$(dirname "$0")";pwd) =====> $1"

command=$1
case \${command} in
    "start")
        /usr/local/bin/node \${DEBUG_OPTIONS} --max-old-space-size=8192 $(cd "$(dirname "$0")";pwd)/src/server.js
        ;;
    "help")
        Help
        ;;
    *)
        Help
        ;;
esac
`