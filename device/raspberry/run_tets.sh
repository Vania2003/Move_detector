#!/bin/bash
# ==============================================
# Eldercare Full Simulation Test Suite
# Author: Dyplom Project - Raspberry Controller
# ==============================================

DB_PATH="/home/pi/DYPLOM/device/raspberry/events.db"
SIM_PATH="/home/pi/DYPLOM/device/raspberry/publish_sim.py"
LOG_COLOR="\e[36m"
RESET="\e[0m"

echo -e "🧠 ${LOG_COLOR}Starting Eldercare Simulation Tests...${RESET}"
date
echo "=========================================="

run_sql() {
    sqlite3 "$DB_PATH" "$1"
}

show_alerts() {
    echo -e "\n🗂️  Current alerts in DB:"
    run_sql "SELECT id, room, rule, status, details, created_at FROM alerts ORDER BY id DESC LIMIT 5;"
    echo "------------------------------------------"
}

# 1️⃣ Morning routine – LivingRoom
echo -e "\n🔹 [1/6] Morning routine – LivingRoom"
python3 "$SIM_PATH" <<EOF
TestRoom
dev_liv
1
2
8
EOF
sleep 3
show_alerts

# 2️⃣ Day activity – Kitchen
echo -e "\n🔹 [2/6] Day activity – Kitchen"
python3 "$SIM_PATH" <<EOF
Kitchen
dev_kitchen
2
2
8
EOF
sleep 3
show_alerts

# 3️⃣ Long stay – Bathroom
echo -e "\n🔹 [3/6] Long stay – Bathroom"
python3 "$SIM_PATH" <<EOF
Bathroom
dev_bath
4
1
8
EOF
sleep 3
show_alerts

# 4️⃣ Inactivity – Hallway
echo -e "\n🔹 [4/6] Inactivity – Hallway"
python3 "$SIM_PATH" <<EOF
Hallway
dev_hall
2
1
8
EOF
sleep 5
show_alerts

# 5️⃣ Recovery – Movement resumes
echo -e "\n🔹 [5/6] Recovery – Hallway motion resumes"
python3 "$SIM_PATH" <<EOF
Hallway
dev_hall
7
on
off
exit
EOF
sleep 3
show_alerts

# 6️⃣ Summary
echo -e "\n🔹 [6/6] Final alert summary"
run_sql "SELECT id, room, rule, status, details, created_at FROM alerts ORDER BY id DESC LIMIT 10;"

echo -e "\n✅ ${LOG_COLOR}Simulation suite finished at $(date)${RESET}"

