from kazan_client import ke_category

def get_feed():
    ke_items = ke_category(205, limit=20)

    if not ke_items:
        return [{
            "id": "error",
            "title": "Нет данных",
            "price": 0,
            "image": "https://i.imgur.com/0ZfQZQh.jpeg",
            "source": "system"
        }]

    ke_items.sort(key=lambda x: x["price"])
    return ke_items
