import requests

def ozon_category(url: str, limit: int = 20):
    api_url = f"https://api.ozon.ru/composer-api.bx/page/json/v2?url={url}"

    resp = requests.get(api_url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    products = []

    for widget in data.get("widgetStates", []):
        items = widget.get("state", {}).get("items", [])
        for item in items[:limit]:
            image = item.get("image") or item.get("imageUrl") or ""
            if image.startswith("//"):
                image = "https:" + image

            products.append({
                "source": "ozon",
                "id": f"ozon-{item.get('id')}",
                "title": item.get("title", "Без названия"),
                "price": item.get("price", 0),
                "image": image,
            })

    return products
