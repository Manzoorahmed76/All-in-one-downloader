import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

const getToken = async () => {
  const req = await fetch("https://allinonedownloader.com/");
  if (!req.ok) return null;

  const html = await req.text();
  const $ = cheerio.load(html);
  const token = $('#token').val();
  const path = $('#scc').val();
  const cookie = req.headers.get('set-cookie');

  return { token, path, cookie };
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
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url=' });
  }

  const conf = await getToken();
  if (!conf) {
    return res.status(500).json({ error: 'Failed to get token.' });
  }

  const { token, path, cookie } = conf;
  const urlhash = generateHash(url, token);

  const formData = new URLSearchParams();
  formData.append('url', url);
  formData.append('token', token);
  formData.append('urlhash', urlhash);

  const response = await fetch(`https://allinonedownloader.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': `crs_ALLINONEDOWNLOADER_COM=blah; ${cookie}`,
      'Origin': 'https://allinonedownloader.com',
      'Referer': 'https://allinonedownloader.com/',
      'User-Agent': 'Mozilla/5.0'
    },
    body: formData
  });

  if (!response.ok) {
    return res.status(500).json({ error: 'Failed to download' });
  }

  try {
    const data = await response.json();
    return res.status(200).json({
      input_url: url,
      result: {
        title: data.title,
        thumbnail: data.thumbnail,
        downloadUrls: data.links,
        duration: data.duration
      },
      error: null
    });
  } catch (err) {
    return res.status(500).json({ error: 'Invalid response format' });
  }
}
