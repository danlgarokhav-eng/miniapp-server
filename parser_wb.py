from playwright.sync_api import sync_playwright
import json

def parse_wb(query="платье", limit=20):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        url = f"https://www.wildberries.ru/catalog/0/search.aspx?search={query}"
        page.goto(url)

        # Ждём загрузку карточек
        page.wait_for_selector(".product-card__wrapper", timeout=10000)

        items = []

        cards = page.query_selector_all(".product-card__wrapper")

        for card in cards[:limit]:
            title = card.query_selector(".product-card__name").inner_text()
            price = card.query_selector(".price__lower-price").inner_text()
            img = card.query_selector("img").get_attribute("src")

            items.append({
                "title": title,
                "price": price,
                "image": img
            })

        browser.close()
        return items
