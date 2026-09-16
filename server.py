from flask import Flask, request, jsonify, send_from_directory
import json
import os
import requests

app = Flask(__name__)

FEED_PATH = "feed.json"
SETTINGS_PATH = "settings.json"


# =========================
# FEED
# =========================

@app.route("/update_feed", methods=["POST"])
def update_feed():
    data = request.json

    if not isinstance(data, list):
        return jsonify({
            "status": "error",
            "message": "Ожидался список товаров"
        }), 400

    try:
        with open(
            FEED_PATH,
            "w",
            encoding="utf-8"
        ) as f:
            json.dump(
                data,
                f,
                ensure_ascii=False,
                indent=2
            )

        print(
            f"Feed обновлён: {len(data)} товаров"
        )

        return jsonify({
            "status": "ok",
            "count": len(data)
        })

    except Exception as e:
        print(
            f"Ошибка сохранения feed.json: {e}"
        )

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/api/feed")
def api_feed():
    if not os.path.exists(FEED_PATH):
        print("feed.json не найден")

        return jsonify([])

    try:
        with open(
            FEED_PATH,
            "r",
            encoding="utf-8"
        ) as f:
            data = json.load(f)

        if not isinstance(data, list):
            return jsonify([])

        print(
            f"Отдаю feed: {len(data)} товаров"
        )

        return jsonify(data)

    except Exception as e:
        print(
            f"Ошибка чтения feed.json: {e}"
        )

        return jsonify([])


# =========================
# SETTINGS
# =========================

@app.route("/api/settings")
def api_settings():
    if not os.path.exists(SETTINGS_PATH):
        return jsonify({
            "query": "кроссовки",
            "limit": 50
        })

    try:
        with open(
            SETTINGS_PATH,
            "r",
            encoding="utf-8"
        ) as f:
            return jsonify(
                json.load(f)
            )

    except Exception as e:
        print(
            f"Ошибка чтения settings.json: {e}"
        )

        return jsonify({
            "query": "кроссовки",
            "limit": 50
        })


@app.route(
    "/api/settings",
    methods=["POST"]
)
def api_settings_save():
    data = request.json

    try:
        with open(
            SETTINGS_PATH,
            "w",
            encoding="utf-8"
        ) as f:
            json.dump(
                data,
                f,
                ensure_ascii=False,
                indent=2
            )

        return jsonify({
            "status": "saved"
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================
# WILDBERRIES PARSER
# =========================

@app.route("/api/parse_wb")
def parse_wb_server():
    query = request.args.get(
        "query",
        "кроссовки"
    )

    try:
        limit = int(
            request.args.get(
                "limit",
                50
            )
        )
    except ValueError:
        limit = 50

    proxy = {
        "http": "http://USERNAME:PASSWORD@IP:PORT",
        "https": "http://USERNAME:PASSWORD@IP:PORT"
    }

    products = []
    page = 1

    while len(products) < limit:

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
            f"&page={page}"
            "&limit=100"
        )

        try:
            response = requests.get(
                url,
                proxies=proxy,
                timeout=10
            )

            response.raise_for_status()

            data = response.json()

        except Exception as e:

            print(
                f"Ошибка Wildberries: {e}"
            )

            return jsonify({
                "error": str(e),
                "products": products
            })

        items = (
            data
            .get("data", {})
            .get("products", [])
        )

        if not items:
            break

        for item in items:

            product_id = item.get(
                "id"
            )

            products.append({
                "title": item.get(
                    "name",
                    "Без названия"
                ),

                "price": (
                    item.get(
                        "salePriceU",
                        0
                    ) // 100
                ),

                "brand": item.get(
                    "brand",
                    ""
                ),

                "image": (
                    f"https://images.wbstatic.net/"
                    f"c516x688/new/"
                    f"{product_id}-1.jpg"
                ),

                "link": (
                    "https://www.wildberries.ru/"
                    f"catalog/{product_id}/detail.aspx"
                )
            })

            if len(products) >= limit:
                break

        page += 1

    print(
        f"Wildberries: найдено {len(products)} товаров"
    )

    return jsonify(products)


# =========================
# MAIN PAGE
# =========================

@app.route("/")
def index():
    return send_from_directory(
        "miniapp",
        "index.html"
    )


# =========================
# JAVASCRIPT
# =========================

@app.route("/script.js")
def script():
    return send_from_directory(
        "miniapp",
        "script.js"
    )


# =========================
# ADMIN
# =========================

@app.route("/admin")
def admin():
    return send_from_directory(
        "miniapp",
        "admin.html"
    )


# =========================
# OTHER MINIAPP FILES
# =========================

@app.route("/miniapp/<path:path>")
def static_files(path):
    return send_from_directory(
        "miniapp",
        path
    )


# =========================
# START SERVER
# =========================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8000
    )
