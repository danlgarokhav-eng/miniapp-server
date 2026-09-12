from flask import Flask, jsonify
from aggregator import get_feed

app = Flask(__name__)

@app.route("/api/feed")
def feed():
    return jsonify(get_feed())
