@app.route("/api/download", methods=["GET"])
def download_get():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Parameter 'url' is required"}), 400

    try:
        token, path, cookie = get_token()
        if not token:
            return jsonify({"error": "Failed to fetch token"}), 500

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
