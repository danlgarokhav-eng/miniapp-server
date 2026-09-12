import requests

OZON_API_KEY = "ТВОЙ_КЛЮЧ"
OZON_CLIENT_ID = "ТВОЙ_CLIENT_ID"

def get_ozon_dresses(limit=50):
    url = "https://api-seller.ozon.ru/v2/product/list"
    headers = {
        "Client-Id": OZON_CLIENT_ID,
        "Api-Key": OZON_API_KEY
    }

    data = {
        "filter": {
            "category_id": 170000000
        },
        "limit": limit
    }

    r = requests.post(url, json=data, headers=headers).json()
    items = r["result"]["items"]

    result = []
    for item in items:
        result.append({
            "id": f"ozon-{item['product_id']}",
            "title": item["name"],
            "price": item["price"],
            "image": item["primary_image"],
            "brand": item.get("brand", ""),
            "category": "dress",
            "source": "OZON",
            "rating": item.get("rating", 0),
            "discount": item.get("discount", 0)
        })

    return result
