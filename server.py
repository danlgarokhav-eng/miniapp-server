from flask import Flask, request, jsonify, send_from_directory
import json
import os
import sqlite3
import requests
import re
import time
from datetime import datetime, timezone


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
# REEFAPI
# =========================
# Ключ хранится только на сервере Railway.
REEF_API_KEY = os.getenv("REEF_KEY", "").strip()
REEF_API_BASE = "https://api.reefapi.com"
REEF_FETCH_SIZE = int(os.getenv("REEF_FETCH_SIZE", "100"))
LOCAL_SEARCH_MIN_RESULTS = int(os.getenv("LOCAL_SEARCH_MIN_RESULTS", "30"))
LOCAL_SEARCH_PAGE_SIZE = int(os.getenv("LOCAL_SEARCH_PAGE_SIZE", "100"))


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
            description TEXT,

            image TEXT,
            link TEXT,

            rating REAL,
            reviews INTEGER,

            is_available INTEGER DEFAULT 1,

            availability_status TEXT DEFAULT 'active',
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_checked_at TIMESTAMP,

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

    # ---------------------------------
    # SEARCH CACHE
    # ---------------------------------
    # Храним нормализованные поисковые запросы и последнюю страницу,
    # которую уже получили из внешнего источника.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS search_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            query_key TEXT NOT NULL,
            source TEXT NOT NULL,
            last_fetched_page INTEGER DEFAULT 0,
            last_fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            result_count INTEGER DEFAULT 0,
            UNIQUE(query_key, source)
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_search_source
        ON products(source, is_available, updated_at)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_external
        ON products(source, external_id)
    """)

    # Мягкая миграция существующей SQLite базы:
    # если products.db уже существует со старой схемой,
    # добавляем новые колонки без удаления старых товаров.
    existing_columns = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(products)").fetchall()
    }

    for column, definition in {
        "description": "TEXT",
        "availability_status": "TEXT DEFAULT 'active'",
        "last_seen_at": "TIMESTAMP",
        "last_checked_at": "TIMESTAMP",
    }.items():
        if column not in existing_columns:
            conn.execute(
                f"ALTER TABLE products ADD COLUMN {column} {definition}"
            )

    conn.execute("""
        UPDATE products
        SET availability_status = COALESCE(availability_status, 'active'),
            last_seen_at = COALESCE(last_seen_at, updated_at)
        WHERE availability_status IS NULL
           OR last_seen_at IS NULL
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

        description = product.get(
            "description",
            product.get("desc", "")
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
                description,
                image,
                link,
                rating,
                reviews,
                is_available,
                availability_status,
                last_seen_at,
                updated_at
            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

            ON CONFLICT(source, external_id)
            DO UPDATE SET
                title = excluded.title,
                price = excluded.price,
                old_price = excluded.old_price,
                currency = excluded.currency,
                brand = excluded.brand,
                category = excluded.category,
                description = excluded.description,
                image = excluded.image,
                link = excluded.link,
                rating = excluded.rating,
                reviews = excluded.reviews,
                is_available = excluded.is_available,
                availability_status = CASE
                    WHEN excluded.is_available = 1 THEN 'active'
                    ELSE 'unavailable'
                END,
                last_seen_at = CURRENT_TIMESTAMP,
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
            description,
            image,
            link,
            rating,
            reviews,
            is_available,
            "active" if is_available else "unavailable",
            None
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
            description,
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
            "description": row["description"],

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
# SEARCH / LAZY CATALOG
# =========================

def normalize_search_text(value):
    value = str(value or "").lower().replace("ё", "е")
    value = re.sub(r"[^a-zа-я0-9]+", " ", value, flags=re.IGNORECASE)
    return " ".join(value.split())


def search_tokens(value):
    return [x for x in normalize_search_text(value).split() if len(x) >= 2]


def local_search_products(query, sources=None, min_price=None, max_price=None, limit=100, offset=0):
    """
    Ищет сначала в нашей собственной БД.
    Поиск намеренно строгий: все значимые слова запроса должны встретиться
    хотя бы в одном из title/brand/category/description.
    """
    tokens = search_tokens(query)
    if not tokens:
        return []

    sources = [str(x).lower() for x in (sources or []) if x]

    conn = get_db()
    rows = conn.execute("""
        SELECT
            source, external_id, title, price, old_price, currency,
            brand, category, description, image, link, rating, reviews,
            is_available, availability_status, last_seen_at, last_checked_at,
            created_at, updated_at
        FROM products
        WHERE is_available = 1
    """).fetchall()

    result = []

    for row in rows:
        if sources and row["source"].lower() not in sources:
            continue

        if min_price is not None and (row["price"] is None or float(row["price"] or 0) < min_price):
            continue
        if max_price is not None and (row["price"] is None or float(row["price"] or 0) > max_price):
            continue

        haystack = normalize_search_text(" ".join([
            row["title"] or "",
            row["brand"] or "",
            row["category"] or "",
            row["description"] or "",
        ]))

        words = set(haystack.split())
        if not all(token in words or any(
            len(token) >= 5 and (token in word or word in token)
            for word in words
        ) for token in tokens):
            continue

        exact = sum(1 for token in tokens if token in words)
        prefix = sum(
            1 for token in tokens
            if any(word.startswith(token) for word in words)
        )

        item = {
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
            "description": row["description"],
            "image": row["image"],
            "images": [row["image"]] if row["image"] else [],
            "link": row["link"],
            "url": row["link"],
            "rating": row["rating"],
            "reviews": row["reviews"],
            "available": bool(row["is_available"]),
            "stock": bool(row["is_available"]),
            "availability_status": row["availability_status"],
            "last_seen_at": row["last_seen_at"],
            "last_checked_at": row["last_checked_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "_match_score": exact * 100 + prefix * 10
        }
        result.append(item)

    conn.close()

    result.sort(key=lambda x: (
        -x["_match_score"],
        -(x["updated_at"] or "")
    ))

    for item in result:
        item.pop("_match_score", None)

    return result[offset:offset + limit]


def count_local_search_products(query, sources=None, min_price=None, max_price=None):
    return len(local_search_products(
        query, sources=sources, min_price=min_price, max_price=max_price,
        limit=100000, offset=0
    ))


def reef_wildberries_search(query, page=1, country="by", price_min=None, price_max=None):
    """
    Первый внешний источник для lazy-catalog: Wildberries через ReefAPI.
    Ключ берётся из REEF_KEY на Railway.
    """
    if not REEF_API_KEY:
        return []

    payload = {
        "query": query,
        "country": country,
        "page": max(1, min(int(page), 3)),
    }

    if price_min is not None:
        payload["price_min"] = price_min
    if price_max is not None:
        payload["price_max"] = price_max

    try:
        response = requests.post(
            f"{REEF_API_BASE}/wildberries/v1/search",
            headers={
                "x-api-key": REEF_API_KEY,
                "content-type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        body = response.json()

        if not body.get("ok"):
            print("ReefAPI error:", body.get("error"))
            return []

        data = body.get("data") or {}
        rows = data.get("results") or []

        products = []

        for item in rows:
            product_id = item.get("product_id")
            if not product_id:
                continue

            price = item.get("price")
            was_price = item.get("was_price")

            products.append({
                "source": "wildberries",
                "external_id": str(product_id),
                "title": item.get("title") or item.get("name") or "Без названия",
                "price": price,
                "old_price": was_price,
                "currency": item.get("currency") or "BYN",
                "brand": item.get("brand") or "",
                "category": item.get("category") or "",
                "description": item.get("description") or "",
                "image": item.get("image") or "",
                "link": item.get("url") or "",
                "rating": item.get("rating"),
                "reviews": item.get("review_count") or item.get("reviews"),
                "available": item.get("stock_quantity", 1) != 0,
            })

        return products

    except Exception as e:
        print(f"Ошибка ReefAPI/Wildberries: {e}")
        return []


def get_search_cache(query_key, source):
    conn = get_db()
    row = conn.execute("""
        SELECT query_key, source, last_fetched_page, last_fetched_at, result_count
        FROM search_cache
        WHERE query_key = ? AND source = ?
        LIMIT 1
    """, (query_key, source)).fetchone()
    conn.close()
    return dict(row) if row else None


def update_search_cache(query_key, source, page, result_count):
    conn = get_db()
    conn.execute("""
        INSERT INTO search_cache (
            query_key, source, last_fetched_page, last_fetched_at, result_count
        )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(query_key, source)
        DO UPDATE SET
            last_fetched_page = excluded.last_fetched_page,
            last_fetched_at = CURRENT_TIMESTAMP,
            result_count = excluded.result_count
    """, (query_key, source, page, result_count))
    conn.commit()
    conn.close()


def lazy_search(query, sources=None, min_price=None, max_price=None, limit=100):
    """
    Главная точка lazy-каталога:
    1) ищем в своей БД;
    2) если мало — догружаем внешний источник;
    3) сохраняем новые карточки;
    4) повторно читаем БД и отдаём уже общий накопленный каталог.
    """
    query = normalize_search_text(query)
    sources = [str(x).lower() for x in (sources or []) if x]

    if not query:
        return {
            "products": [],
            "local_count": 0,
            "fetched": 0,
            "source": "local"
        }

    local = local_search_products(
        query,
        sources=sources,
        min_price=min_price,
        max_price=max_price,
        limit=limit
    )

    if len(local) >= min(LOCAL_SEARCH_MIN_RESULTS, limit):
        return {
            "products": local,
            "local_count": len(local),
            "fetched": 0,
            "source": "local"
        }

    fetched_total = 0

    # Сейчас ReefAPI подключён к WB. Остальные источники добавим
    # отдельными адаптерами, не ломая общий механизм.
    wanted_sources = sources or ["wildberries"]

    if "wildberries" in wanted_sources:
        cache = get_search_cache(query, "wildberries")
        next_page = (cache["last_fetched_page"] + 1) if cache else 1

        # Wildberries keyword search у ReefAPI имеет 3 страницы по 100.
        while next_page <= 3:
            new_products = reef_wildberries_search(
                query,
                page=next_page,
                price_min=min_price,
                price_max=max_price
            )

            if not new_products:
                break

            fetched_total += save_products(new_products)
            update_search_cache(
                query,
                "wildberries",
                next_page,
                len(new_products)
            )

            local = local_search_products(
                query,
                sources=sources,
                min_price=min_price,
                max_price=max_price,
                limit=limit
            )

            if len(local) >= min(LOCAL_SEARCH_MIN_RESULTS, limit):
                break

            next_page += 1

    return {
        "products": local,
        "local_count": len(local),
        "fetched": fetched_total,
        "source": "local+reefapi" if fetched_total else "local"
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
# LAZY SEARCH API
# =========================

@app.route("/api/search")
def api_search():
    query = request.args.get("query", "").strip()

    sources_raw = request.args.get("sources", "").strip()
    sources = [
        x.strip().lower()
        for x in sources_raw.split(",")
        if x.strip()
    ]

    def parse_float(name):
        value = request.args.get(name, "").strip()
        if not value:
            return None
        try:
            return float(value)
        except ValueError:
            return None

    min_price = parse_float("min_price")
    max_price = parse_float("max_price")

    try:
        result = lazy_search(
            query,
            sources=sources,
            min_price=min_price,
            max_price=max_price,
            limit=max(1, min(int(request.args.get("limit", LOCAL_SEARCH_PAGE_SIZE)), 200))
        )

        return jsonify({
            "status": "ok",
            "query": query,
            **result
        })

    except Exception as e:
        print(f"Ошибка /api/search: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "products": []
        }), 500


def lazy_search_more(query, sources=None, min_price=None, max_price=None, limit=100):
    """
    Принудительно догружает следующую страницу внешнего источника.

    В отличие от lazy_search() этот метод НЕ останавливается только потому,
    что в локальной БД уже есть 30+ совпадений. Это нужно для бесконечной
    ленты: /api/search/more должен действительно получать следующую пачку.
    """
    query = normalize_search_text(query)
    sources = [str(x).lower() for x in (sources or []) if x]

    if not query:
        return {
            "products": [],
            "local_count": 0,
            "fetched": 0,
            "source": "local",
            "has_more": False
        }

    fetched_total = 0
    wanted_sources = sources or ["wildberries"]

    if "wildberries" in wanted_sources:
        cache = get_search_cache(query, "wildberries")
        next_page = (cache["last_fetched_page"] + 1) if cache else 1

        if next_page <= 3:
            new_products = reef_wildberries_search(
                query,
                page=next_page,
                price_min=min_price,
                price_max=max_price
            )

            if new_products:
                fetched_total = save_products(new_products)
                update_search_cache(
                    query,
                    "wildberries",
                    next_page,
                    len(new_products)
                )

    local = local_search_products(
        query,
        sources=sources,
        min_price=min_price,
        max_price=max_price,
        limit=limit
    )

    has_more = False
    if "wildberries" in wanted_sources:
        cache = get_search_cache(query, "wildberries")
        has_more = bool(cache and cache["last_fetched_page"] < 3)

    return {
        "products": local,
        "local_count": len(local),
        "fetched": fetched_total,
        "source": "local+reefapi" if fetched_total else "local",
        "has_more": has_more
    }


@app.route("/api/search/more")
def api_search_more():
    try:
        query = request.args.get("query", "").strip()

        sources_raw = request.args.get("sources", "").strip()
        sources = [
            x.strip().lower()
            for x in sources_raw.split(",")
            if x.strip()
        ]

        def parse_float(name):
            value = request.args.get(name, "").strip()
            if not value:
                return None
            try:
                return float(value)
            except ValueError:
                return None

        min_price = parse_float("min_price")
        max_price = parse_float("max_price")
        limit = max(1, min(int(request.args.get("limit", LOCAL_SEARCH_PAGE_SIZE)), 200))

        result = lazy_search_more(
            query,
            sources=sources,
            min_price=min_price,
            max_price=max_price,
            limit=limit
        )

        return jsonify({
            "status": "ok",
            "query": query,
            **result
        })

    except Exception as e:
        print(f"Ошибка /api/search/more: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "products": []
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
