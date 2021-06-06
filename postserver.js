
/* HTTP server module for post authorization requests */

const http = require('http');

const okResponse        = 200,
      badResponse       = 400,
      badMethodResponse = 405;

class PostServer {
  constructor(options, db){
    this.options = options;
    this.db = db;
  }
  create(){
    http.createServer((req, res) => {
      if(req.method == "POST" && req.url == this.options.endpoint){
        let buffer = Buffer.alloc(0);
        req.on("data", data => {
          buffer = Buffer.concat([buffer,Buffer.from(data,'utf8')]);
          if(buffer && (buffer.length > 1e6)) req.connection.destroy();
        });
        req.on("end", _ => {
          this.parseBuffer(buffer)
          .then(data => this.db.checkAuth(data))
          .then(token => {
            res.writeHead(okResponse);
            res.end(JSON.stringify(token));
          })
          .catch(err => {
            console.log(err);
            res.writeHead(badResponse);
            res.end(err.message);
          })
        });
      }else{
        res.writeHead(badMethodResponse);
        res.end();
      }
    }).listen(this.options.port);
  }
  parseBuffer(buffer){
    return new Promise((resolve, reject) =>{
      try{
        let data = JSON.parse(buffer);
        resolve(data);
      }catch(e){
        reject(e);
      }
    })
  }
}

module.exports = PostServer;
