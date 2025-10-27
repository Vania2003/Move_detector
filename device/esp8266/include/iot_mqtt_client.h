#pragma once
#include <ESP8266WiFi.h>
#include <PubSubClient.h>

void wifiEnsure(const char* ssid, const char* pass);
void mqttEnsure(PubSubClient& mqtt,
                const char* host, uint16_t port,
                const char* clientId,
                const char* user = "", const char* pwd = "");
void mqttPublishJson(PubSubClient& mqtt, const char* topic,
                     const String& json, bool retain = false);
