from flask import Flask, render_template, jsonify
from aggregator import get_feed

app = Flask(__name__)

# Главная страница Mini App
@app.route("/")
def index():
    return render_template("index.html")

# API для TikTok‑ленты
@app.route("/api/feed")
def feed():
    items = get_feed()
    return jsonify(items)

# Запуск сервера
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
