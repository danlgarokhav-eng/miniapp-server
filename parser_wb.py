import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def parse_wb(category_id=169873, limit=20):
    url = (
        f"https://catalog.wb.ru/catalog/{category_id}/v4/list"
        "?appType=1&curr=rub&dest=-1257786"
    )

    r = requests.get(url, headers=HEADERS)

    try:
        data = r.json()
    except:
        print("WB вернул НЕ JSON")
        return []

    products = []

    for item in data.get("data", {}).get("products", [])[:limit]:
        products.append({
            "title": item.get("name", "Без названия"),
            "price": f"{item.get('salePriceU', item.get('priceU', 0)) // 100} ₽",
            "image": f"https://images.wbstatic.net/c246x328/new/{item['id']}-1.jpg"
        })

    return products
