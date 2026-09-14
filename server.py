from flask import Flask, request, jsonify, send_from_directory
import json
import os

app = Flask(__name__)

FEED_PATH = "feed.json"
SETTINGS_PATH = "settings.json"


# -----------------------------
# 1. Получение и сохранение ленты от ПК
# -----------------------------
@app.route("/update_feed", methods=["POST"])
def update_feed():
    data = request.json

    with open(FEED_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return jsonify({"status": "ok", "count": len(data)})


# -----------------------------
# 2. Отдача ленты для Mini App
# -----------------------------
@app.route("/api/feed")
def api_feed():
    if not os.path.exists(FEED_PATH):
        return jsonify([])

    with open(FEED_PATH, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


# -----------------------------
# 3. Получение настроек менеджера
# -----------------------------
@app.route("/api/settings")
def api_settings():
    if not os.path.exists(SETTINGS_PATH):
        return jsonify({"query": "кроссовки", "limit": 50})

    with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


# -----------------------------
# 4. Сохранение настроек менеджера
# -----------------------------
@app.route("/api/settings", methods=["POST"])
def api_settings_save():
    data = request.json

    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return jsonify({"status": "saved"})


# -----------------------------
# 5. Ручное обновление ленты (без браузера)
# -----------------------------
@app.route("/api/reload")
def api_reload():
    # Railway не может парсить WB, поэтому просто возвращаем текущий feed.json
    if not os.path.exists(FEED_PATH):
        return jsonify({"status": "empty", "count": 0})

    with open(FEED_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    return jsonify({"status": "ok", "count": len(data)})


# -----------------------------
# 6. Отдача Mini App (TikTok‑лента)
# -----------------------------
@app.route("/")
def index():
    return send_from_directory("miniapp", "index.html")


# -----------------------------
# 7. Отдача менеджерской панели
# -----------------------------
@app.route("/admin")
def admin():
    return send_from_directory("miniapp", "admin.html")


# -----------------------------
# 8. Отдача статических файлов (JS, CSS)
# -----------------------------
@app.route("/miniapp/<path:path>")
def static_files(path):
    return send_from_directory("miniapp", path)


# -----------------------------
# Запуск (Railway сам вызывает gunicorn)
# -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
