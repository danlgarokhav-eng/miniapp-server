from parser_wb import parse_wb
import json

def generate_feed():
    # Можешь менять запрос на любой: "кроссовки", "телефон", "рюкзак"
    wb_items = parse_wb("платье", limit=10)

    with open("feed.json", "w", encoding="utf-8") as f:
        json.dump(wb_items, f, ensure_ascii=False, indent=2)

    print("feed.json обновлён!")
