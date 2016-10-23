var Promise = require('bluebird');
var parseString = Promise.promisify(require('xml2js').parseString);

var uuid = require('node-uuid');
var rp = require('request-promise');
var lodash = require('lodash');

var EventEmitter = require('events').EventEmitter;
var util = require('util');


var WatchAirResponse = class WatchAirResponse {
  constructor(j) {
    this.header = j.MML.Hdr;
    this.body = j.MML.Body;
    this.success = parseInt(j.MML.Hdr.Result.Code) === 0;
    this.sid = '';
    try { this.sid = j.MML.Hdr.SessionID } catch (e) {}
  }
  original() {
    return {
      MML: {
        Hdr: this.header,
        Body: this.body
      }
    }
  }
}

var WatchAirSession = class WatchAirSession {

  constructor(ip, cid) {
    if (typeof cid === "undefined") cid = uuid.v4().toUpperCase();
    if (! /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-f]{4}-[0-9A-F]{4}-[0-9A-F]{12}/.test(cid)) throw new Error("ClientID not in correct format");
    EventEmitter.call(this);
    this.sessionID = "";
    this.clientID = cid;
    this.ip = ip;
    this.requests = 0;
    this.channels = [];
    this.deviceInfo = {};
    this.results = {};
    this.initialized = false;
    this.initializing = false;
    this.tvbpsDefault = 3000000;
    this.currentChannel = {
      url: "",
      uid: -1,
      tvbps: 0
    }
    this.changeChannel = lodash.throttle(this._changeChannel, 1000);
    this.channelChanging = false;

    this.log = () => {};
    this.log(`watchairSession object created [ ip: ${ip} ]`);


    this.eventNames = ["channelChanged", "streamingStatus", "statusAll", "deviceInfo", "channels", "sessionID"];

  }
  toggleLogOutput(tf) {
    this.log = (tf ? console.log.bind(console.log) : () => {} );
  }
  setLogFunction(l) {
    this.log = l;
  }

  parseResponse(r) {
    return new WatchAirResponse(r);
  }
  waRequest(uopts) {
    var defaults = {
      forever: true
    }
    var opts = lodash.extend(defaults, uopts);
    this.log( `waRequest: ${JSON.stringify(opts)}`);
    return new Promise( (resolve, reject) => {
      this.requests++;
      rp(opts).then(data => {
        return parseString(
          String(data),
          {
            trim: true,
            explicitArray: false,
            transform: this.parseResponse
          });
      }).then(data => {
        resolve(data);
        this.log(data);
      }).catch(err => { reject(err) } );
    });
  }
  waCommand(cmd, qs, cache) {
    var name = `waCommand:${cmd}`;
    if (typeof cache === "undefined") cache = true;
    if (typeof qs === "undefined") qs = {};
    if ((!cache) && Object.keys(this.results).indexOf(name) > -1) return this.results[name];
    this.results[name] = new Promise((resolve, reject) => {
      var sc = Promise.resolve(this.sessionID);
      if (! this.sessionID) {
        sc = this.getSessionID();
      }
      sc.then(() => {
        var opts = {
          uri: `http://${this.ip}/mml.do`,
          qs: {
            "cmd": cmd,
            "sessionid":this.sessionID
          }
        }
        opts.qs = lodash.extend(opts.qs, qs);

        this.waRequest(opts).then(result => {
          resolve(result);
        }).catch(err => {
          this.log(`waCommand error: ${err}`)
          delete this.results[name];
          reject(err);
        });
      })
    });
    return this.results[name];
  }
  _changeChannel(uniqueid, tvbps) {
    //var name = "getStreamingStatus";
    //if (Object.keys(this.results).indexOf(name) > -1) return this.results[name];
    //this.results[name] = new Promise((resolve, reject) => {
    if (this.channelChanging) return Promise.reject('Channel currently changing');
    var name = "changeChannel";
    return new Promise((resolve, reject) => {
      this.log(`changeChannel: [ uid: ${uniqueid}, tvbps: ${tvbps}]`);
      clearTimeout(this.ccTimeout);
      this.channelChanging = true;
      this.ccTimeout = setTimeout( ()=> {
        this.channelChanging = false;
      })
      if (!tvbps || typeof tvbps === "undefined") tvbps = this.tvbpsDefault
      this.currentChannel.uid = uniqueid;
      this.currentChannel.tvbps = tvbps;
      this.waCommand("startstreamingdata", {
        "uniqueid":uniqueid,
        "tvbps":tvbps,
        "force":0
      }).then(data => {
        var url = data.MML.Body.Media.Url.replace(/\r?\n|\r/, '');
        this.currentChannel.url = url;
        this.channelChanging = false;
        resolve(url);
        this.emit("channelChanged", this.currentChannel);
      }).catch(err => {
        this.log(`${name} error: ${err}`);
      })
    });
  }
  getStatusAll(cache) {
    if (typeof cache === "undefined") cache = true;
    var name = "getStatusAll";
    var eventName = "statusAll";
    if ((!cache) && Object.keys(this.results).indexOf(name) > -1) {
      this.emit(eventName, this.statusAll);
      return this.results[name];
    }
    this.results[name] = new Promise((resolve, reject) => {
      this.waCommand("getStatusAll").then(data => {
        this.statusAll = data.MML.Body
        resolve(this.statusAll);
        this.emit(eventName, this.statusAll);
      }).catch(err => {
        this.log(`${name} error: ${err}`);
        delete this.results[name];
        reject(err);
      });
    });
    return this.results[name];
  }
  getDeviceInfo(cache) {
    if (typeof cache === "undefined") cache = true;
    var name = "getDeviceInfo";
    if ((!cache) && Object.keys(this.results).indexOf(name) > -1) {
      this.emit("deviceInfo", this.results[name]);
      return this.results[name];
    }
    this.results[name] = new Promise((resolve, reject) => {
      this.waCommand("getDeviceInfo").then(data => {
        this.deviceInfo = data.MML.Body.DeviceInfo
        resolve(this.deviceInfo);
        this.emit("deviceInfo", this.deviceInfo);
      }).catch(err => {
        this.log(`${name} error: ${err}`);
        delete this.results[name];
        reject(err);
      });
    });
    return this.results[name];
  }

  getStreamingStatus(cache) {
    if (typeof cache === "undefined") cache = true;
    var name = "getStreamingStatus";
    if (Object.keys(this.results).indexOf(name) > -1) {
      this.emit("streamingStatus", this.results[name]);
      return this.results[name];
    }
    this.results[name] = new Promise((resolve, reject) => {

      this.waCommand("getStreamingStatus").then(data => {
        var status = data.MML.Body.StreamingStatus.Status
        if (status == 1) {
          var cuid = data.MML.Body.StreamingStatus.ServiceInformation.UniqueId;
          resolve(cuid);
          this.emit("streamingStatus", cuid);
        } else {
          resolve(-1);
          this.emit("streamingStatus", -1);
        }
      }).catch(err => {
        this.log(`${name} error: ${err}`);
        delete this.results[name];
        reject(err);
      });
    });
    return this.results[name];
  }

  getChannels(cache) {
    if (typeof cache === "undefined") cache = true;
    var name = "getChannels";
    if (Object.keys(this.results).indexOf(name) > -1) {
      this.emit("channels", this.channels);
      return this.results[name];
    }
    this.results[name] = new Promise((resolve, reject) => {

      this.waCommand("getServiceList").then(data => {
        var chs = data.MML.Body.ServiceList.Service;
        var na = {};
        chs.forEach(el => {
          na[el.UniqueId] = el;
        });
        this.channels = na;
        this.initialized = true;
        resolve(na);
        this.emit("channels", this.channels);
      }).catch(err => {
        this.log(`${name} error: ${JSON.stringify(err, null, 4)}`);
        delete this.results[name];
        reject(err);
      });

    });
    return this.results[name];
  }

  getSessionID() {
    var name = "getSessionID";
    if (Object.keys(this.results).indexOf(name) > -1) {
      this.emit("sessionID", this.sessionID);
      return this.results[name];
    }
    this.results[name] = new Promise((resolve, reject) => {
      var opts = {
        uri: `http://${this.ip}/mml.do`,
        qs: {
          "cmd": "connect",
          "clientid": this.clientID,
          "timeout": 0
        }
      }

      this.waRequest(opts).then(sid => {
        this.sessionID = sid.MML.Body.SessionID;
        //this.results['getSessionID'] = Promise.resolve(this.sessionID);
        resolve(this.sessionID);
        this.emit("sessionID", this.sessionID);
      }).catch(err => {
        this.log(`${name} error: ${err}`);
        delete this.results[name];
        reject(err);
      });

    });
    return this.results[name];

  }

  init() {
    if (this.initializing || this.initialized) return Promise.resolve("already initializing");
    return new Promise((resolve, reject) => {
      this.initializing = true;
      this.getSessionID()
        .then(() => {
          return this.getDeviceInfo();
        })
        .then(() => {
          return this.getStreamingStatus();
        }).then(() => {
          resolve("initialized");
          this.initialized = true;
      });
    });
  }
}
util.inherits(WatchAirSession, EventEmitter);

exports.WatchAirSession = WatchAirSession;
exports.WatchAirResponse = WatchAirResponse;
