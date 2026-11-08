set -eu
export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH
cd /home/user/multica-minimality/source/apps/desktop
export VITE_API_URL=https://api.multica.ai VITE_WS_URL=wss://api.multica.ai/ws VITE_APP_URL=https://multica.ai
node --input-type=module -e 'import {build} from "electron-vite"; await build({server:{host:"127.0.0.1"}})'
