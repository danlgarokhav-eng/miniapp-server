import requests


# ---------- Wildberries ----------

def wb_search(query: str, category: str = "electronic", limit: int = 20):
    """
    Публичный поиск WB без ключей.
    query     – строка поиска (например, 'платье')
    category  – код категории WB (по умолчанию 'electronic')
    limit     – сколько товаров взять
    """
    url = (
        f"https://catalog.wb.ru/catalog/{category}/v4/search"
        f"?appType=1&curr=rub&dest=-1257786&query={query}"
    )

    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    products = []
    for item in data.get("data", {}).get("products", [])[:limit]:
        products.append({
            "source": "wb",
            "id": f"wb-{item['id']}",
            "title": item.get("name", "Без названия"),
            "price": item.get("salePriceU", item.get("priceU", 0)) // 100,
            "image": f"https://images.wbstatic.net/c246x328/new/{item['id']}-1.jpg",
        })

    return products


# ---------- Ozon ----------

def ozon_category(url: str, limit: int = 20):
    """
    Публичный каталог Ozon через composer-api.
    url   – путь категории, например '/category/smartfony-15542/'
    limit – сколько товаров взять
    """
    api_url = f"https://api.ozon.ru/composer-api.bx/page/json/v2?url={url}"

    resp = requests.get(api_url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    products = []

    for widget in data.get("widgetStates", []):
        items = widget.get("state", {}).get("items", [])
        for item in items:
            if len(products) >= limit:
                break

            image = item.get("image") or item.get("imageUrl") or ""
            if image and image.startswith("//"):
                image = "https:" + image

            products.append({
                "source": "ozon",
                "id": f"ozon-{item.get('id')}",
                "title": item.get("title", "Без названия"),
                "price": item.get("price", 0),
                "image": image,
            })

        if len(products) >= limit:
            break

    return products


# ---------- Общий фид для Mini App ----------

def get_feed():
    """
    Главная функция, которую дергает Flask:
    /api/feed -> jsonify(get_feed())
    """

    # WB: ищем, например, платья
    wb_items = wb_search("платье", category="women_clothes", limit=10)

    # Ozon: берём, например, смартфоны
    ozon_items = ozon_category("/category/smartfony-15542/", limit=10)

    # Объединяем
    feed = wb_items + ozon_items

    # Можно отсортировать, например, по цене
    feed.sort(key=lambda x: x["price"])

    return feed
