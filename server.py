from flask import Flask, send_from_directory, jsonify
import json

app = Flask(__name__, static_folder='miniapp')

@app.route('/')
def root():
    return send_from_directory('miniapp', 'index.html')

@app.route('/miniapp')
@app.route('/miniapp/')
@app.route('/miniapp/index.html')
def miniapp():
    return send_from_directory('miniapp', 'index.html')

@app.route('/api/feed')
def feed():
    with open('feed.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
