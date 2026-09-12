import requests

def get_wb_dresses(limit=50):
    url = "https://catalog.wb.ru/catalog/women_clothes/catalog"
    params = {
        "cat": 8129,  # категория Платья
        "page": 1
    }

    r = requests.get(url, params=params).json()
    items = r["data"]["products"][:limit]

    result = []
    for item in items:
        result.append({
            "id": f"wb-{item['id']}",
            "title": item["name"],
            "price": item["salePriceU"] // 100,
            "image": f"https://images.wbstatic.net/c516x688/{item['id']}.jpg",
            "brand": item["brand"],
            "category": "dress",
            "source": "WB",
            "rating": item.get("rating", 0),
            "discount": item.get("sale", 0)
        })

    return result
