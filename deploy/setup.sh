#!/usr/bin/env bash
# Instalação do site num servidor Ubuntu (Oracle Cloud Always Free). Rode uma vez, como o usuário "ubuntu":
#   bash setup.sh
# O endereço público vira https://<ip-com-traços>.sslip.io (HTTPS grátis, sem precisar de domínio).
# Para usar um domínio próprio: DOMAIN=meusite.com bash setup.sh
set -euo pipefail

REPO="git@github.com:rafcsouza/deadlock-draft-manager.git"
APP_DIR="$HOME/app"
NODE_MAJOR=24

echo "==> Atualizando o sistema e instalando ferramentas"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

echo "==> Instalando o Node.js $NODE_MAJOR"
if ! node --version 2>/dev/null | grep -q "^v$NODE_MAJOR"; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version

echo "==> Instalando o Caddy (HTTPS automático)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

echo "==> Liberando as portas 80 e 443 no firewall do Ubuntu"
# As regras precisam ficar antes do REJECT que a imagem da Oracle já traz.
for port in 443 80; do
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null; then
    reject=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/ {print $1; exit}')
    sudo iptables -I INPUT "${reject:-1}" -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  fi
done
sudo netfilter-persistent save

echo "==> Baixando o código do GitHub"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
git pull --ff-only

echo "==> Instalando dependências e gerando a versão de produção"
npm ci
npm run build
[ -f .env.local ] || cp .env.example .env.local

echo "==> Criando o serviço que mantém o site ligado"
sudo tee /etc/systemd/system/tatinuanga.service >/dev/null <<EOF
[Unit]
Description=Tatinuanga Draft
After=network.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=$(command -v npm) start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now tatinuanga
sudo systemctl restart tatinuanga

echo "==> Agendando o backup diário do banco (04:00 de Brasília)"
( crontab -l 2>/dev/null | grep -v 'deploy/backup.sh' || true
  echo "0 7 * * * bash $APP_DIR/deploy/backup.sh >> $HOME/backups/backup.log 2>&1" ) | crontab -
mkdir -p "$HOME/backups"

echo "==> Configurando o endereço público"
if [ -z "${DOMAIN:-}" ]; then
  IP=$(curl -fsS https://api.ipify.org)
  DOMAIN="${IP//./-}.sslip.io"
fi
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
EOF
sudo systemctl reload caddy || sudo systemctl restart caddy

echo
echo "Pronto! O site está em: https://$DOMAIN"
echo "(o certificado HTTPS pode levar um minuto na primeira vez)"
