set -e

PI_USER="pi"
PI_HOST="192.168.0.48"
REMOTE_DIR="/home/pi/DYPLOM/device/raspberry"
LOCAL_DIR="./raspberry"

echo "⬇️  Pulling latest files from Raspberry Pi..."
echo "Source: ${PI_USER}@${PI_HOST}:${REMOTE_DIR}"
echo "Target: ${LOCAL_DIR}"
echo "------------------------------------------"

ssh ${PI_USER}@${PI_HOST} "sudo chown -R ${PI_USER}:${PI_USER} ${REMOTE_DIR}" || {
  echo "⚠️  Couldn't fix permissions on Raspberry — check SSH or sudo rights."
  exit 1
}

scp -r ${PI_USER}@${PI_HOST}:${REMOTE_DIR} ${LOCAL_DIR} || {
  echo "❌ Error during download. Check network or SSH permissions."
  exit 1
}

chmod -R u+rw ${LOCAL_DIR}

echo "✅ Files successfully pulled and permissions restored!"
