#!/bin/bash
PI_USER="pi"
PI_HOST="192.168.0.48"
PI_PATH="/home/pi/DYPLOM/device/raspberry"
LOCAL_PATH="./raspberry"

echo "📥 Copying project from Raspberry Pi → local..."
echo "Source: $PI_USER@$PI_HOST:$PI_PATH"
echo "Target: $LOCAL_PATH"

mkdir -p "$LOCAL_PATH"

scp -r -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$PI_USER@$PI_HOST:$PI_PATH/"* "$LOCAL_PATH/"

if [ $? -eq 0 ]; then
  echo "✅ Copying succeeded!"
else
  echo "❌ Error during copy. Check IP or SSH permissions."
fi
