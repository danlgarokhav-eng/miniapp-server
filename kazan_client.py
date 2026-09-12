import requests

def ke_category(category_id: int = 205, limit: int = 20):
    url = f"https://api.kazanexpress.ru/api/v1/product/list?categoryId={category_id}"

    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    products = []

    for item in data.get("payload", {}).get("products", [])[:limit]:
        products.append({
            "source": "kazan",
            "id": f"ke-{item['id']}",
            "title": item.get("title", "Без названия"),
            "price": item.get("price", 0) / 100,
            "image": item.get("photo", "")
        })

    return products
