#!/bin/bash
# Monitors the SSH reverse tunnel to production and writes status to pipeline log.
# Run in background: ./tools/tunnel_monitor.sh &

LOG="/tmp/pipeline_server.log"
CHECK_INTERVAL=30
ALARM_SOUND="/usr/share/sounds/freedesktop/stereo/dialog-warning.oga"
was_up=""

alarm() {
    # Play alarm 3 times so it's hard to miss
    for i in 1 2 3; do
        pw-play "$ALARM_SOUND" 2>/dev/null || paplay "$ALARM_SOUND" 2>/dev/null
        sleep 0.5
    done
}

while true; do
    # Check if sshd is listening on 8002 on the remote server
    if ssh -o ConnectTimeout=5 root@latext.ai "ss -tlnp | grep -q ':8002'" 2>/dev/null; then
        is_up="yes"
    else
        is_up="no"
    fi

    if [ "$was_up" = "" ]; then
        if [ "$is_up" = "yes" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] TUNNEL UP - Connection to production active" >> "$LOG"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] TUNNEL DOWN - No connection to production!" >> "$LOG"
            alarm &
        fi
    elif [ "$was_up" = "yes" ] && [ "$is_up" = "no" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] TUNNEL LOST - Connection to production dropped!" >> "$LOG"
        alarm &
    elif [ "$was_up" = "no" ] && [ "$is_up" = "yes" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] TUNNEL RESTORED - Connection to production is back" >> "$LOG"
    fi

    was_up="$is_up"
    sleep "$CHECK_INTERVAL"
done
