from flask import Flask, request, jsonify
import json
import os

app = Flask(__name__)

FEED_PATH = "feed.json"
SETTINGS_PATH = "settings.json"

@app.route("/update_feed", methods=["POST"])
def update_feed():
    data = request.json
    with open(FEED_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return jsonify({"status": "ok", "items": len(data)})

@app.route("/api/feed")
def api_feed():
    if not os.path.exists(FEED_PATH):
        return jsonify([])
    with open(FEED_PATH, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))

@app.route("/")
def index():
    return open("miniapp/miniapp.html", "r", encoding="utf-8").read()

@app.route("/admin")
def admin():
    return open("miniapp/admin.html", "r", encoding="utf-8").read()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
