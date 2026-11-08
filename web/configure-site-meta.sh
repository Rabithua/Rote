#!/bin/sh
set -eu

# The published Compose files and the hosted deployment use this service name.
# A standalone frontend can supply the backend origin or disable the include.
meta_api=${ROTE_META_API_BASE-http://rote-backend:3000}
meta_api=${meta_api%/}
if [ -n "$meta_api" ] && ! printf '%s\n' "$meta_api" | LC_ALL=C awk '
  NR == 1 && /^https?:\/\/([a-zA-Z0-9._-]+|\[[[:xdigit:]:.]+\])(:[0-9]+)?$/ { valid = 1 }
  END { exit !(NR == 1 && valid) }
'; then
  echo 'Invalid ROTE_META_API_BASE: expected an HTTP(S) origin' >&2
  exit 1
fi

# Use the container's own resolver so Compose service IPs are resolved at
# request time and keep working when the backend is replaced.
resolvers=$(awk '/^nameserver[ \t]+[0-9.]+[ \t]*$/ {printf "%s ", $2}
                 /^nameserver[ \t]+[[:xdigit:]:.]+[ \t]*$/ && $2 ~ /:/ {printf "[%s] ", $2}' /etc/resolv.conf)
{
  printf 'set $rote_meta_api "%s";\n' "$meta_api"
  if [ -n "$resolvers" ]; then
    printf 'resolver %s valid=15s;\nresolver_timeout 750ms;\n' "$resolvers"
  fi
} > /etc/nginx/rote-site-meta-upstream.conf
