#!/bin/sh

if [ -z "$PROD_PORT" ]; then
  echo "ERROR: PROD_PORT must be set. Check your .env"
  exit 1
fi

: "${SERVER_NAME:=localhost}"

envsubst '$PROD_PORT $SERVER_NAME' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
