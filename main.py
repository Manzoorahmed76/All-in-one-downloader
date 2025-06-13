import time
import hmac
import hashlib
import base64
from urllib.parse import urlencode, quote
import re
import requests
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

class Tiqu:
    def __init__(self):
        self.api_base = "https://wapi.tiqu.cc/api/all/"
        self.secret_key = b"bfa95f704ce74c5cba31820ea1c0da05"
        self.headers = {
            "accept": "*/*",
            "user-agent": "Postify/1.0.0",
            "referer": "https://tiqu.cc/"
        }
        self.regex = {
            "tiktok": re.compile(r"^https?:\/\/(www\.|m\.|vt\.)?tiktok\.com"),
            "douyin": re.compile(r"^https?:\/\/(v\.|www\.)?douyin\.com"),
            "instagram": re.compile(r"^https?:\/\/(www\.)?instagram\.com"),
            "twitter": re.compile(r"^https?:\/\/(www\.)?(twitter\.com|x\.com)"),
            "xiaohongshu": re.compile(r"^https?:\/\/(www\.xiaohongshu\.com|xhslink\.com)")
        }

    def _check_url(self, url):
        if not url or not url.strip():
            return False, "URL is required."
        if not any(regex.match(url) for regex in self.regex.values()):
            return False, "URL not supported. Use TikTok, Douyin, Instagram, Twitter, or Xiaohongshu."
        return True, None

    def _sign(self, url, t):
        raw = f"t={t}&url={url}".encode()
        signature = hmac.new(self.secret_key, raw, hashlib.sha256).hexdigest()
        return base64.b64encode(bytes.fromhex(signature)).decode()

    def download(self, url):
        is_valid, error = self._check_url(url)
        if not is_valid:
            return {"status": False, "error": error}

        t = str(int(time.time() * 1000))
        sign = self._sign(url, t)
        query = f"{self.api_base}?url={quote(url)}&t={t}&sign={quote(sign)}"

        try:
            res = requests.get(query, headers={**self.headers, "t": t, "sign": sign})
            res.raise_for_status()
            data = res.json()
            if data:
                return {"status": True, "data": data}
            else:
                return {"status": False, "error": "No data received."}
        except Exception:
            return {"status": False, "error": "Error during download."}

@app.get("/")
async def root():
    return {"status": True, "message": "API is working."}

@app.get("/api")
@app.post("/api")
async def handler(request: Request):
    if request.method == "GET":
        params = dict(request.query_params)
        url = params.get("url")
    else:
        body = await request.json()
        url = body.get("url")

    if not url:
        return JSONResponse(status_code=400, content={"status": False, "error": "URL parameter is required."})

    tiqu = Tiqu()
    result = tiqu.download(url)
    return JSONResponse(status_code=200 if result["status"] else 400, content=result)
