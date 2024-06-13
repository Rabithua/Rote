require("dotenv").config();
const { createWriteStream } = require("fs");
const { SitemapStream } = require("sitemap");
const { pipeline } = require("stream");
const axios = require("axios");


const URL = process.env.URL;
const REACT_APP_BASEURL_PRD = process.env.REACT_APP_BASEURL_PRD;


const generateSitemap = async () => {

  function streamToPromise(stream) {
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
    });
  }

  console.log("Generating sitemap...");
  const sitemap = new SitemapStream({ hostname: URL });
  const writeStream = createWriteStream("./public/sitemap.xml");

  const pipelineStream = pipeline(
    sitemap,
    writeStream,
    (err) => {
      if (err) {
        console.error('Pipeline failed', err);
      } else {
        console.log('Pipeline succeeded');
      }
    }
  );

  const { data } = await axios.get(`${REACT_APP_BASEURL_PRD}/v1/api/sitemapData`)
    .catch(error => {
      console.error('Failed to fetch sitemap data', error);
    });

  if (!data) {
    // 处理请求失败的情况
    return;
  }

  let datas = data.data;

  sitemap.write({
    url: `${URL}/explore`,
    changefreq: "never",
    priority: 0.9,
  });
  if (Array.isArray(datas)) {
    datas.forEach((d) => {
      sitemap.write({
        url: `${URL}/${d.username}`,
        changefreq: "daily",
        priority: 0.8,
      });
    });
  }
  sitemap.end();

  try {
    await streamToPromise(pipelineStream);
    console.log("Sitemap successfully created");
  } catch (error) {
    console.error("Failed to create sitemap", error);
  }
};

generateSitemap();