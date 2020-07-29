#!/bin/bash
localUrl="$(dirname $0)"
invokeUrl="$(pwd)"

agentScript=$invokeUrl/.fun/var/fc/runtime/$FC_RUNTIME_FOLDER/agent.sh

if [ ! -n "$AGENTDIR" ]; then
  echo "Skip environment configuration"
else
  curl $TGZURL -o ./.fun/$FC_RUNTIME_FOLDER.tgz
  tar -xzf ./.fun/$FC_RUNTIME_FOLDER.tgz -C ./.fun/
  rm -rf ./.fun/var/fc/runtime/*/var/log/*
  rm -rf ./.fun/$FC_RUNTIME_FOLDER.tgz

  cp -rf $AGENTDIR $agentScript
  chmod 777 ${FC_SERVER_LOG_PATH}
  chmod -R 777 $localUrl
fi



handler="index.handler"
timeout=3
memory=128
initializer=
initializationTimeout=3
event=""

agentPath="${agentScript}"
requestId="$(uuidgen)"

serverPort=${FC_SERVER_PORT:-9000}

while true; do
  case "$1" in
    -h | --handler ) handler="$2"; shift 2;;
    -i | --initializer ) initializer="$2"; shift 2;;
    -e | --initializationTimeout ) initializationTimeout="$2"; shift 2 ;;
    --timeout ) timeout="$2"; shift 2 ;;
    --event ) event="$2"; shift 2 ;;
    --http ) HTTP_MODE=true; shift ;;
    --event-decode ) EVENT_DECODE=true; shift ;; 
    --server) SERVER_MODE=true; shift ;;
<<<<<<< HEAD
    --stdin ) shift;;
    -- ) shift; break ;;
=======
    -- | --stdin ) shift; break ;;
>>>>>>> debugger
    "" ) break ;;
    * ) echo -e "\n\t Please use the long and short parameter mode. \n\t For more details, please refer to https://github.com/aliyun/fc-docker. \n\n"; exit -1 ;;
  esac
done

if [ ! -f "$agentPath" ]; then
    echo "error: agent.sh not exist"
    exit 1;
fi

# 设置环境变量
for i in `env`
do
  export "$i"
done
export CURDIR="$invokeUrl"

if ! ps aux | grep "$agentScript"  | grep -q -v grep ; then
  if [ -n "$SERVER_MODE" ]; then
    exec "$agentPath" start
    exit 0;
  else
    exec "$agentPath" start &
  fi
fi

echo $(ps aux | grep "$agentScript"  | grep -q -v grep)

while ! &>/dev/null </dev/tcp/127.0.0.1/${serverPort}; do
  sleep 0.01;
done

[[ -z ${FC_HANDLER} ]] && handler=${FC_HANDLER}
[[ -z ${FC_TIMEOUT} ]] && timeout=${FC_TIMEOUT}
[[ -z ${FC_INITIALIZER} ]] && initializer=${FC_INITIALIZER}
[[ -z ${FC_MEMORY_SIZE} ]] && memory=${FC_MEMORY_SIZE}
[[ -z ${FC_INITIALIZATIONIMEOUT} ]] && initializationTimeout=${FC_INITIALIZATIONIMEOUT}

curlUtil() {
  curl -s -X POST $3 localhost:${serverPort}/$1 \
    -H "Content-Type: application/octet-stream" \
    -H "Expect: " \
    -H "x-fc-request-id: $requestId" \
    -H "x-fc-function-name: ${FC_FUNCTION_NAME:-fc-docker}" \
    -H "x-fc-function-memory: ${memory}" \
    -H "x-fc-function-timeout: ${timeout}" \
    -H "x-fc-initialization-timeout: ${initializationTimeout}" \
    -H "x-fc-function-initializer: ${initializer}" \
    -H "x-fc-function-handler: ${handler}" \
    -H "x-fc-account-id: ${FC_ACCOUND_ID}" \
    -H "x-fc-region: ${FC_REGION}" \
    -H "x-fc-service-name: ${FC_SERVICE_NAME}" \
    -H "x-fc-service-logproject: ${FC_SERVICE_LOG_PROJECT}" \
    -H "x-fc-service-logstore: ${FC_SERVICE_LOG_STORE}" \
    -H "x-fc-access-key-id: ${FC_ACCESS_KEY_ID}" \
    -H "x-fc-access-key-secret: ${FC_ACCESS_KEY_SECRET}" \
    -H "x-fc-security-token: ${FC_SECURITY_TOKEN}" \
    -H "${HTTP_PARAMS_HEADER}" \
    --data-binary "$2"
}

if [ -n "$initializer" ]; then
  curlUtil initialize ""
fi
HTTP_PARAMS_HEADER="${FC_HTTP_PARAMS:+x-fc-http-params: $FC_HTTP_PARAMS}"

killPid() {
  echo -e "\n\n**********************\nkill serverPort 9000:"
  kill $(lsof -i tcp:9000 |grep node|grep -v grep|grep -v PPID|awk '{ print $2}')
}


# event may be empty, must use quotation marks
if [ -n "$HTTP_MODE" ]; then
    if [ -n "$EVENT_DECODE" ]; then
      # why use pipes see https://stackoverflow.com/questions/6570531/assign-string-containing-null-character-0-to-a-variable-in-bash/24511770#24511770
      RESPONSE=$(echo "$event" | base64 -d | curlUtil invoke @- '-i' | base64)
    else
      RESPONSE=$(echo "$event" | curlUtil invoke @- '-i' | base64)
    fi
else
    if [ -n "$EVENT_DECODE" ]; then
      echo "$event" | base64 -d | curlUtil invoke @-
    else
      echo "$event" | curlUtil invoke @-
      killPid
    fi
fi
