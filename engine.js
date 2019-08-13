var RC = require('ringcentral')
var async = require("async");
require('dotenv').load()

var rcsdk = null
var recordingId ="";
var recordingStatus =false;

if (process.env.PROD == "production"){
  rcsdk = new RC({
    server:RC.server.production,
    appKey: process.env.CLIENT_ID_PROD,
    appSecret:process.env.CLIENT_SECRET_PROD
  })
}else{
  rcsdk = new RC({
      server:RC.server.sandbox,
      appKey: process.env.CLIENT_ID_SB,
      appSecret:process.env.CLIENT_SECRET_SB
    })
}
var platform = rcsdk.platform()

var hasUpdate = false
var extensions = []
var userCallHandlingRule = []

var engine = module.exports = {
    login: function(req, res){
      var un = ""
      var pwd = ""
      if (process.env.PROD == "production"){
        un= process.env.USERNAME_PROD,
        pwd= process.env.PASSWORD_PROD
      }else{
        un= process.env.USERNAME_SB,
        pwd= process.env.PASSWORD_SB
      }
      platform.login({
        username:un,
        password:pwd
      })
      .then(function(resp){
        removeRegisteredSubscription()
        readAllExtensionsForwarding()
        //subscribeForNotification()
        res.render('index')
      })
      .catch(function(e){
        throw e
      })
    },
    readPresence: function(req, res){
      var endpoint = ""
      if (req.query.accessLevel == "account")
        endpoint = '/account/~/presence'
      else
        endpoint = '/account/~/extension/~/presence'
      var params = req.body
      platform.get(endpoint, params)
      .then(function(resp){
        var json = resp.json()
        if (json.records != undefined){
          if (process.env.PRINT_LOG == "yes")
            for (var record of json.records)
              console.log("RESULT: " + JSON.stringify(record))
          extensions = json.records
        }else{
          extensions = []
          extensions.push(json)
        }
        res.send(JSON.stringify(extensions))
      })
      .catch(function(e){
        var json = {
          status: "FAILED"
        }
        res.send(json)
        console.log("catch exception")
        throw e
      })
    },
    getUpdate: function(req, res){
      if (hasUpdate){
        hasUpdate = false
        res.send(JSON.stringify(extensions))
      }else {
        res.send('[]')
      }
    },
    putOnhold: function(req, res){
      // restapi/v1.0/account/accountId/telephony/sessions/sessionId/parties/partyId/hold
      platform.post('/restapi/v1.0/account/~/telephony/sessions/' + req.body.telephonySessionId + '/parties/' + req.body.partyId + '/hold')
      .then(function(resp){
        console.log(resp)
        var json = resp.json()
        var resp = {
          status: "OK",
          action: "onhold"
        }
        res.send(resp)
      })
    },
    resumeCall: function(req, res){
      // restapi/v1.0/account/accountId/telephony/sessions/sessionId/parties/partyId/hold
      platform.post('/restapi/v1.0/account/~/telephony/sessions/' + req.body.telephonySessionId + '/parties/' + req.body.partyId + '/unhold')
      .then(function(resp){
        console.log(resp)
        var json = resp.json()
        var resp = {
          status: "OK",
          action: "unhold"
        }
        res.send(resp)
      })
    },
    startRecord:function(req, res) {

      console.log('recording started Vyshakh')

      platform.post('/restapi/v1.0/account/~/telephony/sessions/' + req.body.telephonySessionId + '/parties/' + req.body.partyId + '/recordings', '').then(
        function(res){
            console.log(resp)
            recordingId =  res.json().id;
            recordingStatus= res.json().active;
            console.log(recordingId + recordingStatus)
            var json = resp.json()
            var resp = {
              status: "OK",
              action: "startrecording"
            }
            console.log(json);
            res.send(resp)
        }
    )

        
    },

    stopRecord:function(req, res) {

      // Code to Stop Recording

      platform.send({method: 'PATCH', url: '/restapi/v1.0/account/~/telephony/sessions/' + req.body.telephonySessionId + '/parties/' + req.body.partyId + '/recordings/'+ recordingId +'', body:'{\"active\" : false}'
    }).then(
      function(res){
        
        console.log('recording stopped')
        console.log(resp)
        console.log(recordingId + recordingStatus)
        var json = resp.json()
        var resp = {
          status: "OK",
          action: "stoprecording"
        }
        res.send(resp)
    }

    )


        
    }
}

function handleCallForwarding(extension, id){
  if (extension.userStatus == "Busy"){
    for (var call of extension.activeCalls){
      if (call.telephonyStatus == "Ringing" && call.direction == "Inbound"){
        //sendTextMessage(call.from)
        console.log("CALLER ID: " + call.from)
        if (call.from == "Anonymous"){

        }else if (call.from == "+16502245476"){

        }else if (call.from == "+14134183745"){

        }else if (call.from.phoneNumber == "+13129828160"){

        }
      }
    }
  }
}

function readAllExtensionsForwarding(){
  platform.get('/restapi/v1.0/account/~/extension')
  .then(function(resp){
    //console.log(resp)
    var json = resp.json()
    console.log("Count 1: " + json.records.length)
    async.each(json.records,
      function(ext, callback){
        var path = '/account/~/extension/'+ ext.id
        readUserRules(path)
        callback()
      },
      function(err){
        console.log("DONE")
        //readCallHandlingRule()
      }
    );
  })
}
function readUserRules(path){
  platform.get(path + '/answering-rule')
    .then(function(resp){
      var res = resp.json()
      if (res.records.length > 0){
        for (var record of res.records){
          console.log("RECORD: " + JSON.stringify(record))
          if (record.type == "Custom"){
            var obj = {}
            obj['uri'] = record.uri
            obj['ruleId'] = record.id
            var mark = "extension/"
            var start = record.uri.indexOf(mark) + mark.length
            var stop = record.uri.indexOf("/answering-rule")
            obj['extId'] = record.uri.substring(start, stop)
            console.log(JSON.stringify(obj))
            userCallHandlingRule.push(obj)
          }
        }
      }else{
        console.log("Ext without RULE")
      }
    })
    .catch(function(e){
      console.log("Error")
    })
}

function detectCallerAndHandleCallForwarding(user, activeCall){
  if (activeCall.telephonyStatus == "Ringing" && activeCall.direction == "Inbound"){
    console.log("CALLER ID: " + activeCall.from)
    if (activeCall.from == "Anonymous"){
      console.log("FORWARD TO RECEPTIONIST")
    }else if (activeCall.from == "+16502245476"){
      console.log("UPDATE RULE 1")
      readCallHandlingRule(user)
    }else if (activeCall.from == "+14134183745"){
      console.log("UPDATE RULE 2")
    }else if (activeCall.from == "+13129828160"){
      console.log("UPDATE RULE 3")
    }
  }
}

function readCallHandlingRule(user){
    platform.get('/restapi/v1.0/account/~/extension/' + user.extId + '/answering-rule/' + user.ruleId)
      .then(function (response) {
        var json = response.json()
        console.log("rule: " + JSON.stringify(json))
      })
      .catch(function(e) {
        console.error(e);
        throw e;
      });
}
function sendTextMessage(toNumber){
  var fromNumber = ""
  if (process.env.PROD == "production"){
    fromNumber= process.env.USERNAME_PROD
  }else{
    fromNumber= process.env.USERNAME_SB
  }
  platform.post('/account/~/extension/~/sms', {
    from: {'phoneNumber':fromNumber},
    to: [{'phoneNumber': toNumber}],
    text: "Sorry, I am in a meeting right now. Will call you back soon."
  })
}

function enableUserBusyCallForwardingRule(id){
  console.log("enableUserBusyCallForwardingRule")
  platform.get('/account/~/extension/' + id + '/answering-rule')
    .then(function(resp){
      var res = resp.json()
      if (res.records.length > 0){
        for (var record of res.records){
          console.log("RECORD: " + JSON.stringify(record))
          if (record.type == "Custom" && record.name == "When busy"){
            platform.put(record.uri, {
              enabled: true
            })
            .then(function(resp){
              console.log("ENABLED: " + JSON.stringify(resp.json()))
            })
            break
          }
        }
      }else{
        console.log("Ext without RULE")
      }
    })
    .catch(function(e){
      console.log("Error")
    })
}

function disableUserBusyCallForwardingRule(id){
  platform.get('/account/~/extension/' + id + '/answering-rule')
    .then(function(resp){
      var res = resp.json()
      if (res.records.length > 0){
        for (var record of res.records){
          console.log("RECORD: " + JSON.stringify(record))
          if (record.type == "Custom" && record.name == "When busy"){
            platform.put(record.uri, {
              enabled: false
            })
            .then(function(resp){
              console.log("DISABLED: " + JSON.stringify(resp.json()))
            })
            break
          }
        }
      }else{
        console.log("Ext without RULE")
      }
    })
    .catch(function(e){
      console.log("Error")
    })
}

var subcription = rcsdk.createSubscription()
function subscribeForNotification(){
  var eventFilter = []
  eventFilter.push('/restapi/v1.0/account/~/presence?detailedTelephonyState=true')
  subcription.setEventFilters(eventFilter)
  .register()
  .then(function(resp){
    var json = resp.json();
    console.log("subscriptionId: " + json.id)
    console.log('ready to get account presense')
  })
  .catch(function(e){
    throw e
  })
}
subcription.on(subcription.events.notification, function(msg){
  console.log("PRESENCE EVENT")
  /*
  for (var i=0; i<userCallHandlingRule.length; i++){
    var user = userCallHandlingRule[i]
    if (process.env.PRINT_LOG == "yes")
      console.log("NOTIFICATION: " + JSON.stringify(msg.body))

    if (user.extId == msg.body.extensionId){
      if (msg.body.telephonyStatus == "Ringing"){
        //readCallHandlingRule(user)
        if (msg.body.activeCalls != undefined){
          detectCallerAndHandleCallForwarding(user, msg.body.activeCalls[0])
        }
        break
      }
    }
  }
  */
  for (var i=0; i<extensions.length; i++){
    var ext = extensions[i]
    if (process.env.PRINT_LOG == "yes")
      console.log("NOTIFICATION: " + JSON.stringify(msg.body))

    if (ext.extension.id == msg.body.extensionId){
      extensions[i].telephonyStatus = msg.body.telephonyStatus
      extensions[i].presenceStatus = msg.body.presenceStatus
      extensions[i].userStatus = msg.body.userStatus
      extensions[i].dndStatus = msg.body.dndStatus
      extensions[i].activeCalls = msg.body.activeCalls
      extensions[i].message = msg.body.message

      hasUpdate = true
      if (extensions[i].activeCalls != undefined){
        handleCallForwarding(extensions[i], msg.body.extensionId)
      }else if (extensions[i].userStatus == "Offline"){
        console.log("Offline")
        enableUserBusyCallForwardingRule(ext.extension.id)
      }else if (extensions[i].userStatus == "Available"){
        disableUserBusyCallForwardingRule(ext.extension.id)
      }
      break
    }
  }

})

function removeRegisteredSubscription() {
    platform.get('/subscription')
      .then(function (response) {
        var data = response.json();
        //subscribeForNotification()
        if (data.records.length > 0){
          for(var record of data.records) {
            // delete old subscription before creating a new one
            platform.delete('/subscription/' + record.id)
              .then(function (response) {
                console.log("deleted: " + record.id)
                subscribeForNotification()
              })
              .catch(function(e) {
                console.error(e);
                throw e;
              });
          }
        }else{
          subscribeForNotification()
        }
      })
      .catch(function(e) {
          console.error(e);
          throw e;
      });
}

engine.login()
