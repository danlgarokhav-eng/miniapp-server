import requests

def ali_search(query: str = "dress", limit: int = 20):
    url = f"https://gpsfront.aliexpress.com/getProductList?keywords={query}"

    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    products = []

    for item in data.get("data", {}).get("items", [])[:limit]:
        products.append({
            "source": "aliexpress",
            "id": f"ali-{item.get('productId')}",
            "title": item.get("title", "Без названия"),
            "price": float(item.get("salePrice", "0").replace("$", "").strip()),
            "image": item.get("imageUrl", "")
        })

    return products
