from kazan_client import ke_category

def get_feed():
    try:
        items = ke_category(205, limit=20)
    except Exception:
        items = []

    if not items:
        return [{
            "id": "error",
            "title": "Источник временно недоступен",
            "price": 0,
            "image": "https://i.imgur.com/0ZfQZQh.jpeg",
            "source": "system"
        }]

    items.sort(key=lambda x: x["price"])
    return items
