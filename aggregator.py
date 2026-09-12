from wb_client import wb_search
from ozon_client import ozon_category

def get_feed():
    # WB: устойчивый поиск
    wb_items = wb_search("платье", limit=10)

    # Ozon: публичная категория
    ozon_items = ozon_category("/category/smartfony-15542/", limit=10)

    # Объединяем
    feed = wb_items + ozon_items

    # Если WB заблокировал и Ozon ничего не дал — не ломаем сайт
    if not feed:
        return [{
            "id": "error",
            "title": "Нет данных",
            "price": 0,
            "image": "https://i.imgur.com/0ZfQZQh.jpeg",
            "source": "system"
        }]

    # Сортировка по цене
    feed.sort(key=lambda x: x["price"])

    return feed
