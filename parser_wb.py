from playwright.sync_api import sync_playwright

def parse_wb():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("https://www.google.com")
        print("Открыл Google!")
        browser.close()
