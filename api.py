from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from Cryptodome.Cipher import AES
from Cryptodome.Util.Padding import pad
import binascii

app = Flask(__name__)

IV_HEX = 'afc4e290725a3bf0ac4d3ff826c43c10'

def get_token():
    headers = {
        "User-Agent": "Mozilla/5.0"
    }
    resp = requests.get("https://allinonedownloader.com/", headers=headers)
    if resp.status_code != 200:
        return None

    soup = BeautifulSoup(resp.text, 'html.parser')

    token_tag = soup.find('input', {'id': 'token'})
    path_tag = soup.find('input', {'id': 'scc'})
    if not token_tag or not path_tag:
        return None

    token = token_tag['value']
    path = path_tag['value']
    cookie = resp.headers.get('set-cookie')
    return token, path, cookie

def generate_hash(url, token):
    key = binascii.unhexlify(token)
    iv = binascii.unhexlify(IV_HEX)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    padded_url = pad(url.encode(), AES.block_size, style='iso7816')
    encrypted = cipher.encrypt(padded_url)
    return binascii.b2a_base64(encrypted).decode().strip()

@app.route("/api/download", methods=["GET"])
def download_get():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Parameter 'url' is required"}), 400

    try:
        token_data = get_token()
        if not token_data:
            return jsonify({"error": "Failed to fetch token"}), 500

        token, path, cookie = token_data
        urlhash = generate_hash(url, token)

        data = {
            "url": url,
            "token": token,
            "urlhash": urlhash
        }

        headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": "https://allinonedownloader.com",
            "Referer": "https://allinonedownloader.com/",
            "Cookie": f"crs_ALLINONEDOWNLOADER_COM=blah; {cookie}",
            "User-Agent": "Mozilla/5.0",
            "X-Requested-With": "XMLHttpRequest"
        }

        response = requests.post(f"https://allinonedownloader.com{path}", headers=headers, data=data)
        if not response.ok:
            return jsonify({"error": "Request failed"}), 500

        json_data = response.json()

        return jsonify({
            "input_url": url,
            "source": json_data.get("source"),
            "result": {
                "title": json_data.get("title"),
                "duration": json_data.get("duration"),
                "thumbnail": json_data.get("thumbnail"),
                "thumb_width": json_data.get("thumb_width"),
                "thumb_height": json_data.get("thumb_height"),
                "videoCount": json_data.get("videoCount"),
                "imageCount": json_data.get("imageCount"),
                "downloadUrls": json_data.get("links")
            },
            "error": None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/", methods=["GET"])
def home():
    return jsonify({"status": "API is live"})
