from wb_client import wb_search
from ozon_client import ozon_category

def get_feed():
    wb_items = wb_search("платье", category="women_clothes", limit=10)
    ozon_items = ozon_category("/category/smartfony-15542/", limit=10)

    feed = wb_items + ozon_items

    if not feed:
        return [{
            "id": "error",
            "title": "Нет данных",
            "price": 0,
            "image": "https://i.imgur.com/0ZfQZQh.jpeg",
            "source": "system"
        }]

    feed.sort(key=lambda x: x["price"])
    return feed

