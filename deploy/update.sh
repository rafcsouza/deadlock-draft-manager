#!/usr/bin/env bash
# Atualiza o site no servidor com a versão mais recente do GitHub. Rode no servidor:
#   bash ~/app/deploy/update.sh
# O banco (pasta data/) e o .env.local não são tocados.
set -euo pipefail
cd "$HOME/app"
git pull --ff-only
npm ci
npm run build
sudo systemctl restart tatinuanga
echo "Site atualizado."
