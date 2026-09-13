import requests
from bs4 import BeautifulSoup

def parse_wb():
    url = "https://www.wildberries.ru/catalog/obuv/muzhskaya/kedy-i-krossovki"
    html = requests.get(url).text
    soup = BeautifulSoup(html, "html.parser")

    items = []

    for card in soup.select(".product-card"):
        title = card.select_one(".product-card__brand").get_text(strip=True)
        price = card.select_one(".price__lower-price").get_text(strip=True)
        items.append({"title": title, "price": price})

    return items
