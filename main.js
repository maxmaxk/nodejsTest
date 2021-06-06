
/* Main module */

const dbOptions = {
  dbFile:"./db.s3db",
  jwtSecret: "jwtSecret",
  expInterval: 1200,
  maxHistoryDepthRequest: 100,
  defaultUsers: [
    { user: "user1", password: "password1" },
    { user: "user2", password: "password2" }
  ]
};

const postServerOptions = {
  port: 80,
  endpoint: "/get_token"
};

const wsServerOptions = {
  port: 8888
};

const Db = require('./db.js');
const PostServer = require('./postserver.js');
const WsServer = require('./wsserver.js');

let db = new Db(dbOptions);
let postServer = new PostServer(postServerOptions, db);
let wsServer = new WsServer(wsServerOptions, db);

db.create();
postServer.create();
wsServer.create();
