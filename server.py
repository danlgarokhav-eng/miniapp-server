from flask import Flask, request, jsonify, send_from_directory
import json
import os
import sqlite3
import requests
import re
import time
import hashlib
import hmac
import secrets
import urllib.parse
from datetime import datetime, timezone


app = Flask(__name__)


# =========================
# PATHS
# =========================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Railway Volume: /data.
# Локально, если /data недоступна, используем папку проекта.
DATA_DIR = os.getenv("DATA_DIR", "/data")
try:
    os.makedirs(DATA_DIR, exist_ok=True)
except Exception:
    DATA_DIR = BASE_DIR


def persistent_path(filename):
    return os.path.join(DATA_DIR, filename)


def migrate_legacy_file(filename):
    target = persistent_path(filename)
    legacy = os.path.join(BASE_DIR, filename)

    if DATA_DIR == BASE_DIR:
        return target

    if not os.path.exists(target) and os.path.exists(legacy):
        try:
            import shutil
            shutil.copy2(legacy, target)
            print(f"Миграция {filename}: {legacy} -> {target}")
        except Exception as exc:
            print(f"Не удалось мигрировать {filename}: {exc}")

    return target


DB_PATH = migrate_legacy_file("products.db")
FEED_PATH = migrate_legacy_file("feed.json")
SETTINGS_PATH = migrate_legacy_file("settings.json")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", os.getenv("BOT_TOKEN", "")).strip()
SESSION_COOKIE_NAME = "styleflow_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30


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


def _table_columns(conn, table_name):
    """Возвращает набор колонок существующей SQLite-таблицы."""
    try:
        return {
            row["name"]
            for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        }
    except Exception:
        return set()


def _add_column_if_missing(conn, table_name, column_name, definition):
    columns = _table_columns(conn, table_name)
    if column_name not in columns:
        conn.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
        )
        return True
    return False


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
    # STYLEFLOW USERS
    # ВАЖНО: users создаём ДО таблиц, которые ссылаются на users.id.
    # ---------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT NOT NULL UNIQUE,
            telegram_username TEXT,
            first_name TEXT,
            last_name TEXT,
            photo_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            recommendations_reset_at TIMESTAMP
        )
    """)

    # Миграция старой таблицы users, если она была создана предыдущей версией.
    _add_column_if_missing(conn, "users", "telegram_username", "TEXT")
    _add_column_if_missing(conn, "users", "first_name", "TEXT")
    _add_column_if_missing(conn, "users", "last_name", "TEXT")
    _add_column_if_missing(conn, "users", "photo_url", "TEXT")
    _add_column_if_missing(conn, "users", "created_at", "TIMESTAMP")
    _add_column_if_missing(conn, "users", "last_login_at", "TIMESTAMP")
    _add_column_if_missing(conn, "users", "recommendations_reset_at", "TIMESTAMP")

    # ---------------------------------
    # SESSIONS
    # ---------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_sessions_token_hash
        ON sessions(token_hash)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_sessions_user
        ON sessions(user_id)
    """)

    # ---------------------------------
    # USER HISTORY
    # ---------------------------------
    # Эта таблица исторически использовала user_id TEXT.
    # Сейчас туда записывается постоянный STYLEFLOW account_id в виде строки.
    # Поэтому существующие записи можно сохранить без пересоздания таблицы.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            action TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_history_user
        ON user_history(user_id)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_history_product
        ON user_history(user_id, product_id)
    """)

    # ---------------------------------
    # USER FAVORITES
    # ---------------------------------
    # В v7 таблица имела user_id INTEGER NOT NULL.
    # В v8+ используется account_id. Если обнаружена старая схема,
    # пересобираем только эту маленькую таблицу и переносим все записи.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            product_id TEXT NOT NULL,
            product_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(account_id, product_id),
            FOREIGN KEY(account_id) REFERENCES users(id)
        )
    """)

    favorite_columns = _table_columns(conn, "user_favorites")

    if "user_id" in favorite_columns and "account_id" not in favorite_columns:
        # Старая v7-схема. Создаём чистую v8-схему и переносим данные.
        conn.execute("DROP TABLE IF EXISTS user_favorites_migration")
        conn.execute("""
            CREATE TABLE user_favorites_migration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                product_id TEXT NOT NULL,
                product_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(account_id, product_id),
                FOREIGN KEY(account_id) REFERENCES users(id)
            )
        """)

        conn.execute("""
            INSERT OR IGNORE INTO user_favorites_migration
                (id, account_id, product_id, product_json, created_at, updated_at)
            SELECT
                id,
                CAST(user_id AS INTEGER),
                product_id,
                product_json,
                created_at,
                updated_at
            FROM user_favorites
            WHERE user_id IS NOT NULL
        """)

        conn.execute("DROP TABLE user_favorites")
        conn.execute("ALTER TABLE user_favorites_migration RENAME TO user_favorites")
        print("Миграция user_favorites: user_id -> account_id выполнена")

    # Если таблица была создана промежуточной версией, достраиваем недостающие поля.
    favorite_columns = _table_columns(conn, "user_favorites")
    if "account_id" not in favorite_columns:
        conn.execute("ALTER TABLE user_favorites ADD COLUMN account_id INTEGER")
    if "product_json" not in favorite_columns:
        conn.execute("ALTER TABLE user_favorites ADD COLUMN product_json TEXT")
    if "created_at" not in favorite_columns:
        conn.execute("ALTER TABLE user_favorites ADD COLUMN created_at TIMESTAMP")
    if "updated_at" not in favorite_columns:
        conn.execute("ALTER TABLE user_favorites ADD COLUMN updated_at TIMESTAMP")

    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_user_favorites_account_product
        ON user_favorites(account_id, product_id)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_favorites_account
        ON user_favorites(account_id, updated_at)
    """)

    # ---------------------------------
    # USER SEARCH EVENTS
    # ---------------------------------
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            query TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(account_id) REFERENCES users(id)
        )
    """)

    search_columns = _table_columns(conn, "user_searches")
    if "account_id" not in search_columns:
        conn.execute("ALTER TABLE user_searches ADD COLUMN account_id INTEGER")
        search_columns = _table_columns(conn, "user_searches")
    if "query" not in search_columns:
        conn.execute("ALTER TABLE user_searches ADD COLUMN query TEXT")
    if "created_at" not in search_columns:
        conn.execute("ALTER TABLE user_searches ADD COLUMN created_at TIMESTAMP")

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_searches_account
        ON user_searches(account_id, created_at)
    """)

    # ---------------------------------
    # SEARCH CACHE
    # ---------------------------------
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

    # ---------------------------------
    # PRODUCTS — мягкая миграция старой базы
    # ---------------------------------
    existing_columns = _table_columns(conn, "products")
    for column, definition in {
        "description": "TEXT",
        "availability_status": "TEXT DEFAULT 'active'",
        "last_seen_at": "TIMESTAMP",
        "last_checked_at": "TIMESTAMP",
        "created_at": "TIMESTAMP",
        "updated_at": "TIMESTAMP",
    }.items():
        if column not in existing_columns:
            conn.execute(
                f"ALTER TABLE products ADD COLUMN {column} {definition}"
            )

    conn.execute("""
        UPDATE products
        SET availability_status = COALESCE(availability_status, 'active'),
            last_seen_at = COALESCE(last_seen_at, updated_at, CURRENT_TIMESTAMP),
            created_at = COALESCE(created_at, CURRENT_TIMESTAMP),
            updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
        WHERE availability_status IS NULL
           OR last_seen_at IS NULL
           OR created_at IS NULL
           OR updated_at IS NULL
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_search_source
        ON products(source, is_available, updated_at)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_external
        ON products(source, external_id)
    """)

    conn.commit()
    conn.close()

    print("========================================")
    print("База данных инициализирована / миграция OK")
    print(f"DB: {DB_PATH}")
    print("Товары: OK")
    print("Пользователи: OK")
    print("История: OK")
    print("Избранное: OK")
    print("Поисковые события: OK")
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


def get_all_products(limit=None, offset=0):

    conn = get_db()

    sql = """
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
    """

    params = []
    if limit is not None:
        sql += " LIMIT ? OFFSET ?"
        params.extend([max(1, int(limit)), max(0, int(offset))])

    rows = conn.execute(sql, params).fetchall()

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


def get_account_recommendation_profile(account_id):
    """Лёгкий серверный профиль для предзагрузки: история + избранное."""
    account_id = str(account_id)
    conn = get_db()
    history_rows = conn.execute(
        "SELECT product_id, action FROM user_history WHERE user_id = ? ORDER BY id DESC LIMIT 500",
        (account_id,)
    ).fetchall()
    favorite_rows = conn.execute(
        "SELECT product_id FROM user_favorites WHERE account_id = ? ORDER BY id DESC LIMIT 300",
        (account_id,)
    ).fetchall()
    search_rows = conn.execute(
        "SELECT query FROM user_searches WHERE account_id = ? ORDER BY id DESC LIMIT 50",
        (account_id,)
    ).fetchall()
    conn.close()
    viewed = {str(r["product_id"]) for r in history_rows if r["action"] == "view"}
    opened = [str(r["product_id"]) for r in history_rows if r["action"] == "open"]
    favorites = {str(r["product_id"]) for r in favorite_rows}
    queries = [str(r["query"]) for r in search_rows]
    return viewed, set(opened), favorites, queries


def score_server_product(product, opened, favorite_ids, queries):
    text = normalize_search_text(" ".join([
        product.get("title") or "",
        product.get("brand") or "",
        product.get("category") or "",
        product.get("description") or ""
    ]))
    score = 0.0
    pid = str(product.get("id"))
    if pid in favorite_ids:
        score += 50
    if pid in opened:
        score += 15
    for query in queries[-20:]:
        for token in search_tokens(query):
            if token in text:
                score += 5
    return score


def get_recommended_feed_products(account_id, limit=120, offset=0):
    """Персональная лента с отдельным порядком для каждого STYLEFLOW account."""
    account_id = str(account_id)
    viewed, opened, favorite_ids, queries = get_account_recommendation_profile(account_id)
    candidates = get_all_products(limit=2500, offset=0)
    conn = get_db()
    reset_row = conn.execute("SELECT recommendations_reset_at FROM users WHERE id = ? LIMIT 1", (int(account_id),)).fetchone()
    conn.close()
    reset_marker = str(reset_row["recommendations_reset_at"] or "") if reset_row else ""
    import hashlib
    safe = []
    for product in candidates:
        pid = str(product.get("id"))
        if is_adult_text(product.get("title"), product.get("category"), product.get("description"), product.get("brand")):
            continue
        if pid in viewed:
            continue
        score = score_server_product(product, opened, favorite_ids, queries)
        digest = hashlib.sha256(f"styleflow:{account_id}:{reset_marker}:{pid}".encode("utf-8")).hexdigest()
        tie = int(digest[:12], 16) / float(16 ** 12)
        safe.append((score, tie, product))
    safe.sort(key=lambda x: (x[0], x[1]), reverse=True)
    selected = [p for _, _, p in safe[offset:offset + limit]]
    return selected, len(safe)

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
# CONTENT SAFETY / ADULT PRODUCTS
# =========================

ADULT_TERMS = (
    "дилдо", "вибратор", "фаллоимитатор", "секс", "порно", "порнография",
    "эротика", "эротическое", "интим", "проститут", "секс игруш",
    "sex", "porn", "dildo", "vibrator", "xxx", "adult"
)


def is_adult_text(*values):
    text = normalize_search_text(" ".join(str(v or "") for v in values))
    return any(term in text for term in ADULT_TERMS)


def is_adult_product_row(row):
    return is_adult_text(
        row["title"] if "title" in row.keys() else "",
        row["category"] if "category" in row.keys() else "",
        row["description"] if "description" in row.keys() else "",
        row["brand"] if "brand" in row.keys() else "",
    )


def is_adult_query(query):
    return is_adult_text(query)


def current_account():
    token = request.cookies.get(SESSION_COOKIE_NAME, "").strip()
    if not token:
        return None

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    conn = get_db()
    cleanup_expired_sessions(conn)
    row = conn.execute("""
        SELECT u.id AS account_id, u.telegram_id, u.telegram_username,
               u.first_name, u.last_name, u.photo_url,
               u.created_at, u.last_login_at, u.recommendations_reset_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
        LIMIT 1
    """, (token_hash,)).fetchone()
    if row:
        conn.execute(
            "UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
            (token_hash,)
        )
        conn.commit()
    conn.close()
    return dict(row) if row else None

# =========================
# SEARCH / LAZY CATALOG
# =========================

def normalize_search_text(value):
    value = str(value or "").lower().replace("ё", "е")
    value = re.sub(r"[^a-zа-я0-9]+", " ", value, flags=re.IGNORECASE)
    return " ".join(value.split())


def search_tokens(value):
    return [x for x in normalize_search_text(value).split() if len(x) >= 2]


def strict_search_token_matches(token, text):
    token = normalize_search_text(token)
    text = normalize_search_text(text)
    if not token or not text:
        return False
    words = re.findall(r"[a-zа-я0-9]+", text, flags=re.IGNORECASE)
    aliases = {
        "айфон": {"iphone"}, "iphone": {"айфон"},
        "самсунг": {"samsung"}, "samsung": {"самсунг"},
        "телефон": {"смартфон", "смартфоны", "phone", "iphone"},
        "смартфон": {"телефон", "phone", "iphone", "айфон"},
    }
    variants = {token, *aliases.get(token, set())}
    for word in words:
        for variant in variants:
            if word == variant or word.startswith(variant) or variant.startswith(word):
                return True
            if len(variant) >= 5 and len(word) >= 5 and (variant in word or word in variant):
                return True
    return False


def strict_product_matches_query(product, query):
    tokens = search_tokens(query)
    if not tokens:
        return False
    core = " ".join([product.get("title") or "", product.get("brand") or "", product.get("category") or ""])
    return all(strict_search_token_matches(t, core) for t in tokens)


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

    explicit_adult_query = is_adult_query(query)

    for row in rows:
        if not explicit_adult_query and is_adult_product_row(row):
            continue

        if sources and row["source"].lower() not in sources:
            continue

        if min_price is not None and (row["price"] is None or float(row["price"] or 0) < min_price):
            continue
        if max_price is not None and (row["price"] is None or float(row["price"] or 0) > max_price):
            continue

        product_for_match = {
            "title": row["title"],
            "brand": row["brand"],
            "category": row["category"],
            "description": row["description"],
        }
        if not strict_product_matches_query(product_for_match, query):
            continue

        searchable = normalize_search_text(" ".join([row["title"] or "", row["brand"] or "", row["category"] or ""]))
        words = set(searchable.split())
        exact = sum(1 for token in tokens if token in words)
        prefix = sum(1 for token in tokens if strict_search_token_matches(token, searchable))

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

    # updated_at в SQLite хранится как строка timestamp, поэтому
    # нельзя делать перед ним унарный минус. Сортируем оба поля
    # по убыванию через reverse=True.
    result.sort(
        key=lambda x: (
            x["_match_score"],
            x["updated_at"] or ""
        ),
        reverse=True
    )

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


KUFAR_API_URL = "https://cre-api.kufar.by/ads-search/v1/engine/v1/search/rendered-paginated"
KUFAR_IMAGE_BASE = "https://rms.kufar.by/v1/gallery/"
KUFAR_FETCH_SIZE = int(os.getenv("KUFAR_FETCH_SIZE", "100"))


def _first_value(obj, *keys, default=None):
    if not isinstance(obj, dict):
        return default
    for key in keys:
        if key in obj and obj[key] not in (None, ""):
            return obj[key]
    return default


def _kufar_photo_url(photo):
    if isinstance(photo, str):
        if photo.startswith("http"):
            return photo
        return KUFAR_IMAGE_BASE + photo.lstrip("/")
    if isinstance(photo, dict):
        value = _first_value(photo, "url", "path", "id", "name")
        if value:
            if str(value).startswith("http"):
                return str(value)
            return KUFAR_IMAGE_BASE + str(value).lstrip("/")
    return ""


def kufar_search(query, page=1, size=None):
    """Получает объявления Куфара и приводит их к единому формату STYLEFLOW."""
    size = max(10, min(int(size or KUFAR_FETCH_SIZE), 100))
    params = {
        "size": size,
        "sort": "lst.d",
        "query": query,
    }
    # Текущий endpoint Куфара использует cursor, но старые ответы могли
    # не содержать его. Для совместимости поддерживаем оба варианта.
    cache = get_search_cache(normalize_search_text(query), "kufar")
    if cache and cache.get("result_count"):
        # Cursor отдельно не храним в старой таблице; первый запрос безопаснее,
        # а повторный вызов всё равно дедуплицируется SQLite UNIQUE.
        pass

    try:
        response = requests.get(
            KUFAR_API_URL,
            params=params,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36",
                "Accept": "application/json,text/plain,*/*",
            },
            timeout=25,
        )
        response.raise_for_status()
        body = response.json()
    except Exception as exc:
        print(f"Ошибка Kufar search '{query}': {exc}")
        return []

    raw = []
    if isinstance(body, dict):
        candidates = [
            body.get("ads"), body.get("items"), body.get("results"),
            body.get("listings"),
            (body.get("data") or {}).get("ads") if isinstance(body.get("data"), dict) else None,
            (body.get("data") or {}).get("items") if isinstance(body.get("data"), dict) else None,
            (body.get("data") or {}).get("results") if isinstance(body.get("data"), dict) else None,
        ]
        for candidate in candidates:
            if isinstance(candidate, list):
                raw = candidate
                break
    elif isinstance(body, list):
        raw = body

    products = []
    for item in raw:
        if not isinstance(item, dict):
            continue

        external_id = _first_value(item, "ad_id", "id", "advert_id", "cid")
        if not external_id:
            continue

        title = _first_value(item, "subject", "title", "name", default="Без названия")
        description = _first_value(item, "body", "description", "description_text", default="")
        category = _first_value(item, "category_name", "category", default="")
        brand = _first_value(item, "brand", "brand_name", default="")
        link = _first_value(item, "ad_link", "url", "link", default="")

        price = _first_value(item, "price", "price_byn", "price_value", default=0)
        if isinstance(price, dict):
            price = _first_value(price, "value", "amount", default=0)
        try:
            price = float(price or 0)
        except Exception:
            price = 0

        # В некоторых ответах Куфар цена приходит в копейках (3500 -> 35.00).
        # Если явно указана денежная единица/формат в копейках — переводим.
        # В тестовом ответе Куфара цена приходит как целое число в копейках:
        # например 3500 = 35.00 BYN. Для полей price/price_value используем
        # этот формат; если API явно отдаёт уже денежный amount — не делим.
        raw_text = str(price).strip().replace(" ", "")
        explicit_cents = item.get("price_cents") is not None
        if explicit_cents or raw_text.isdigit():
            price = float(price or 0) / 100.0
        else:
            price = float(price or 0)

        photos = _first_value(item, "photos", "images", "gallery", default=[])
        if isinstance(photos, dict):
            photos = list(photos.values())
        if not isinstance(photos, list):
            photos = [photos] if photos else []
        images = [u for u in (_kufar_photo_url(x) for x in photos) if u]

        products.append({
            "source": "kufar",
            "external_id": str(external_id),
            "title": str(title or "Без названия"),
            "price": price,
            "old_price": _first_value(item, "old_price", "regular_price", default=None),
            "currency": _first_value(item, "currency", "currency_code", default="BYN"),
            "brand": str(brand or ""),
            "category": str(category or ""),
            "description": str(description or ""),
            "image": images[0] if images else _kufar_photo_url(_first_value(item, "image", default="")),
            "images": images,
            "link": str(link or ""),
            "rating": _first_value(item, "rating", default=None),
            "reviews": _first_value(item, "reviews", "review_count", default=None),
            "available": True,
        })

    return products


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
    """Полный поиск: локальная БД + Wildberries/ReefAPI + Kufar."""
    query = normalize_search_text(query)
    sources = [str(x).lower() for x in (sources or []) if x]

    if not query:
        return {"products": [], "local_count": 0, "fetched": 0, "source": "local", "has_more": False}

    local = local_search_products(query, sources=sources, min_price=min_price, max_price=max_price, limit=limit)
    fetched_total = 0
    wanted_sources = sources or ["wildberries", "kufar"]

    # First page from both active sources. This makes a fresh search actually search
    # both marketplaces instead of relying on whatever happens to be in SQLite.
    if "wildberries" in wanted_sources:
        cache = get_search_cache(query, "wildberries")
        next_page = (cache["last_fetched_page"] + 1) if cache else 1
        if next_page <= 3:
            new_products = reef_wildberries_search(query, page=next_page, price_min=min_price, price_max=max_price)
            if new_products:
                fetched_total += save_products(new_products)
                update_search_cache(query, "wildberries", next_page, len(new_products))

    if "kufar" in wanted_sources:
        # Куфар отдаёт первую страницу по query; SQLite дедуплицирует повторные карточки.
        new_products = kufar_search(query, page=1, size=KUFAR_FETCH_SIZE)
        if new_products:
            fetched_total += save_products(new_products)
            update_search_cache(query, "kufar", 1, len(new_products))

    local = local_search_products(query, sources=sources, min_price=min_price, max_price=max_price, limit=limit)

    return {
        "products": local,
        "local_count": len(local),
        "fetched": fetched_total,
        "source": "local+wildberries+kufar" if fetched_total else "local",
        "has_more": bool(fetched_total)
    }



# =========================
# STYLEFLOW ACCOUNT / TELEGRAM AUTH
# =========================

def verify_telegram_init_data(init_data):
    """Проверяет подпись Telegram WebApp initData."""
    if not init_data or not TELEGRAM_BOT_TOKEN:
        return None

    try:
        parsed = dict(urllib.parse.parse_qsl(init_data, keep_blank_values=True))
        received_hash = parsed.pop("hash", "")
        if not received_hash:
            return None

        data_check_string = "\n".join(
            f"{key}={value}"
            for key, value in sorted(parsed.items())
        )

        secret_key = hmac.new(
            b"WebAppData",
            TELEGRAM_BOT_TOKEN.encode("utf-8"),
            hashlib.sha256
        ).digest()

        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, received_hash):
            return None

        user_raw = parsed.get("user", "")
        if not user_raw:
            return None

        user = json.loads(user_raw)
        if not user.get("id"):
            return None

        return user
    except Exception as exc:
        print(f"Ошибка проверки Telegram initData: {exc}")
        return None


def hash_session_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def cleanup_expired_sessions(conn):
    conn.execute(
        "DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP"
    )


def create_styleflow_session(conn, user_id):
    token = secrets.token_urlsafe(48)
    token_hash = hash_session_token(token)

    conn.execute(
        """
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES (?, ?, datetime('now', '+30 days'))
        """,
        (user_id, token_hash)
    )

    return token


def get_current_account():
    token = request.cookies.get(SESSION_COOKIE_NAME, "").strip()
    if not token:
        return None

    token_hash = hash_session_token(token)
    conn = get_db()
    cleanup_expired_sessions(conn)

    row = conn.execute(
        """
        SELECT
            u.id AS account_id,
            u.telegram_id,
            u.telegram_username,
            u.first_name,
            u.last_name,
            u.photo_url,
            u.created_at,
            u.last_login_at,
            u.recommendations_reset_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
          AND s.expires_at > CURRENT_TIMESTAMP
        LIMIT 1
        """,
        (token_hash,)
    ).fetchone()

    if row:
        conn.execute(
            "UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
            (token_hash,)
        )
        conn.commit()

    conn.close()
    return dict(row) if row else None


def account_public(row):
    if not row:
        return None

    name = " ".join(
        x for x in [row.get("first_name"), row.get("last_name")]
        if x
    ).strip()

    if not name:
        name = row.get("telegram_username") or "Пользователь STYLEFLOW"

    return {
        "id": int(row["account_id"]),
        "name": name,
        "first_name": row.get("first_name") or "",
        "last_name": row.get("last_name") or "",
        "username": row.get("telegram_username") or "",
        "photo_url": row.get("photo_url") or "",
        "telegram_id": str(row["telegram_id"]),
        "created_at": row.get("created_at"),
    }


@app.route("/api/auth/telegram", methods=["POST"])
def api_auth_telegram():
    data = request.get_json(silent=True) or {}
    init_data = str(data.get("init_data") or "").strip()

    if not init_data:
        return jsonify({
            "status": "error",
            "message": "Telegram initData не передан"
        }), 400

    if not TELEGRAM_BOT_TOKEN:
        return jsonify({
            "status": "error",
            "verified": False,
            "message": "На сервере не задан TELEGRAM_BOT_TOKEN"
        }), 503

    telegram_user = verify_telegram_init_data(init_data)
    if not telegram_user:
        return jsonify({
            "status": "error",
            "verified": False,
            "message": "Telegram initData не прошёл проверку"
        }), 401

    telegram_id = str(telegram_user["id"])
    username = telegram_user.get("username") or ""
    first_name = telegram_user.get("first_name") or ""
    last_name = telegram_user.get("last_name") or ""
    photo_url = telegram_user.get("photo_url") or ""

    conn = get_db()
    cleanup_expired_sessions(conn)

    row = conn.execute(
        "SELECT id FROM users WHERE telegram_id = ? LIMIT 1",
        (telegram_id,)
    ).fetchone()

    is_new = row is None

    if row:
        account_id = int(row["id"])
        conn.execute(
            """
            UPDATE users
            SET telegram_username = ?,
                first_name = ?,
                last_name = ?,
                photo_url = ?,
                last_login_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (username, first_name, last_name, photo_url, account_id)
        )
    else:
        cursor = conn.execute(
            """
            INSERT INTO users (
                telegram_id, telegram_username, first_name, last_name, photo_url
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (telegram_id, username, first_name, last_name, photo_url)
        )
        account_id = int(cursor.lastrowid)

    token = create_styleflow_session(conn, account_id)
    conn.commit()

    account_row = conn.execute(
        """
        SELECT id AS account_id, telegram_id, telegram_username, first_name,
               last_name, photo_url, created_at, last_login_at,
               recommendations_reset_at
        FROM users WHERE id = ?
        """,
        (account_id,)
    ).fetchone()
    conn.close()

    response = jsonify({
        "status": "ok",
        "verified": True,
        "new_account": is_new,
        "account": account_public(dict(account_row)),
        # Оставляем user_id для совместимости со старым frontend/history.
        "user_id": telegram_id,
        "account_id": account_id
    })

    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=request.is_secure,
        samesite="Lax",
        path="/"
    )
    return response


@app.route("/api/me", methods=["GET"])
def api_me():
    account = get_current_account()
    if not account:
        return jsonify({"status": "unauthorized", "authenticated": False}), 401

    return jsonify({
        "status": "ok",
        "authenticated": True,
        "account": account_public(account)
    })


@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    token = request.cookies.get(SESSION_COOKIE_NAME, "").strip()
    if token:
        conn = get_db()
        conn.execute(
            "DELETE FROM sessions WHERE token_hash = ?",
            (hash_session_token(token),)
        )
        conn.commit()
        conn.close()

    response = jsonify({"status": "ok"})
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return response


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
    account = get_current_account()
    if not account:
        return jsonify({
            "status": "unauthorized",
            "authenticated": False,
            "products": [],
            "has_more": False
        }), 401

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
    query = normalize_search_text(query)
    sources = [str(x).lower() for x in (sources or []) if x]
    if not query:
        return {"products": [], "local_count": 0, "fetched": 0, "source": "local", "has_more": False}

    wanted_sources = sources or ["wildberries", "kufar"]
    fetched_total = 0
    exhausted = True

    if "wildberries" in wanted_sources:
        cache = get_search_cache(query, "wildberries")
        next_page = (cache["last_fetched_page"] + 1) if cache else 1
        if next_page <= 3:
            exhausted = False
            new_products = reef_wildberries_search(query, page=next_page, price_min=min_price, price_max=max_price)
            if new_products:
                fetched_total += save_products(new_products)
                update_search_cache(query, "wildberries", next_page, len(new_products))

    if "kufar" in wanted_sources:
        cache = get_search_cache(query, "kufar")
        # Куфар endpoint currently returns a fresh first page without a portable cursor
        # in the existing cache schema. Avoid hammering it endlessly: after one fetch,
        # report no more until cache expires/replaced.
        if not cache:
            exhausted = False
            new_products = kufar_search(query, page=1, size=KUFAR_FETCH_SIZE)
            if new_products:
                fetched_total += save_products(new_products)
                update_search_cache(query, "kufar", 1, len(new_products))

    local = local_search_products(query, sources=sources, min_price=min_price, max_price=max_price, limit=limit)
    wb_cache = get_search_cache(query, "wildberries")
    wb_more = bool(wb_cache and wb_cache.get("last_fetched_page", 0) < 3 and "wildberries" in wanted_sources)
    kufar_more = bool(not get_search_cache(query, "kufar") and "kufar" in wanted_sources)

    return {
        "products": local,
        "local_count": len(local),
        "fetched": fetched_total,
        "source": "local+wildberries+kufar" if fetched_total else "local",
        "has_more": wb_more or kufar_more
    }


@app.route("/api/search/more")
def api_search_more():
    account = get_current_account()
    if not account:
        return jsonify({
            "status": "unauthorized",
            "authenticated": False,
            "products": [],
            "has_more": False
        }), 401

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
        account = get_current_account()
        if not account:
            return jsonify({"status": "unauthorized", "authenticated": False, "products": [], "has_more": False}), 401

        limit = max(1, min(int(request.args.get("limit", "120")), 300))
        offset = max(0, int(request.args.get("offset", "0")))
        products, safe_total = get_recommended_feed_products(account["account_id"], limit=limit, offset=offset)
        return jsonify({
            "status": "ok",
            "authenticated": True,
            "account_id": account["account_id"],
            "products": products,
            "offset": offset,
            "limit": limit,
            "total": safe_total,
            "has_more": offset + len(products) < safe_total
        })
    except Exception as e:
        print(f"Ошибка /api/feed: {e}")
        return jsonify({"status": "error", "message": str(e), "products": []}), 500


# =========================
# USER HISTORY API
# =========================

@app.route("/api/user/history", methods=["GET"])
def api_user_history():
    account = current_account()
    if not account:
        return jsonify({"status": "unauthorized", "message": "Требуется авторизация STYLEFLOW"}), 401

    try:
        # При первом входе переносим старую историю, где user_id был Telegram ID,
        # на постоянный STYLEFLOW account_id.
        conn = get_db()
        conn.execute(
            "UPDATE user_history SET user_id = ? WHERE user_id = ?",
            (str(account["account_id"]), str(account["telegram_id"]))
        )
        conn.commit()
        conn.close()

        history = get_user_history(str(account["account_id"]))
        return jsonify({
            "status": "ok",
            "account_id": account["account_id"],
            "viewed": history["viewed"],
            "opened": history["opened"]
        })
    except Exception as e:
        print(f"Ошибка получения истории пользователя: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


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

    account = current_account()
    user_id = str(account["account_id"]) if account else ""

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

    account = current_account()
    user_id = str(account["account_id"]) if account else ""

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
# ACCOUNT FAVORITES / SEARCH EVENTS / RESET
# =========================

def require_account():
    account = get_current_account()
    if not account:
        return None
    return account


@app.route("/api/user/favorites", methods=["GET"])
def api_user_favorites():
    account = require_account()
    if not account:
        return jsonify({"status": "unauthorized", "products": []}), 401
    conn = get_db()
    rows = conn.execute(
        "SELECT product_json FROM user_favorites WHERE account_id = ? ORDER BY id DESC",
        (account["account_id"],)
    ).fetchall()
    conn.close()
    products = []
    for row in rows:
        try:
            products.append(json.loads(row["product_json"]))
        except Exception:
            pass
    return jsonify({"status": "ok", "products": products})


@app.route("/api/user/favorite", methods=["POST"])
def api_user_favorite():
    account = require_account()
    if not account:
        return jsonify({"status": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    product = data.get("product") or {}
    action = str(data.get("action") or "add").lower()
    product_id = str(product.get("id") or data.get("product_id") or "").strip()
    if not product_id:
        return jsonify({"status": "error", "message": "product_id обязателен"}), 400

    conn = get_db()
    if action == "remove":
        conn.execute(
            "DELETE FROM user_favorites WHERE account_id = ? AND product_id = ?",
            (account["account_id"], product_id)
        )
    else:
        product = dict(product)
        product["id"] = product_id
        conn.execute(
            """
            INSERT INTO user_favorites(account_id, product_id, product_json, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(account_id, product_id)
            DO UPDATE SET product_json = excluded.product_json, updated_at = CURRENT_TIMESTAMP
            """,
            (account["account_id"], product_id, json.dumps(product, ensure_ascii=False))
        )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "action": action, "product_id": product_id})


@app.route("/api/user/search", methods=["POST"])
def api_user_search_event():
    account = require_account()
    if not account:
        return jsonify({"status": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    query = normalize_search_text(data.get("query", ""))
    if query:
        conn = get_db()
        conn.execute(
            "INSERT INTO user_searches(account_id, query) VALUES (?, ?)",
            (account["account_id"], query)
        )
        conn.commit()
        conn.close()
    return jsonify({"status": "ok"})


@app.route("/api/user/reset-recommendations", methods=["POST"])
def api_reset_recommendations():
    account = require_account()
    if not account:
        return jsonify({"status": "unauthorized"}), 401

    account_id = str(account["account_id"])
    conn = get_db()
    # Избранное НЕ трогаем: пользовательские лайки должны переживать сброс.
    conn.execute("DELETE FROM user_history WHERE user_id = ?", (account_id,))
    conn.execute("DELETE FROM user_searches WHERE account_id = ?", (account["account_id"],))
    conn.execute(
        "UPDATE users SET recommendations_reset_at = CURRENT_TIMESTAMP WHERE id = ?",
        (account["account_id"],)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "message": "Рекомендации сброшены"})


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
