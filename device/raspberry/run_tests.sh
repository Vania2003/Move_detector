#!/bin/bash
# ===========================================
# Eldercare System – Behaviour Simulation Tests
# ===========================================

DB="/home/pi/DYPLOM/device/raspberry/events.db"
SIM="/home/pi/DYPLOM/device/raspberry/publish_sim.py"
GREEN="\e[32m"; RED="\e[31m"; YELLOW="\e[33m"; NC="\e[0m"

echo -e "🧠 Starting Eldercare Simulation Tests..."
date
echo "=========================================="

function check_rule() {
  local rule=$1
  local exists
  exists=$(sqlite3 "$DB" "SELECT COUNT(*) FROM alerts WHERE rule='$rule' AND status='open';")
  if [ "$exists" -gt 0 ]; then
    echo -e "✅ ${GREEN}$rule triggered ($exists record(s))${NC}"
  else
    echo -e "⚪ ${YELLOW}$rule not triggered${NC}"
  fi
}

function wait_for() {
  local t=$1
  local text=$2
  echo "⏳ Waiting ${t}s for $text..."
  sleep $t
}

function title() {
  echo ""
  echo "------------------------------------------"
  echo "🔹 $1"
  echo "------------------------------------------"
}

# Test 1 – Normal morning activity (baseline)
title "[1/10] Morning routine – LivingRoom"
python3 "$SIM" <<< $'LivingRoom\ndev_liv\n1\n2\n'
wait_for 3 "routine logging"
check_rule "INACTIVITY"

# Test 2 – Active day with movement (normal)
title "[2/10] Day activity – Kitchen"
python3 "$SIM" <<< $'Kitchen\ndev_kitchen\n2\n2\n'
wait_for 3 "daytime motion"
check_rule "INACTIVITY"

# Test 3 – Long bathroom stay (DWELL_CRITICAL)"
title "[3/10] Long stay – Bathroom"
python3 "$SIM" <<< $'Bathroom\ndev_bath\n4\n3\n'
wait_for 8 "dwelling rule detection"
check_rule "DWELL_CRITICAL"

# Test 4 – Night movement detected
title "[4/10] Night movement – Bedroom"
python3 "$SIM" <<< $'Bedroom\ndev_bed\n3\n2\n'
wait_for 3 "night calm event"
check_rule "NIGHT_ACTIVITY"

# Test 5 – Manual control burst
title "[5/10] Manual toggle test – Hallway"
python3 "$SIM" <<< $'Hallway\ndev_hall\n7\non\noff\nexit\n'
wait_for 3 "manual control test"
check_rule "INACTIVITY"

# Test 6 – Inactivity trigger (short 30s idle)"
title "[6/10] Inactivity – LivingRoom"
python3 "$SIM" <<< $'LivingRoom\ndev_liv\n2\n1\n'
wait_for 30 "idle detection"
check_rule "INACTIVITY"

# Test 7 – Recovery after inactivity
title "[7/10] Recovery – Motion resumes"
python3 "$SIM" <<< $'LivingRoom\ndev_liv\n7\non\nexit\n'
wait_for 3 "alert closing check"
sqlite3 "$DB" "SELECT rule,status FROM alerts ORDER BY id DESC LIMIT 3;" | grep closed && \
  echo -e "✅ ${GREEN}Inactivity alert closed${NC}" || \
  echo -e "❌ ${RED}Alert still open${NC}"

# Test 8 – Kitchen cooking activity
title "[8/10] Cooking – Kitchen"
python3 "$SIM" <<< $'Kitchen\ndev_kitchen\n5\n2\n'
wait_for 3 "cooking detection"
check_rule "DWELL_CRITICAL"

# Test 9 – Random motion bursts (stress test)
title "[9/10] Random motion bursts (4 sensors)"
for r in LivingRoom Kitchen Bedroom Bathroom; do
  python3 "$SIM" <<< $"$r\ndev_${r,,}\n6\n1\n"
done
wait_for 5 "stabilization"
check_rule "INACTIVITY"

# Test 10 – Final summary
title "[10/10] Final alert summary"
sqlite3 "$DB" "SELECT id, rule, room, status, notified_at FROM alerts ORDER BY id DESC LIMIT 10;"

echo -e "\n${GREEN}✅ Simulation suite finished at $(date)${NC}"

