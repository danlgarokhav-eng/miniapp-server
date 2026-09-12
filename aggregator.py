from wb_client import wb_search

def get_feed():
    wb_items = wb_search("платье", limit=20)

    if not wb_items:
        return [{
            "id": "error",
            "title": "Нет данных",
            "price": 0,
            "image": "https://i.imgur.com/0ZfQZQh.jpeg",
            "source": "system"
        }]

    wb_items.sort(key=lambda x: x["price"])
    return wb_items
