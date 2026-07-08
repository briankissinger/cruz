#!/bin/sh
set -e

echo "Starting Cruz Payment Gateway..."
echo "Environment: $NODE_ENV"

exec "$@"

exit 0