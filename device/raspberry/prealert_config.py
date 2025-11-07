import json
from pathlib import Path
from datetime import datetime, time

CONFIG_PATH = Path("/home/pi/DYPLOM/device/raspberry/prealert_config.json")

DEFAULT = {
  "default": {
    "inactivity_sec": 30*60,
    "prealert_offset_sec": 5*60,
    "enabled": True,
    "night_block": False,
    "night_window": {"from": "23:00", "to": "07:00"}
  }
}

def load_config():
    if not CONFIG_PATH.exists():
        save_config(DEFAULT)
        return DEFAULT
    return json.loads(CONFIG_PATH.read_text())

def save_config(cfg):
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))

def get_room_cfg(room, cfg=None):
    cfg = cfg or load_config()
    room_cfg = cfg.get(room, {})
    merged = cfg.get("default", {}).copy()
    merged.update(room_cfg)
    return merged

def in_night_window(cfg):
    if not cfg.get("night_block", False):
        return False
    nw = cfg.get("night_window", {"from":"23:00","to":"07:00"})
    tf = lambda s: datetime.strptime(s, "%H:%M").time()
    t_from = tf(nw["from"]); t_to = tf(nw["to"])
    now = datetime.now().time()
    if t_from < t_to:
        return t_from <= now < t_to
    else:
        return now >= t_from or now < t_to

