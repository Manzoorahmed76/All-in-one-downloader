import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

const getToken = async () => {
  const req = await fetch("https://allinonedownloader.com/");
  if (!req.ok) return null;

  const res = await req.text();
  const $ = cheerio.load(res);
  const token = $("#token").val();
  const url = $("#scc").val();
  const cookie = req.headers.get('set-cookie');

  return { token, url, cookie };
};

const generateHash = (url, token) => {
  const key = CryptoJS.enc.Hex.parse(token);
  const iv = CryptoJS.enc.Hex.parse('afc4e290725a3bf0ac4d3ff826c43c10');
  const encrypted = CryptoJS.AES.encrypt(url, key, {
    iv,
    padding: CryptoJS.pad.ZeroPadding
  });
  return encrypted.toString();
};

export default async function handler(req, res) {
  const inputUrl = req.query.url;

  if (!inputUrl) {
    return res.status(400).json({ error: "URL query parameter is required." });
  }

  const conf = await getToken();
  if (!conf) return res.status(500).json({ error: "Failed to get token." });

  const { token, url: path, cookie } = conf;
  const hash = generateHash(inputUrl, token);

  const data = new URLSearchParams();
  data.append('url', inputUrl);
  data.append('token', token);
  data.append('urlhash', hash);

  const response = await fetch(`https://allinonedownloader.com${path}`, {
    method: "POST",
    headers: {
      "Accept": "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": `crs_ALLINONEDOWNLOADER_COM=blah; ${cookie}`,
      "Origin": "https://allinonedownloader.com",
      "Referer": "https://allinonedownloader.com/",
      "User-Agent": "Mozilla/5.0"
    },
    body: data
  });

  if (!response.ok) {
    return res.status(500).json({ error: "Failed to fetch download info." });
  }

  try {
    const json = await response.json();

    return res.status(200).json({
      input_url: inputUrl,
      source: json.source,
      result: {
        title: json.title,
        duration: json.duration,
        thumbnail: json.thumbnail,
        thumb_width: json.thumb_width,
        thumb_height: json.thumb_height,
        videoCount: json.videoCount,
        imageCount: json.imageCount,
        downloadUrls: json.links
      },
      error: null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
