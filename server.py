from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api/feed")
def feed():
    return {"status": "OK"}
