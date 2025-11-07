#!/bin/bash
DB="/home/pi/DYPLOM/device/raspberry/events.db"

echo "🔴 Starting Live Motion Stream..."
echo "Press Ctrl+C to stop."
echo

last_id=0

while true; do
    # Берём новые записи (с id больше предыдущего)
    rows=$(sqlite3 "$DB" "SELECT id, ts_utc, device_id, value FROM motion_events WHERE id > $last_id ORDER BY id ASC;")
    if [[ -n "$rows" ]]; then
        while IFS='|' read -r id ts dev val; do
            last_id=$id
            if [[ "$val" == "1" ]]; then
                echo -e "🟢 [$ts] Motion detected on $dev"
            else
                echo -e "⚪ [$ts] No motion on $dev"
            fi
        done <<< "$rows"
    fi
    sleep 0.5
done

