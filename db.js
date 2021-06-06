
/* Database module. Create database if it not exists, implements methods for postServer and wsServer modules */

const dbScheme = require('./dbscheme.js');
const sqlite3 = require('sqlite3').verbose();
const md5 = require('md5');
const jwtEncode = require('jwt-encode');
const jwtDecode = require('jwt-decode');
const getCurrentUnixTime = require('./currentUnixTime.js');
const errorsTxt = require('./errorsTxt.js');

class Db {
  constructor(options){
    this.options = options;
  }
  create(){
    let chain = this.connect();
    chain = chain.then( _ => this.foreignKeysEnable());
    for (let item in dbScheme){
      let fieldsStr = ' (';
      let refStr = '';
      let tableInfo = dbScheme[item];
      for (let field in tableInfo){
        fieldsStr += field + ' ' + tableInfo[field].type;
        if(tableInfo[field].hasOwnProperty('default')) fieldsStr += ' DEFAULT ' + tableInfo[field].default;
        if(tableInfo[field].primKey) fieldsStr += ' PRIMARY KEY';
        if(tableInfo[field].unique) fieldsStr += ' UNIQUE';
        if(tableInfo[field].autoIncrement) fieldsStr += ' AUTOINCREMENT';
        let references = tableInfo[field].references;
        if(references){
          refStr += 'FOREIGN KEY(' + field + ') REFERENCES ' + references.table + '(' + references.field + ') ON DELETE CASCADE, ';
        }
        fieldsStr += ', ';
      }
      fieldsStr = (fieldsStr + refStr).slice(0,-2);
      fieldsStr += ')';
      chain = chain.then( _ => this.queryRun('CREATE TABLE IF NOT EXISTS ' + item + fieldsStr));
    }
    chain = chain.then( _ => this.populateDb());
    chain = chain.catch(err => console.log(err));
  }
  connect(){
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.options.dbFile, (e) => {
        if(e){
          reject(e);
        }else{
          resolve();
        };
      });
    });
  }
  foreignKeysEnable(){
    return this.queryRun('PRAGMA foreign_keys = ON');
  }
  populateDb(){
    let chain = Promise.resolve();
    for(let item of this.options.defaultUsers){
      chain = chain.then( _ => this.queryRun('INSERT INTO users (login, password) values ("' + item.user + '","' + md5(item.password) + '")'));
    }
    return chain;
  }
  getUser(login){
    return new Promise((resolve, reject) => {
      this.db.each(`SELECT login,password FROM users WHERE login="${login}"`,
      (err, row) => {
          if(row.login) resolve(row);
      },
      (err, count) =>{
          reject(new Error(errorsTxt.authFailTxt))
      });
    });
  }
  queryRun(query){
    return new Promise((resolve, reject) => {
      this.db.run(query, (e) => {
        if(e){
          reject(e);
        }else{
          resolve();
        };
      });
    });
  }
  checkPass(user, data){
    if(md5(data.password) == user.password){
      return Promise.resolve(user);
    }else{
      return Promise.reject(new Error(errorsTxt.authFailTxt));
    }
  }
  getToken(user){
    return Promise.resolve({token:jwtEncode({"login": user.login, "exp": getCurrentUnixTime() + this.options.expInterval}, this.options.jwtSecret)});
  }
  getExpTime(login){
    return new Promise((resolve, reject) => {
      this.db.each(`SELECT expTime FROM users WHERE login = "${login}"`,
      (err, row) => {
          resolve(row.expTime);
      },
      (err, count) =>{
          reject(new Error(errorsTxt.authFailTxt))
      });
    });
  }
  checkAuth(data){
    return new Promise((resolve, reject) => {
      if(!data.login && !data.password) reject(new Error(errorsTxt.authFailTxt));
      this.getUser(data.login)
      .then(user => this.checkPass(user, data))
      .then(user => this.getToken(user))
      .then(token => resolve(token))
      .catch(err => reject(err));
    })
  }
  setToken(login, token){
    let jwtObj = jwtDecode(token);
    if(login !== jwtObj.login) return Promise.reject(new Error(errorsTxt.authFailTxt));
    return this.queryRun(`UPDATE users SET expTime = ${jwtObj.exp} WHERE login = "${jwtObj.login}"`);
  }
  pushMessage(login, message){
    return this.queryRun(`INSERT INTO history (userId, message) SELECT userId, "${message}" FROM users WHERE login = "${login}"`);
  }
  getHistoryMessages(login, count){
    return new Promise((resolve, reject) => {
      let res = [];
      if(!count){
        reject(new Error(errorsTxt.historyInvalidCountTxt));
      }
      if(count > this.options.maxHistoryDepthRequest){
        reject(new Error(errorsTxt.historyCountRequestLimitTxt));
      }
      this.db.each(`SELECT h.message FROM history h
                    INNER JOIN users u ON u.userId = h.userId
                    WHERE u.login = "${login}"
                    ORDER BY h.id DESC
                    LIMIT ${count}`,
      (err, row) => {
        res.push(row.message);
      },
      (err, count) =>{
        resolve(res);
      });
    })

  }
}

module.exports = Db;
