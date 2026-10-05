#!/usr/bin/env bash
set -euo pipefail

# Run as root through SSM, or with sudo during the first deployment.
cd /home/ubuntu/PasarPixel
commit_sha=${1:?Usage: sudo bash infra/ec2/deploy.sh COMMIT_SHA}
[[ "$commit_sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA'; exit 1; }
[[ $(git -c safe.directory="$PWD" rev-parse HEAD) == "$commit_sha" ]] || {
  echo 'Checkout does not match the requested release'; exit 1;
}
for file in infra/docker/.env.ec2 services/{auth-service,main-api,notification-service}/.env; do
  [[ -f "$file" ]] || { echo "Missing configuration: $file"; exit 1; }
done

exec 9>/var/lock/pasarpixel-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }

export IMAGE_TAG="$commit_sha"
compose=(docker compose --env-file infra/docker/.env.ec2 -f infra/docker/docker-compose.ec2.yml)
"${compose[@]}" config --quiet
# Pull everything before replacing any running service.
"${compose[@]}" pull
"${compose[@]}" up -d --wait --wait-timeout 300

site_address=$(docker inspect "$("${compose[@]}" ps -q client)" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^SITE_ADDRESS=//p')
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 10 "https://${site_address}/" >/dev/null; then
    echo "Deployed ${commit_sha} to https://${site_address}"
    exit 0
  fi
  sleep 5
done
echo 'Containers started, but the public HTTPS check failed. Check DNS, ports 80/443 and Caddy logs.'
exit 1
