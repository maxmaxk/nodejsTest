
/* Module for websocket operations */

const WebSocket = require('ws');
const getCurrentUnixTime = require('./currentUnixTime.js');
const errorsTxt = require('./errorsTxt.js');

const messageType = 0,
      authType    = 1,
      historyType = 2;
const okResultMessage = '{"result":"ok"}';

class WsServer {
  constructor(options, db){
    this.options = options;
    this.db = db;
  }
  create(){
    this.wsServer = new WebSocket.Server({port: this.options.port});
    this.wsServer.on('connection', this.onConnect.bind(this));
  }
  onConnect(wsClient){
    wsClient.login = null;
    wsClient.on('message',  req => {
      this.handleRequest(req, wsClient)
      .then(answer => wsClient.send(answer))
      .catch(err => wsClient.send(`{"err": "${err.message}"}`))
    });
  }
  handleRequest(req, wsClient){
    return new Promise((resolve, reject) => {
      let reqObj = {};
      try{
        reqObj = JSON.parse(req);
      }catch(e){
        reject(e);
      }
      if(!reqObj.name || !reqObj.message) reject(new Error(errorsTxt.unkwownRequestTxt));
      let messageType = this.getMessageType(reqObj.message);
      switch (messageType.type) {
        case authType:
          this.setToken(reqObj.name, messageType.payload)
          .then( _ => this.checkExpTime(reqObj.name, wsClient))
          .then( _ => this.setLoginClient(reqObj.name, wsClient))
          .then( _ => resolve(okResultMessage))
          .catch(e => reject(e));
          break;
        case historyType:
          this.checkLoginClient(reqObj.name, wsClient)
          .then( _ => this.checkExpTime(reqObj.name, wsClient))
          .then( _ => this.sendHistory(wsClient, reqObj.name, messageType.payload))
          .then( _ => resolve(okResultMessage))
          .catch(e => reject(e));
          break;
        default:
          this.checkLoginClient(reqObj.name, wsClient)
          .then( _ => this.checkExpTime(reqObj.name, wsClient))
          .then( _ => this.pushMessageToDb(reqObj.name, messageType.payload))
          .then( _ => this.sendMessageToOthers(reqObj.name, messageType.payload))
          .then( _ => resolve(okResultMessage))
          .catch(e => reject(e));
      }
    })
  }
  setToken(login, token){
    return this.db.setToken(login, token);
  }
  setLoginClient(login, wsClient){
    wsClient.login = login;
    return Promise.resolve();
  }
  resetLoginClient(login, wsClient){
    wsClient.login = null;
  }
  checkLoginClient(login, wsClient){
    let res = (wsClient.login == login) ? Promise.resolve() : Promise.reject(new Error(errorsTxt.authFailTxt));
    return res;
  }
  checkExpTime(login, wsClient){
    return new Promise((resolve, reject) => {
      this.db.getExpTime(login)
      .then((expTime) => {
        if(getCurrentUnixTime() < expTime){
          resolve();
        }else{
          this.resetLoginClient(login, wsClient);
          reject(new Error(errorsTxt.expTimeOverTxt));
        }
      })
      .catch(e => reject(e));
    })
  }
  pushMessageToDb(login, message){
    return this.db.pushMessage(login, message);
  }
  sendMessageToOthers(login, message){
    return new Promise((resolve) => {
      let promises = [...this.wsServer.clients].map(client => this.sendMessageToClient(client, login, message));
      Promise.allSettled(promises)
      .finally( _ => resolve());
    });
  }
  sendMessageToClient(client, login, message){
    return new Promise((resolve, reject) => {
      if(!client.login || (client.login == login)){
        reject();
        return;
      }
      this.db.getExpTime(client.login)
      .then(client.send(`{"fromUser":"${login}", "message":"${message}"}`, _ => resolve()));
    })
  }
  sendHistory(wsClient, login, count){
    return new Promise((resolve, reject) => {
      this.db.getHistoryMessages(login, parseInt(count))
      .then(messages => Promise.all(
        messages.map(message => this.sendHistoryToClient(wsClient, message))
      ))
      .then( _ => resolve())
      .catch(e => reject(e));
    })
  }
  sendHistoryToClient(wsClient, message){
    return new Promise((resolve) => {
      wsClient.send(`{"historyMessage":"${message}"}`, _ => resolve());
    })
  }
  getMessageType(message){
    if(message.slice(0, 4) == 'auth') return {type: authType, payload: message.slice(5)};
    if(message.slice(0, 7) == 'history') return {type: historyType, payload: message.slice(8)};
    return {type: messageType, payload: message};
  }
}

module.exports = WsServer;
