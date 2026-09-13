import os
import threading
import time
from flask import Flask, jsonify, send_from_directory
from aggregator import get_feed, update_feed
from parser_wb import parse_wb

app = Flask(__name__)

# ---------------------------
#   API ENDPOINT
# ---------------------------
@app.route("/api/feed")
def feed():
    return jsonify(get_feed())

# ---------------------------
#   MINI APP ROUTES
# ---------------------------
@app.route("/miniapp")
def miniapp():
    return send_from_directory("miniapp", "index.html")

@app.route("/miniapp/<path:path>")
def miniapp_files(path):
    return send_from_directory("miniapp", path)

# ---------------------------
#   ROOT
# ---------------------------
@app.route("/")
def root():
    return "SERVER OK"

# ---------------------------
#   BACKGROUND UPDATER
# ---------------------------
def updater():
    while True:
        try:
            items = parse_wb()
            update_feed(items)
            print("FEED UPDATED:", len(items))
        except Exception as e:
            print("UPDATE ERROR:", e)
        time.sleep(600)

# ---------------------------
#   START SERVER
# ---------------------------
if __name__ == "__main__":
    threading.Thread(target=updater, daemon=True).start()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
