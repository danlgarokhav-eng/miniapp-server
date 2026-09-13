import requests

def parse_wb(query="платье", limit=20):
    url = f"https://catalog.wb.ru/catalog/electronic/v4/search?appType=1&curr=rub&dest=-1257786&query={query}"
    r = requests.get(url)
    data = r.json()

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
