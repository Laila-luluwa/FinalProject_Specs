#!/bin/sh
set -e
UPSTREAM="${BACKEND_UPSTREAM:-backend:3000}"
sed -i "s|__BACKEND_UPSTREAM__|${UPSTREAM}|g" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
