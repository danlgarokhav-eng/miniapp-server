import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def parse_wb(query="платье", limit=20):
    url = (
        "https://search.wb.ru/exactmatch/ru/common/v4/search"
        f"?query={query}&resultset=catalog"
        "&sort=popular&curr=rub&lang=ru"
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
