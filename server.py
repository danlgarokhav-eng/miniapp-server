from flask import Flask, send_from_directory, jsonify
import json
import os

app = Flask(__name__, static_folder='miniapp')

@app.route('/')
def root():
    return send_from_directory('miniapp', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('miniapp', path)

@app.route('/api/feed')
def feed():
    with open('feed.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)
