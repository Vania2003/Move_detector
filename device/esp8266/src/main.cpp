#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include "../include/config.h"
#include "../include/iot_mqtt_client.h"

#define PIR_PIN D5
#define PIR_WARMUP_MS 30000 // ignore for the first 30 seconds
#define EDGE_DEBOUNCE 2000  // anti-bounce
#define NEED_LOW_MS 3000    // min 3 s LOW before new HIGH

unsigned long bootMs = 0;
unsigned long lastMotionEdgeMs = 0;
unsigned long lowSinceMs = 0;
bool lastMotionLevel = false;
bool allowNextTrue = true;

WiFiClient espClient;
PubSubClient mqtt(espClient);
unsigned long lastHealth = 0;

void publishMotion(bool motion)
{
  char msg[96];
  snprintf(msg, sizeof(msg),
           "{\"device\":\"%s\",\"motion\":%s}",
           DEVICE_ID, motion ? "true" : "false");
  mqtt.publish(TOPIC_STATE, msg);
  Serial.printf("MQTT sent: %s -> %s\n", TOPIC_STATE, msg);
  digitalWrite(LED_BUILTIN, motion ? LOW : HIGH);
}

void handlePir(unsigned long now)
{
  if (now - bootMs < PIR_WARMUP_MS)
  {
    static unsigned long lastNote = 0;
    if (now - lastNote > 5000)
    {
      Serial.println("PIR warmup...");
      lastNote = now;
    }
    return;
  }

  bool level = digitalRead(PIR_PIN);

  if (!level)
  {
    if (lowSinceMs == 0)
      lowSinceMs = now;
    if (now - lowSinceMs >= NEED_LOW_MS)
      allowNextTrue = true;
  }
  else
  {
    lowSinceMs = 0;
  }

  if (level != lastMotionLevel && (now - lastMotionEdgeMs) > EDGE_DEBOUNCE)
  {
    lastMotionEdgeMs = now;
    if (level)
    {
      if (allowNextTrue)
      {
        publishMotion(true);
        allowNextTrue = false;
      }
      else
      {
        Serial.println("PIR: HIGH ignored (waiting stable LOW)");
      }
    }
    else
    {
      publishMotion(false);
    }
    lastMotionLevel = level;
  }
}

void setup()
{
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  bootMs = millis();

  wifiEnsure(WIFI_SSID, WIFI_PASS);
  mqttEnsure(mqtt, MQTT_HOST, MQTT_PORT, DEVICE_ID, MQTT_USER, MQTT_PASS);

  char msg[128];
  snprintf(msg, sizeof(msg),
           "{\"device\":\"%s\",\"boot\":true,\"ip\":\"%s\"}",
           DEVICE_ID, WiFi.localIP().toString().c_str());
  mqtt.publish(TOPIC_HEALTH, msg, true);
  Serial.println("Device boot message sent.");
}

void loop()
{
  wifiEnsure(WIFI_SSID, WIFI_PASS);
  mqttEnsure(mqtt, MQTT_HOST, MQTT_PORT, DEVICE_ID, MQTT_USER, MQTT_PASS);
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastHealth > 5000)
  {
    lastHealth = now;
    char hb[96];
    snprintf(hb, sizeof(hb),
             "{\"device\":\"%s\",\"uptime_ms\":%lu}",
             DEVICE_ID, now);
    mqtt.publish(TOPIC_HEALTH, hb);
    Serial.println(hb);
    digitalWrite(LED_BUILTIN, LOW);
    delay(80);
    digitalWrite(LED_BUILTIN, HIGH);
  }

  handlePir(now);
  delay(50);
}
