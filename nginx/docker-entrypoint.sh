#!/bin/sh
set -e

: "${SERVER_NAME:?ERROR: SERVER_NAME is required}"
: "${ENABLE_HTTPS:=false}"

if [ "$ENABLE_HTTPS" = "true" ]; then
    export SSL_FULLCHAIN="/etc/nginx/certs/fullchain.pem"
    export SSL_PRIVKEY="/etc/nginx/certs/privkey.pem"

    envsubst '$SERVER_NAME $SSL_FULLCHAIN $SSL_PRIVKEY' \
      < /etc/nginx/conf.d/default.https.template \
      > /etc/nginx/conf.d/default.conf

    echo "HTTPS enabled"
else
    envsubst '$SERVER_NAME' \
      < /etc/nginx/conf.d/default.http.template \
      > /etc/nginx/conf.d/default.conf

    echo "HTTPS disabled (HTTP only)"
fi

exec nginx -g 'daemon off;'
