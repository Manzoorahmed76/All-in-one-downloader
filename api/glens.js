// api/glens.js
const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const imageUrl = req.query.url;
  console.log(`Processing image URL: ${imageUrl}`);

  if (!imageUrl) {
    return res.status(400).json({ status: false, error: 'The "url" parameter is required.', powered_by: "Hazeyy API" });
  }

  try {
    const response = await axios.get(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`, {
      headers: {
        'authority': 'lens.google.com',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': 'OTZ=8030475_32_32__32_; AEC=AVcja2c9bu3cEHT-vWY07saeLKjmrvZLi4jwuGOg6JC6a2LrT8R5wLpjwqg; NID=523=re07UzgOgQSiXmBoDGGp-vqVh15txghUnPwuDhy2cJ5JYi4F7CRruRSfoY1uih5vp4McW6FXLXUyTgRoEZ1YkQfrtex_ofzcm4JMkC44mkLql4QozAbaHBx6fFN4iDV-jDLuGzgXofi8VzAYWnm0n2EwUpESo7FmZk1X6xLhleXq4SfprtJ2yLrlqHbKHlulnlejBnUj4FyM3YavBypeUg8XXQ8s6rGds5nCzrwUzwNFb-ZmjfAXiTpkP6vLmc2X0krpntKzE_jK9BzoW1GTrqJ-iJE',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
      },
      maxRedirects: 0,
      validateStatus: function (status) {
        return status >= 200 && status < 400;
      }
    });

    if (response.status === 302 || response.status === 303) {
      const redirectUrl = response.headers.location;

      const redirectedResponse = await axios.get(redirectUrl, {
        headers: {
          ...response.config.headers,
        }
      });

      const $ = cheerio.load(redirectedResponse.data);
      const images = [];
      const titles = [];

      $('meta[itemprop="image"]').each((_, el) => {
        const url = $(el).attr('content');
        if (url) images.push({ url, source: 'meta-itemprop-image' });
      });
      $('meta[property="og:image"]').each((_, el) => {
        const url = $(el).attr('content');
        if (url) images.push({ url, source: 'og-image' });
      });
      $('img').each((_, el) => {
        const url = $(el).attr('src');
        if (url) images.push({ url, source: 'img-tag' });
      });
      $('meta[itemprop="name"], meta[property="og:title"], meta[name="twitter:title"]').each((_, el) => {
        const title = $(el).attr('content');
        if (title) titles.push(title);
      });

      const uniqueImages = [...new Map(images.map(img => [img.url, img])).values()];
      const matchedData = uniqueImages.map((img, idx) => ({
        url: img.url,
        title: titles[idx] || 'No title',
        source: img.source,
      }));

      return res.json({
        author: 'Hazeyy',
        images: uniqueImages,
        matched: matchedData
      });
    } else {
      const $ = cheerio.load(response.data);
      const images = [];

      $('meta[itemprop="image"]').each((_, el) => {
        const url = $(el).attr('content');
        if (url) images.push({ url, source: 'meta-itemprop-image' });
      });

      return res.json({
        status: true,
        directResponse: true,
        images,
        powered_by: "Hazeyy API"
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: false,
      error: 'Something went wrong',
      details: err.message,
      powered_by: "Hazeyy API"
    });
  }
};
