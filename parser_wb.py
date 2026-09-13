import requests

def parse_wb(query="платье", limit=20):
    url = f"https://catalog.wb.ru/catalog/electronic/v4/search?appType=1&curr=rub&dest=-1257786&query={query}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }

    r = requests.get(url, headers=headers)

    # Если WB вернул пустой ответ → возвращаем пустой список
    if not r.text.strip():
        print("WB вернул пустой ответ")
        return []

    try:
        data = r.json()
    except:
        print("WB вернул НЕ JSON")
        return []

    products = []

    for item in data.get("data", {}).get("products", []):
        products.append({
            "title": item.get("name", "Без названия"),
            "price": f"{item.get('salePriceU', 0) // 100} ₽",
            "image": f"https://images.wbstatic.net/c246x328/new/{item['id']}-1.jpg"
        })

        if len(products) >= limit:
            break

    return products
