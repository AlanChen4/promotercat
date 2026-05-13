#!/usr/bin/env sh

# Optional first argument sets log level (DEBUG, INFO, WARNING, ERROR, CRITICAL, NOTSET)
case "$1" in
  DEBUG|INFO|WARNING|ERROR|CRITICAL|NOTSET)
    LOG_LEVEL="$1"
    shift
    ;;
esac

export LOG_LEVEL="${LOG_LEVEL:-INFO}"

doppler run -- uv run "$@"
