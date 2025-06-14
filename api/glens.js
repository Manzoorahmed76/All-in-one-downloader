const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const imageUrl = req.query.url;
  console.log(`Processing image URL: ${imageUrl}`);

  if (!imageUrl) {
    return res.status(400).json({
      status: false,
      error: 'The "url" parameter is required.',
      powered_by: "Hazeyy API"
    });
  }

  try {
    const response = await axios.get(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`, {
      headers: {
        'authority': 'lens.google.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': process.env.LENS_COOKIE,
        'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
        'x-client-data': 'CIaEywE='
      },
      maxRedirects: 0,
      validateStatus: status => status >= 200 && status < 400
    });

    if ([302, 303].includes(response.status)) {
      const redirectUrl = response.headers.location;
      console.log('Redirect URL:', redirectUrl);

      const redirectedResponse = await axios.get(redirectUrl, {
        headers: { ...response.config.headers }
      });

      const $ = cheerio.load(redirectedResponse.data);
      const images = [], titles = [];

      const collectMeta = (selector, attr, targetArray, key) => {
        $(selector).each((_, el) => {
          const val = $(el).attr(attr);
          if (val) targetArray.push({ [key]: val, source: selector });
        });
      };

      collectMeta('meta[itemprop="image"]', 'content', images, 'url');
      collectMeta('meta[property="og:image"]', 'content', images, 'url');
      collectMeta('meta[name="twitter:image"]', 'content', images, 'url');
      collectMeta('meta[itemprop="name"]', 'content', titles, 'title');
      collectMeta('meta[property="og:title"]', 'content', titles, 'title');
      collectMeta('meta[name="twitter:title"]', 'content', titles, 'title');

      $('img').each((_, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt') || '';
        if (src) images.push({ url: src, alt, source: 'img-tag' });
      });

      $('script').each((_, el) => {
        const script = $(el).html();
        if (script) {
          const matches = script.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi);
          matches?.forEach(url => images.push({ url, source: 'script-content' }));
        }
      });

      $('[data-src]').each((_, el) => {
        const url = $(el).attr('data-src');
        if (url?.match(/\.(jpg|jpeg|png|gif|webp)/)) {
          images.push({ url, source: 'data-src' });
        }
      });

      $('*').each((_, el) => {
        const attrs = $(el).attr();
        if (!attrs) return;
        Object.values(attrs).forEach(val => {
          if (typeof val === 'string' && val.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)/.test(val)) {
            if (!images.some(i => i.url === val)) {
              images.push({ url: val, source: 'attribute-value' });
            }
          }
        });
      });

      $('c-wiz').each((_, el) => {
        const jsdata = $(el).attr('jsdata');
        if (jsdata?.includes('https')) {
          const matches = jsdata.match(/https?:\/\/[^"'\s,]+/g);
          matches?.forEach(url => {
            if (url.match(/\.(jpg|jpeg|png|gif|webp)/)) {
              images.push({ url, source: 'jsdata' });
            }
          });
        }
      });

      const pageTitle = $('title').text();
      if (pageTitle) titles.push({ title: pageTitle, source: 'title-tag' });

      const uniqueImages = [...new Map(images.map(i => [i.url, i])).values()];
      const matched = uniqueImages.map((img, i) => ({
        url: img.url,
        title: titles[i]?.title || 'Image result from Google Lens',
        alt: img.alt || '',
        source: img.source
      })).filter(i => /\.(jpg|jpeg|png|gif|webp)/.test(i.url.toLowerCase()) || i.url.includes('/image'));

      return res.json({
        author: "Hazeyy",
        images: uniqueImages,
        matched: matched.length > 0 ? matched : uniqueImages
      });

    } else {
      // Handle direct HTML response (no redirect)
      const $ = cheerio.load(response.data);
      const images = [];
      $('meta[itemprop="image"]').each((_, el) => {
        const imgUrl = $(el).attr('content');
        if (imgUrl) {
          images.push({ url: imgUrl, source: 'meta-itemprop-image' });
        }
      });

      return res.json({
        status: true,
        directResponse: true,
        images,
        powered_by: "Hazeyy API"
      });
    }

  } catch (err) {
    console.error('Error Message:', err.message);
    return res.status(err.response?.status || 500).json({
      status: false,
      error: 'Request failed',
      statusCode: err.response?.status,
      message: err.message,
      powered_by: "Hazeyy API"
    });
  }
};
