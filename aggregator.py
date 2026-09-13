from parser_wb import parse_wb
import json

def generate_feed():
    wb_items = parse_wb("платье", limit=10)

    # Если WB ничего не дал → оставляем старый feed.json
    if not wb_items:
        print("WB не дал товары, feed.json не обновлён")
        return

    with open("feed.json", "w", encoding="utf-8") as f:
        json.dump(wb_items, f, ensure_ascii=False, indent=2)

    print("feed.json обновлён!")
