from flask import Flask, request, jsonify, send_from_directory
import json
import os
import requests

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
# 5. ПАРСЕР WB — выполняется на Railway
# -----------------------------
@app.route("/api/parse_wb")
def parse_wb_server():
    query = request.args.get("query", "кроссовки")
    limit = int(request.args.get("limit", 50))

    url = (
        "https://search.wb.ru/catalog/ru/search/v2/search"
        f"?query={query}"
        "&spp=30"
        "&regions=80,64,38,4,33,70,1,22,31,66,68,40,48,71"
        "&pricemarginCoeff=1.0"
        "&appType=1"
        "&curr=rub"
        "&dest=-1257786"
        "&locale=ru"
        "&page=1"
        f"&limit={limit}"
    )

    try:
        r = requests.get(url, timeout=10)
        data = r.json()
    except Exception as e:
        return jsonify({"error": str(e), "products": []})

    products = []

    for item in data.get("data", {}).get("products", []):
        product_id = item.get("id")

        products.append({
            "title": item.get("name", "Без названия"),
            "price": f"{item.get('salePriceU', 0) // 100} ₽",
            "brand": item.get("brand", ""),
            "image": f"https://images.wbstatic.net/c516x688/new/{product_id}-1.jpg",
            "link": f"https://www.wildberries.ru/catalog/{product_id}/detail.aspx"
        })

    return jsonify(products)


# -----------------------------
# 6. Отдача Mini App
# -----------------------------
@app.route("/")
def index():
    return send_from_directory("miniapp", "index.html")


# -----------------------------
# 7. Отдача админки
# -----------------------------
@app.route("/admin")
def admin():
    return send_from_directory("miniapp", "admin.html")


# -----------------------------
# 8. Статика
# -----------------------------
@app.route("/miniapp/<path:path>")
def static_files(path):
    return send_from_directory("miniapp", path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
