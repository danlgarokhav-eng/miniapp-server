from flask import Flask

app = Flask(__name__)

@app.route("/")
def root():
    return "ROOT OK"

@app.route("/api/feed")
def feed():
    return {"status": "OK"}
