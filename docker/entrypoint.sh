#!/bin/bash
# export environment variables to /etc/environment so that
# the docker-compose environment variables can be used in cron
printenv >> /etc/environment
exec "$@"
