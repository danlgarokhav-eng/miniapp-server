import requests

def parse_wb():
    url = "https://catalog.wb.ru/catalog/men_shoes/catalog?appType=1&curr=rub&dest=-1257786&sort=popular&page=1"
    data = requests.get(url).json()

    items = []

    for product in data["data"]["products"]:
        title = product.get("name")
        price = product.get("salePriceU", 0) // 100
        items.append({
            "title": title,
            "price": f"{price} ₽"
        })

    return items
