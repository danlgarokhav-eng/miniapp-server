import requests
import random
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def parse_wb(limit=20):
    url = (
        "https://catalog.wb.ru/catalog/women_clothes/v4/list"
        "?appType=1&curr=rub&dest=-1257786"
    )

    for attempt in range(5):
        resp = requests.get(url, headers=HEADERS, timeout=10)

        # Если WB сказал "слишком много запросов"
        if resp.status_code == 429:
            time.sleep(0.5 + random.random())
            continue

        resp.raise_for_status()
        data = resp.json()

        products = []
        for item in data.get("data", {}).get("products", [])[:limit]:
            products.append({
                "title": item.get("name", "Без названия"),
                "price": f"{item.get('salePriceU', item.get('priceU', 0)) // 100} ₽",
                "image": f"https://images.wbstatic.net/c246x328/new/{item['id']}-1.jpg"
            })

        return products

    return []


    return products
