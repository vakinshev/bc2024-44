const http = require('http');
const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const superagent = require('superagent');

program
  .requiredOption('-h, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Path to cache directory')
  .parse(process.argv);

const options = program.opts();

const getCacheFilePath = (code) => path.join(options.cache, `${code}.jpg`);

const fetchImageFromHttpCat = async (code) => {
  const url = `https://http.cat/${code}`;
  try {
    const response = await superagent.get(url);
    return response.body;
  } catch (error) {
    throw new Error('Failed to fetch image from http.cat');
  }
};

const server = http.createServer(async (req, res) => {
  const method = req.method;
  const urlParts = req.url.split('/');
  const code = urlParts[1];

  if (!code) {
    res.statusCode = 400;
    res.end('HTTP code not specified');
    return;
  }

  const filePath = getCacheFilePath(code);

  try {
    switch (method) {
      case 'GET':
        try {
          const data = await fs.readFile(filePath);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data);
        } catch (error) {
          if (error.code === 'ENOENT') {
            try {
              const imageData = await fetchImageFromHttpCat(code);
              await fs.writeFile(filePath, imageData);
              res.writeHead(200, { 'Content-Type': 'image/jpeg' });
              res.end(imageData);
            } catch (fetchError) {
              res.statusCode = 404;
              res.end('Image not found on http.cat');
            }
          } else {
            res.statusCode = 500;
            res.end('Server error');
          }
        }
        break;

      case 'PUT':
        let body = [];
        req.on('data', chunk => {
          body.push(chunk);
        }).on('end', async () => {
          body = Buffer.concat(body);
          await fs.writeFile(filePath, body);
          res.statusCode = 201;
          res.end('Image saved');
        });
        break;

      case 'DELETE':
        try {
          await fs.unlink(filePath);
          res.statusCode = 200;
          res.end('Image deleted');
        } catch (error) {
          if (error.code === 'ENOENT') {
            res.statusCode = 404;
            res.end('Image not found');
          } else {
            res.statusCode = 500;
            res.end('Server error');
          }
        }
        break;

      default:
        res.statusCode = 405;
        res.end('Method not allowed');
    }
  } catch (error) {
    res.statusCode = 500;
    res.end('Server error');
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
