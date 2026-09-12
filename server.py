from flask import Flask, render_template, jsonify
from aggregator import get_feed

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/feed")
def feed():
    return jsonify(get_feed())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
