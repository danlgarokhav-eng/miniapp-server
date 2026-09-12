from aliexpress_client import ali_search

def get_feed():
    try:
        items = ali_search("women clothes", limit=20)
    except Exception:
        items = []

    if not items:
        return [{
            "id": "error",
            "title": "Нет данных",
            "price": 0,
            "image": "https://i.imgur.com/0ZfQZQh.jpeg",
            "source": "system"
        }]

    items.sort(key=lambda x: x["price"])
    return items
