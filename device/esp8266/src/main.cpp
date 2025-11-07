#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ---- ПИНЫ ----
#define PIR_PIN        D5
#define LED_PIN        LED_BUILTIN
#ifndef LED_ACTIVE_LOW
#define LED_ACTIVE_LOW 1
#endif

// ---- СЕТЬ / MQTT ----
const char* WIFI_SSID   = "Samotne kobiety w twojej okolicy";
const char* WIFI_PASS   = "69Milfs_in_50m";
const char* MQTT_HOST   = "192.168.0.48";
const uint16_t MQTT_PORT= 1883;
const char* MQTT_USER   = "iot";
const char* MQTT_PASSWD = "iot";

// ---- ОБЩИЕ КОНСТАНТЫ ----
const char* DEVICE  = "room1";
const char* BASE    = "iot/eldercare/";

// ---- ОБЪЕКТЫ ----
WiFiClient espClient;
PubSubClient mqtt(espClient);

// ---- СОСТОЯНИЕ ----
unsigned long lastMotionMs = 0;
bool motionState = false;
bool prealertActive = false;
unsigned long prealertEndMs = 0;
const unsigned long BLINK_PERIOD = 400; // мигание 2.5 Гц
unsigned long blinkMs = 0;

// ======================================================
// -----------------  УТИЛИТЫ  ---------------------------
// ======================================================
inline void ledWriteRaw(bool on) {
  digitalWrite(LED_PIN, LED_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
}
inline void ledSet(bool on) { ledWriteRaw(on); }

void publishJson(const String& topic, JsonDocument& doc) {
  char buf[256];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topic.c_str(), buf, n);
}

// ---- Публикация состояния движения ----
void sendMotion(bool m) {
  StaticJsonDocument<128> doc;
  doc["motion"] = m;
  doc["ts"] = (uint32_t)(millis() / 1000);
  String topic = String(BASE) + DEVICE + "/motion/state";
  publishJson(topic, doc);
  Serial.printf("[PIR] motion=%d\n", m);
}

// ======================================================
// -----------------  MQTT CALLBACK ----------------------
// ======================================================
void startPrealert();
void stopPrealert();

String cmdTopic() { return String(BASE) + DEVICE + "/cmd/prealert"; }

void onMqtt(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload, len)) return;

  Serial.printf("[MQTT] Received → %s %s\n", topic, (const char*)payload);

  if (String(topic) == cmdTopic()) {
    const char* action = doc["action"] | "";
    if (!strcmp(action, "start")) {
      startPrealert();
    } else if (!strcmp(action, "stop")) {
      stopPrealert();
    }
  }
}


// ======================================================
// -----------------  MQTT CONNECT -----------------------
// ======================================================
void ensureMqtt() {
  while (!mqtt.connected()) {
    String cid = "esp8266-" + String(ESP.getChipId(), HEX);
    Serial.printf("[MQTT] Connecting as %s...\n", cid.c_str());
    if (mqtt.connect(cid.c_str(), MQTT_USER, MQTT_PASSWD)) {
      Serial.println("[MQTT] Connected!");
      mqtt.subscribe(cmdTopic().c_str(), 0);
      Serial.printf("[MQTT] Subscribed to %s\n", cmdTopic().c_str());
    } else {
      Serial.printf("[MQTT] failed rc=%d, retrying...\n", mqtt.state());
      delay(2000);
    }
  }
}

void startPrealert() {
  prealertActive = true;
  prealertEndMs = millis() + 5000;  // по умолчанию 5 секунд, можно обновлять TTL позже
  blinkMs = 0;
  Serial.println("[PREALERT] started (LED blinking)");
}

void stopPrealert() {
  prealertActive = false;
  ledSet(false);
  Serial.println("[PREALERT] stopped");
}

void handlePrealertBlink() {
  if (!prealertActive) return;
  if (millis() > prealertEndMs) {
    stopPrealert();
    return;
  }
  if (millis() - blinkMs >= BLINK_PERIOD) {
    blinkMs = millis();
    bool current = (digitalRead(LED_PIN) == (LED_ACTIVE_LOW ? LOW : HIGH));
    ledWriteRaw(!current);
  }
}

// ======================================================
// -----------------  SETUP ------------------------------
// ======================================================
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== ESP8266 NodeMCU Prealert Firmware ===");

  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  ledSet(false);

  Serial.printf("[WiFi] Connecting to %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++attempts > 60) {
      Serial.println("\n[WiFi] Timeout! Restarting...");
      ESP.restart();
    }
  }
  Serial.printf("\n[WiFi] Connected! IP=%s\n", WiFi.localIP().toString().c_str());

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqtt);
  mqtt.subscribe(cmdTopic().c_str(), 0);
  ensureMqtt();

  lastMotionMs = millis();
  Serial.println("[INIT] Ready.");
}

// ======================================================
// -----------------  LOOP -------------------------------
// ======================================================
void loop() {
  if (!mqtt.connected()) ensureMqtt();
  mqtt.loop();
  handlePrealertBlink();

  bool pir = digitalRead(PIR_PIN) == HIGH;

  // === изменение состояния PIR ===
  if (pir != motionState) {
    motionState = pir;
    sendMotion(pir);            // только публикация в MQTT
    lastMotionMs = millis();
  }

  // === Live debug ===
  static unsigned long dbgMs = 0;
  if (millis() - dbgMs >= 500) {
    dbgMs = millis();
    int raw = digitalRead(PIR_PIN);
    Serial.printf("[DEBUG] PIR raw=%d (motionState=%d)\n", raw, motionState);
  }
}
