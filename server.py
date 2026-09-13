import os
import threading
import time
from flask import Flask, jsonify
from aggregator import get_feed, update_feed
from parser_wb import parse_wb

app = Flask(__name__)

@app.route("/")
def root():
    return "SERVER OK"

@app.route("/api/feed")
def feed():
    return jsonify(get_feed())

def updater():
    while True:
        try:
            items = parse_wb()
            update_feed(items)
            print("FEED UPDATED:", len(items))
        except Exception as e:
            print("UPDATE ERROR:", e)
        time.sleep(600)

if __name__ == "__main__":
    print("SERVER STARTING...", flush=True)
    threading.Thread(target=updater, daemon=True).start()
    port = int(os.environ.get("PORT", 8000))
    print(f"FLASK STARTING ON PORT {port}", flush=True)
    app.run(host="0.0.0.0", port=port)
