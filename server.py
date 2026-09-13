import os
import threading
import time
import sys

print("=== SERVER STARTING ===", flush=True)

# --- Проверка импортов ---
try:
    from flask import Flask, jsonify
    print("IMPORT: Flask OK", flush=True)
except Exception as e:
    print("IMPORT ERROR: Flask ->", e, flush=True)

try:
    from aggregator import get_feed, update_feed
    print("IMPORT: aggregator OK", flush=True)
except Exception as e:
    print("IMPORT ERROR: aggregator ->", e, flush=True)

try:
    from parser_wb import parse_wb
    print("IMPORT: parser_wb OK", flush=True)
except Exception as e:
    print("IMPORT ERROR: parser_wb ->", e, flush=True)

# --- Flask ---
app = Flask(__name__)

@app.route("/")
def root():
    return "SERVER OK"

@app.route("/api/feed")
def feed():
    return jsonify(get_feed())

# --- Updater ---
def updater():
    print("UPDATER THREAD STARTED", flush=True)
    while True:
        try:
            items = parse_wb()
            update_feed(items)
            print(f"FEED UPDATED: {len(items)}", flush=True)
        except Exception as e:
            print("UPDATER ERROR:", e, flush=True)
        time.sleep(30)  # ставим 30 сек для диагностики

# --- Запуск ---
if __name__ == "__main__":
    print("MAIN BLOCK ENTERED", flush=True)

    # Запуск потока
    try:
        threading.Thread(target=updater, daemon=True).start()
        print("UPDATER THREAD LAUNCHED", flush=True)
    except Exception as e:
        print("THREAD ERROR:", e, flush=True)

    # Порт Railway
    try:
        port = int(os.environ.get("PORT", 8000))
        print(f"PORT DETECTED: {port}", flush=True)
    except Exception as e:
        print("PORT ERROR:", e, flush=True)
        port = 8000

    # Запуск Flask
    print("FLASK STARTING...", flush=True)
    try:
        app.run(host="0.0.0.0", port=port)
    except Exception as e:
        print("FLASK ERROR:", e, flush=True)
