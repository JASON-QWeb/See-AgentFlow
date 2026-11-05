#!/bin/zsh
set -e
cd "${0:A:h}"
if curl -fsS http://127.0.0.1:4318/api/health >/dev/null 2>&1; then
  open http://127.0.0.1:4318/
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then
  print '需要先安装 Node.js 22 或更高版本。'
  read -k 1 '?按任意键退出'
  exit 1
fi
if [[ ! -d node_modules ]]; then npm install; fi
if [[ ! -f dist/client/index.html ]]; then npm run build; fi
(sleep 1; open http://127.0.0.1:4318/) &
npm start
