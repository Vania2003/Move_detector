import argparse
import csv
import sqlite3
from datetime import datetime, timedelta

ISO = "%Y-%m-%dT%H:%M:%S"

def parse_iso(s: str) -> datetime:
    return datetime.strptime(s, ISO)

def exists_table(con, name: str) -> bool:
    cur = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND lower(name)=lower(?)", (name,))
    return cur.fetchone() is not None

def fetch_alerts(con, room: str, since_iso: str):
    q = """
      SELECT id, ts_utc, room, rule, status, details
        FROM alerts
       WHERE room = ? AND ts_utc >= ?
       ORDER BY ts_utc ASC
    """
    return con.execute(q, (room, since_iso)).fetchall()

def last_motion_before(con, room: str, ts_iso: str):
    q = """
      SELECT ts_utc FROM motion_events
       WHERE room = ? AND ts_utc <= ?
       ORDER BY ts_utc DESC
       LIMIT 1
    """
    row = con.execute(q, (room, ts_iso)).fetchone()
    return row[0] if row else None

def last_hb_before(con, device: str, ts_iso: str):
    q = """
      SELECT ts_utc FROM heartbeats
       WHERE device = ? AND ts_utc <= ?
       ORDER BY ts_utc DESC
       LIMIT 1
    """
    row = con.execute(q, (device, ts_iso)).fetchone()
    return row[0] if row else None

def prealert_messages_between(con, room: str, start_iso: str, end_iso: str):
    if not exists_table(con, "messages_raw"):
        return 0
    q = """
      SELECT COUNT(*) FROM messages_raw
       WHERE ts_utc BETWEEN ? AND ?
         AND topic LIKE '%' || ? || '/cmd/prealert%'
    """
    return con.execute(q, (start_iso, end_iso, room)).fetchone()[0]

def summarize(args):
    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    rows = fetch_alerts(con, args.room, args.since)
    results = []
    pass_all = True

    for r in rows:
        rid = r["id"]; ts = r["ts_utc"]; rule = (r["rule"] or "").upper(); status = (r["status"] or "").lower()
        note = ""
        ok = True

        if rule == "INACTIVITY":
            lm = last_motion_before(con, args.room, ts)
            if lm is None:
                ok = False; note = "no last motion"
            else:
                elapsed = (parse_iso(ts) - parse_iso(lm)).total_seconds()
                if elapsed + 1e-6 < args.inactivity_sec:
                    ok = False; note = f"elapsed {elapsed:.0f}s < inactivity {args.inactivity_sec}s"
                else:
                    start = (parse_iso(ts) - timedelta(seconds=args.prealert_offset_sec)).strftime(ISO)
                    cnt = prealert_messages_between(con, args.room, start, ts)
                    note = f"elapsed={elapsed:.0f}s prealert_msgs={cnt}"

        elif rule == "NO_HEARTBEAT":
            device = None
            det = (r["details"] or "")
            if "dev=" in det:
                try:
                    device = det.split("dev=", 1)[1].split()[0].strip(",) ")
                except Exception:
                    device = None
            if device:
                hb = last_hb_before(con, device, ts)
                if hb:
                    elapsed = (parse_iso(ts) - parse_iso(hb)).total_seconds()
                    if elapsed + 1e-6 < args.hb_threshold_sec:
                        ok = False; note = f"hb elapsed {elapsed:.0f}s < {args.hb_threshold_sec}s"
                    else:
                        note = f"hb elapsed={elapsed:.0f}s"
                else:
                    ok = False; note = "no heartbeat before alert"
            else:
                note = "device unknown; skipped hb check"

        else:
            note = "rule not validated (ok by default)"

        results.append({
            "id": rid, "ts_utc": ts, "rule": rule, "status": status, "ok": ok, "note": note
        })
        if not ok:
            pass_all = False

    if args.csv_out:
        with open(args.csv_out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["id","ts_utc","rule","status","ok","note"])
            w.writeheader(); w.writerows(results)

    total = len(results)
    okc = sum(1 for x in results if x["ok"])
    print(f"[VALIDATE] alerts checked: {total}, ok: {okc}, failed: {total-okc}")
    for x in results:
        mark = "PASS" if x["ok"] else "FAIL"
        print(f"  {mark}  id={x['id']} ts={x['ts_utc']} rule={x['rule']} status={x['status']} :: {x['note']}")
    if pass_all:
        print("[VALIDATE] OVERALL: PASS")
        return 0
    else:
        print("[VALIDATE] OVERALL: FAIL")
        return 1

def build_args(argv=None):
    p = argparse.ArgumentParser(description="Validate alerts in SQLite against expectations")
    p.add_argument("--db", required=True, help="Path to events.db")
    p.add_argument("--room", required=True, help="Room name to validate")
    p.add_argument("--since", required=True, help='Only consider rows with ts_utc >= this ISO (e.g. "2025-11-08T12:00:00")')
    p.add_argument("--inactivity-sec", type=int, default=30*60)
    p.add_argument("--prealert-offset-sec", type=int, default=5*60)
    p.add_argument("--hb-threshold-sec", type=int, default=15*60)
    p.add_argument("--csv-out", default="", help="Optional CSV for per-alert verdicts")
    return p.parse_args(argv)

if __name__ == "__main__":
    import sys
    sys.exit(summarize(build_args()))
