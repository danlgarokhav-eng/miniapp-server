@app.route("/api/parse_wb")
def parse_wb_server():
    import requests

    query = request.args.get("query", "кроссовки")
    limit = int(request.args.get("limit", 50))

    url = (
        "https://search.wb.ru/catalog/ru/search/v2/search"
        f"?query={query}"
        "&spp=30"
        "&regions=80,64,38,4,33,70,1,22,31,66,68,40,48,71"
        "&pricemarginCoeff=1.0"
        "&appType=1"
        "&curr=rub"
        "&dest=-1257786"
        "&locale=ru"
        "&page=1"
        f"&limit={limit}"
    )

    r = requests.get(url, timeout=10)
    data = r.json()

    products = []

    for item in data.get("data", {}).get("products", []):
        product_id = item.get("id")

        products.append({
            "title": item.get("name", "Без названия"),
            "price": f"{item.get('salePriceU', 0) // 100} ₽",
            "brand": item.get("brand", ""),
            "image": f"https://images.wbstatic.net/c516x688/new/{product_id}-1.jpg",
            "link": f"https://www.wildberries.ru/catalog/{product_id}/detail.aspx"
        })

    return jsonify(products)
