#!/usr/bin/env bash
set -euo pipefail

trap 'echo -e "\033[1;31m[ERROR]\033[0m Ошибка в строке $LINENO"; exit 1' ERR

log() { echo -e "\033[1;32m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
die() { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

[[ $EUID -eq 0 ]] || die "Запускать нужно от root"

. /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
  die "Этот скрипт поддерживает только Ubuntu или Debian: $ID"
fi

echo "==================================================="
echo "        3DP-MANAGER SUBSCRIPTION FORWARDER         "
echo "==================================================="

FORWARD_RULES=${FORWARD_RULES:-}
ORIGIN_IP=${ORIGIN_IP:-false}
LOCAL_IP=$(hostname -I | awk '{print $1}')

build_managed_rules() {
  cat <<EOF
# 3dp-manager start
*nat
:PREROUTING ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
EOF

  if [[ -n "$FORWARD_RULES" ]]; then
    IFS=',' read -ra RULES <<< "$FORWARD_RULES"
    for rule in "${RULES[@]}"; do
      IFS=':' read -r proto relay_port origin_ip origin_port <<< "$rule"
      [[ -n "$proto" && -n "$relay_port" && -n "$origin_ip" && -n "$origin_port" ]] || continue
      echo "-A PREROUTING -p $proto --dport $relay_port -j DNAT --to-destination $origin_ip:$origin_port"
      echo "-A POSTROUTING -p $proto -d $origin_ip --dport $origin_port -j SNAT --to-source $LOCAL_IP"
    done
  elif [[ "$ORIGIN_IP" != "false" && -n "$ORIGIN_IP" ]]; then
    echo "-A PREROUTING -p tcp -m multiport --dports 443,8443,10000:60000 -j DNAT --to-destination $ORIGIN_IP"
    echo "-A PREROUTING -p udp -m multiport --dports 443,8443,10000:60000 -j DNAT --to-destination $ORIGIN_IP"
    echo "-A POSTROUTING -p tcp -d $ORIGIN_IP -j SNAT --to-source $LOCAL_IP"
    echo "-A POSTROUTING -p udp -d $ORIGIN_IP -j SNAT --to-source $LOCAL_IP"
  fi

  cat <<EOF
COMMIT

*filter
:FORWARD ACCEPT [0:0]
:INPUT ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
-A FORWARD -m state --state RELATED,ESTABLISHED -j ACCEPT
EOF

  if [[ -n "$FORWARD_RULES" ]]; then
    IFS=',' read -ra RULES <<< "$FORWARD_RULES"
    for rule in "${RULES[@]}"; do
      IFS=':' read -r proto _relay_port origin_ip origin_port <<< "$rule"
      [[ -n "$proto" && -n "$origin_ip" && -n "$origin_port" ]] || continue
      echo "-A FORWARD -p $proto -d $origin_ip --dport $origin_port -j ACCEPT"
      echo "-A FORWARD -p $proto -s $origin_ip --sport $origin_port -j ACCEPT"
    done
  elif [[ "$ORIGIN_IP" != "false" && -n "$ORIGIN_IP" ]]; then
    echo "-A FORWARD -d $ORIGIN_IP -j ACCEPT"
    echo "-A FORWARD -s $ORIGIN_IP -j ACCEPT"
  fi

  cat <<EOF
COMMIT

*mangle
:FORWARD ACCEPT [0:0]
-A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
COMMIT
# 3dp-manager end
EOF
}

apply_ufw_rules() {
  if [[ -n "$FORWARD_RULES" ]]; then
    IFS=',' read -ra RULES <<< "$FORWARD_RULES"
    for rule in "${RULES[@]}"; do
      IFS=':' read -r proto relay_port _origin_ip _origin_port <<< "$rule"
      [[ -n "$proto" && -n "$relay_port" ]] || continue
      ufw allow "$relay_port/$proto" >/dev/null 2>&1 || true
    done
  elif [[ "$ORIGIN_IP" != "false" && -n "$ORIGIN_IP" ]]; then
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw allow 443/udp >/dev/null 2>&1 || true
    ufw allow 8443/tcp >/dev/null 2>&1 || true
    ufw allow 8443/udp >/dev/null 2>&1 || true
    ufw allow 10000:60000/tcp >/dev/null 2>&1 || true
    ufw allow 10000:60000/udp >/dev/null 2>&1 || true
  else
    warn "FORWARD_RULES пуст, порты не будут открыты до следующей синхронизации"
  fi
}

if ! command -v ufw >/dev/null 2>&1; then
  log "UFW не установлен. Устанавливаю..."
  apt update -qq && apt install -y ufw
fi

if LC_ALL=C ufw status 2>/dev/null | grep -q "Status: active"; then
  log "UFW уже активен"
else
  log "Включаю UFW"
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1
fi

log "Оптимизация сетевого стека"
cat <<EOF > /etc/sysctl.d/99-relay-optimization.conf
net.ipv4.ip_forward = 1
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.netfilter.nf_conntrack_max = 2000000
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_mtu_probing = 1
net.ipv4.conf.all.accept_local = 1
net.ipv4.conf.all.route_localnet = 1
net.core.netdev_max_backlog = 250000
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_tw_reuse = 1
EOF
sysctl --system >/dev/null

log "Обновляю правила UFW"
cp /etc/ufw/before.rules /etc/ufw/before.rules.bak
build_managed_rules > /tmp/ufw_3dp_rules
sed -i '/# 3dp-manager start/,/# 3dp-manager end/d' /etc/ufw/before.rules
sed -i '/^\*nat$/,/^COMMIT$/d' /etc/ufw/before.rules
sed -i '/^\*mangle$/,/^COMMIT$/d' /etc/ufw/before.rules
cat /tmp/ufw_3dp_rules /etc/ufw/before.rules > /etc/ufw/before.rules.new
mv /etc/ufw/before.rules.new /etc/ufw/before.rules

apply_ufw_rules
sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

log "Перезагружаю UFW"
ufw reload >/dev/null

log "Готово"
