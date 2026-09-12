from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return "Mini App is working!"

@app.route("/api/items")
def items():
    return jsonify([
        {"id": 1, "name": "Товар 1", "price": 100},
        {"id": 2, "name": "Товар 2", "price": 200},
        {"id": 3, "name": "Товар 3", "price": 300}
    ])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
