from flask import Flask, request, jsonify, send_from_directory
import json
import os
import sqlite3
import requests


app = Flask(__name__)


# =========================
# PATHS
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(
    BASE_DIR,
    "products.db"
)

FEED_PATH = os.path.join(
    BASE_DIR,
    "feed.json"
)

SETTINGS_PATH = os.path.join(
    BASE_DIR,
    "settings.json"
)


# =========================
# DATABASE
# =========================

def get_db():
    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    return conn


def init_db():
    conn = get_db()

    # ---------------------------------
    # PRODUCTS
    # ---------------------------------

    conn.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            source TEXT NOT NULL,
            external_id TEXT NOT NULL,

            title TEXT,
            price REAL,
            old_price REAL,
            currency TEXT,

            brand TEXT,
            category TEXT,

            image TEXT,
            link TEXT,

            rating REAL,
            reviews INTEGER,

            is_available INTEGER DEFAULT 1,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(source, external_id)
        )
    """)

    # ---------------------------------
    # USER HISTORY
    # ---------------------------------

    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            action TEXT NOT NULL,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Индекс для быстрого получения истории конкретного пользователя
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_history_user
        ON user_history(user_id)
    """)

    # Индекс для поиска конкретного товара пользователя
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_history_product
        ON user_history(user_id, product_id)
    """)

    conn.commit()
    conn.close()

    print("========================================")
    print("База данных инициализирована")
    print(f"DB: {DB_PATH}")
    print("Таблица товаров: OK")
    print("Таблица истории пользователей: OK")
    print("========================================")


# =========================
# PRODUCTS
# =========================

def save_products(products):

    if not isinstance(products, list):
        return 0

    if not products:
        return 0

    conn = get_db()

    saved = 0

    for product in products:

        if not isinstance(product, dict):
            continue

        source = str(
            product.get("source", "unknown")
        )

        external_id = product.get(
            "external_id"
        )

        if not external_id:
            external_id = product.get(
                "id"
            )

        if not external_id:
            continue

        external_id = str(external_id)

        title = product.get(
            "title",
            product.get("name", "")
        )

        price = product.get(
            "price",
            0
        )

        old_price = product.get(
            "oldPrice",
            product.get("old_price")
        )

        currency = product.get(
            "currency",
            "RUB"
        )

        brand = product.get(
            "brand",
            ""
        )

        category = product.get(
            "category",
            ""
        )

        image = product.get(
            "image",
            ""
        )

        if not image:
            images = product.get(
                "images",
                []
            )

            if isinstance(images, list) and images:
                image = images[0]

        link = product.get(
            "link",
            product.get("url", "")
        )

        rating = product.get(
            "rating"
        )

        reviews = product.get(
            "reviews"
        )

        available = product.get(
            "available",
            product.get("stock", True)
        )

        is_available = 1 if available else 0

        conn.execute("""
            INSERT INTO products (
                source,
                external_id,
                title,
                price,
                old_price,
                currency,
                brand,
                category,
                image,
                link,
                rating,
                reviews,
                is_available,
                updated_at
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

            ON CONFLICT(source, external_id)
            DO UPDATE SET
                title = excluded.title,
                price = excluded.price,
                old_price = excluded.old_price,
                currency = excluded.currency,
                brand = excluded.brand,
                category = excluded.category,
                image = excluded.image,
                link = excluded.link,
                rating = excluded.rating,
                reviews = excluded.reviews,
                is_available = excluded.is_available,
                updated_at = CURRENT_TIMESTAMP
        """, (
            source,
            external_id,
            title,
            price,
            old_price,
            currency,
            brand,
            category,
            image,
            link,
            rating,
            reviews,
            is_available
        ))

        saved += 1

    conn.commit()
    conn.close()

    return saved


def get_all_products():

    conn = get_db()

    rows = conn.execute("""
        SELECT
            source,
            external_id,
            title,
            price,
            old_price,
            currency,
            brand,
            category,
            image,
            link,
            rating,
            reviews,
            is_available
        FROM products
        WHERE is_available = 1
        ORDER BY updated_at DESC
    """).fetchall()

    conn.close()

    products = []

    for row in rows:

        products.append({
            "id": f"{row['source']}_{row['external_id']}",

            "source": row["source"],
            "external_id": row["external_id"],

            "title": row["title"],
            "name": row["title"],

            "price": row["price"],
            "oldPrice": row["old_price"],
            "currency": row["currency"],

            "brand": row["brand"],
            "category": row["category"],

            "image": row["image"],
            "images": (
                [row["image"]]
                if row["image"]
                else []
            ),

            "link": row["link"],
            "url": row["link"],

            "rating": row["rating"],
            "reviews": row["reviews"],

            "available": bool(
                row["is_available"]
            ),

            "stock": bool(
                row["is_available"]
            )
        })

    return products


def get_database_stats():

    conn = get_db()

    total = conn.execute("""
        SELECT COUNT(*)
        FROM products
    """).fetchone()[0]

    available = conn.execute("""
        SELECT COUNT(*)
        FROM products
        WHERE is_available = 1
    """).fetchone()[0]

    kufar = conn.execute("""
        SELECT COUNT(*)
        FROM products
        WHERE source = 'kufar'
    """).fetchone()[0]

    wildberries = conn.execute("""
        SELECT COUNT(*)
        FROM products
        WHERE source = 'wildberries'
    """).fetchone()[0]

    conn.close()

    return {
        "total": total,
        "available": available,
        "kufar": kufar,
        "wildberries": wildberries
    }


# =========================
# USER HISTORY
# =========================

def save_user_action(
    user_id,
    product_id,
    action
):

    if not user_id:
        return False

    if not product_id:
        return False

    if action not in {
        "view",
        "open"
    }:
        return False

    user_id = str(user_id)
    product_id = str(product_id)

    conn = get_db()

    # ---------------------------------
    # VIEW
    #
    # Один товар считается просмотренным
    # только один раз.
    # ---------------------------------

    if action == "view":

        existing = conn.execute("""
            SELECT id
            FROM user_history
            WHERE user_id = ?
              AND product_id = ?
              AND action = 'view'
            LIMIT 1
        """, (
            user_id,
            product_id
        )).fetchone()

        if existing:

            conn.close()

            return True

    # ---------------------------------
    # OPEN
    #
    # Открытия сохраняем как события.
    # Это пригодится позже для алгоритма
    # рекомендаций.
    # ---------------------------------

    conn.execute("""
        INSERT INTO user_history (
            user_id,
            product_id,
            action
        )

        VALUES (?, ?, ?)
    """, (
        user_id,
        product_id,
        action
    ))

    conn.commit()
    conn.close()

    return True


def get_user_history(user_id):

    if not user_id:
        return {
            "viewed": [],
            "opened": []
        }

    user_id = str(user_id)

    conn = get_db()

    # ---------------------------------
    # VIEWED
    # ---------------------------------

    viewed_rows = conn.execute("""
        SELECT DISTINCT product_id
        FROM user_history
        WHERE user_id = ?
          AND action = 'view'
        ORDER BY product_id
    """, (
        user_id,
    )).fetchall()

    # ---------------------------------
    # OPENED
    # ---------------------------------

    opened_rows = conn.execute("""
        SELECT product_id
        FROM user_history
        WHERE user_id = ?
          AND action = 'open'
        ORDER BY id ASC
    """, (
        user_id,
    )).fetchall()

    conn.close()

    viewed = [
        str(row["product_id"])
        for row in viewed_rows
    ]

    opened = [
        str(row["product_id"])
        for row in opened_rows
    ]

    return {
        "viewed": viewed,
        "opened": opened
    }


# =========================
# INITIALIZE DATABASE
# =========================

init_db()


# =========================
# FEED UPDATE
# =========================

@app.route(
    "/update_feed",
    methods=["POST"]
)
def update_feed():

    data = request.json

    if not isinstance(data, list):

        return jsonify({
            "status": "error",
            "message": "Ожидался список товаров"
        }), 400

    try:

        saved = save_products(data)

        products = get_all_products()

        stats = get_database_stats()

        # ---------------------------------
        # Сохраняем последнюю загрузку
        # только для совместимости
        # ---------------------------------

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
            "========================================"
        )

        print(
            f"Получено товаров: {len(data)}"
        )

        print(
            f"Сохранено/обновлено: {saved}"
        )

        print(
            f"Всего в базе: {stats['total']}"
        )

        print(
            f"Доступно: {stats['available']}"
        )

        print(
            f"Kufar: {stats['kufar']}"
        )

        print(
            f"Wildberries: {stats['wildberries']}"
        )

        print(
            "========================================"
        )

        return jsonify({
            "status": "ok",

            "received": len(data),

            "saved": saved,

            "total": stats["total"],

            "available": stats["available"],

            "kufar": stats["kufar"],

            "wildberries": stats["wildberries"],

            "products": products
        })

    except Exception as e:

        print(
            f"Ошибка сохранения товаров: {e}"
        )

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================
# API FEED
# =========================

@app.route("/api/feed")
def api_feed():

    try:

        products = get_all_products()

        print(
            f"Отдаю из базы: {len(products)} товаров"
        )

        return jsonify(products)

    except Exception as e:

        print(
            f"Ошибка чтения базы: {e}"
        )

        return jsonify([])


# =========================
# USER HISTORY API
# =========================

@app.route(
    "/api/user/history",
    methods=["GET"]
)
def api_user_history():

    user_id = request.args.get(
        "user_id",
        ""
    )

    if not user_id:

        return jsonify({
            "status": "error",
            "message": "Не указан user_id"
        }), 400

    try:

        history = get_user_history(
            user_id
        )

        print(
            "История пользователя "
            f"{user_id}: "
            f"viewed={len(history['viewed'])}, "
            f"opened={len(history['opened'])}"
        )

        return jsonify({
            "status": "ok",
            "user_id": str(user_id),

            "viewed": history["viewed"],
            "opened": history["opened"]
        })

    except Exception as e:

        print(
            f"Ошибка получения истории пользователя: {e}"
        )

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================
# USER VIEW
# =========================

@app.route(
    "/api/user/view",
    methods=["POST"]
)
def api_user_view():

    data = request.get_json(
        silent=True
    ) or {}

    user_id = data.get(
        "user_id"
    )

    product_id = data.get(
        "product_id"
    )

    if not user_id or not product_id:

        return jsonify({
            "status": "error",
            "message": "Нужны user_id и product_id"
        }), 400

    try:

        saved = save_user_action(
            user_id,
            product_id,
            "view"
        )

        if not saved:

            return jsonify({
                "status": "error",
                "message": "Не удалось сохранить просмотр"
            }), 400

        print(
            f"VIEW | user={user_id} | product={product_id}"
        )

        return jsonify({
            "status": "ok",
            "action": "view",
            "user_id": str(user_id),
            "product_id": str(product_id)
        })

    except Exception as e:

        print(
            f"Ошибка сохранения VIEW: {e}"
        )

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================
# USER OPEN
# =========================

@app.route(
    "/api/user/open",
    methods=["POST"]
)
def api_user_open():

    data = request.get_json(
        silent=True
    ) or {}

    user_id = data.get(
        "user_id"
    )

    product_id = data.get(
        "product_id"
    )

    if not user_id or not product_id:

        return jsonify({
            "status": "error",
            "message": "Нужны user_id и product_id"
        }), 400

    try:

        saved = save_user_action(
            user_id,
            product_id,
            "open"
        )

        if not saved:

            return jsonify({
                "status": "error",
                "message": "Не удалось сохранить открытие"
            }), 400

        print(
            f"OPEN | user={user_id} | product={product_id}"
        )

        return jsonify({
            "status": "ok",
            "action": "open",
            "user_id": str(user_id),
            "product_id": str(product_id)
        })

    except Exception as e:

        print(
            f"Ошибка сохранения OPEN: {e}"
        )

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================
# DATABASE INFO
# =========================

@app.route("/api/database")
def api_database():

    try:

        stats = get_database_stats()

        conn = get_db()

        users = conn.execute("""
            SELECT COUNT(DISTINCT user_id)
            FROM user_history
        """).fetchone()[0]

        history_events = conn.execute("""
            SELECT COUNT(*)
            FROM user_history
        """).fetchone()[0]

        conn.close()

        return jsonify({
            "status": "ok",

            "total": stats["total"],
            "available": stats["available"],
            "kufar": stats["kufar"],
            "wildberries": stats["wildberries"],

            "users": users,
            "history_events": history_events
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# =========================
# SETTINGS
# =========================

@app.route("/api/settings")
def api_settings():

    if not os.path.exists(
        SETTINGS_PATH
    ):

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

            sale_price = item.get(
                "salePriceU",
                0
            )

            products.append({

                "id": str(product_id),

                "source": "wildberries",

                "external_id": str(
                    product_id
                ),

                "title": item.get(
                    "name",
                    "Без названия"
                ),

                "price": (
                    sale_price / 100
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
                ),

                "currency": "RUB",

                "available": True

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

@app.route(
    "/miniapp/<path:path>"
)
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
