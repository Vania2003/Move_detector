#pragma once

// ===== Wi-Fi =====
#define WIFI_SSID     "Samotne kobiety w twojej okolicy"
#define WIFI_PASS     "69Milfs_in_50m"

// ===== MQTT broker (Raspberry Pi) =====
#define MQTT_HOST     "192.168.0.48"   // IP Raspberry Pi
#define MQTT_PORT     1883
#define MQTT_USER     "iot"
#define MQTT_PASS     "iot"

// ===== Device identity & topics =====
#define DEVICE_ID  "esp8266_test"
#define TOPIC_HEALTH  "iot/eldercare/room1/motion/health"
#define TOPIC_STATE   "iot/eldercare/room1/motion/state"
