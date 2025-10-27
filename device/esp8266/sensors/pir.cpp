#include <Arduino.h>
#include "../include/pir.h"

static bool s_lastLevel = false;
static unsigned long s_lastEdgeMs = 0;
static unsigned long s_lowSinceMs = 0;
static bool s_allowNextTrue = true;
static unsigned long s_bootMs = 0;
static PirConfig s_cfg;

void pirBegin(const PirConfig& cfg) {
  s_cfg = cfg;
  pinMode(cfg.pin, INPUT); // HC-SR501/AM312 без pullup
  s_lastLevel = false;
  s_lastEdgeMs = 0;
  s_lowSinceMs = 0;
  s_allowNextTrue = true;
  s_bootMs = millis();
}

bool pirPoll(const PirConfig& cfg, unsigned long now,
             bool& level, bool& isEdge, bool& rising) {
  // прогрев
  if (now - s_bootMs < cfg.warmupMs) {
    isEdge = false; rising = false; level = false;
    return false;
  }

  level = digitalRead(cfg.pin);

  // считаем стабильный LOW
  if (!level) {
    if (s_lowSinceMs == 0) s_lowSinceMs = now;
    if (now - s_lowSinceMs >= cfg.needLowMs) s_allowNextTrue = true;
  } else {
    s_lowSinceMs = 0;
  }

  // детект фронтов со стабильностью (debounce)
  isEdge = (level != s_lastLevel) && (now - s_lastEdgeMs > cfg.edgeDebounceMs);
  rising = isEdge && level;

  if (isEdge) {
    s_lastEdgeMs = now;
    if (rising) {
      if (!s_allowNextTrue) { // игнорируем ложные повторные HIGH
        isEdge = false;
        rising = false;
      } else {
        s_allowNextTrue = false;
      }
    }
    s_lastLevel = level;
  }

  return true; // поллинг выполнен
}
