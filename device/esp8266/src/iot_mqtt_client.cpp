#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include "../include/iot_mqtt_client.h"

void wifiEnsure(const char *ssid, const char *pass)
{
  if (WiFi.status() == WL_CONNECTED)
    return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\nWiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
}

void mqttEnsure(PubSubClient &mqtt,
                const char *host, uint16_t port,
                const char *clientId,
                const char *user, const char *pwd)
{
  mqtt.setServer(host, port);
  while (!mqtt.connected())
  {
    Serial.print("Connecting to MQTT...");
    bool ok = (user && user[0]) ? mqtt.connect(clientId, user, pwd)
                                : mqtt.connect(clientId);
    if (!ok)
    {
      Serial.printf(" failed rc=%d, retry in 2s\n", mqtt.state());
      delay(2000);
    }
  }
  Serial.println("MQTT connected");
}

void mqttPublishJson(PubSubClient &mqtt, const char *topic,
                     const String &json, bool retain)
{
  mqtt.publish(topic, json.c_str(), retain);
  Serial.printf("MQTT → %s : %s\n", topic, json.c_str());
}
