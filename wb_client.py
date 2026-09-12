import requests
import random
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def wb_search(query: str, category: str = "women_clothes", limit: int = 20):
    url = (
        f"https://catalog.wb.ru/catalog/{category}/v4/search"
        f"?appType=1&curr=rub&dest=-1257786&query={query}"
    )

    for attempt in range(5):
        resp = requests.get(url, headers=HEADERS, timeout=10)

        if resp.status_code == 429:
            time.sleep(0.5 + random.random())
            continue

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

    return []
