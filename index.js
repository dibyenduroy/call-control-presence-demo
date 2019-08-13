var path = require('path')

if('production' !== process.env.LOCAL_ENV )
  require('dotenv').load();

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

var port = process.env.PORT || 3000

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)
var rc_engine = require('./engine');
app.get('/', function (req, res) {
  //rc_engine.login(req, res)
  res.render('index')
})

app.post('/readpresence', function (req, res) {
  rc_engine.readPresence(req, res)
})
app.get('/getupdate', function (req, res) {
  rc_engine.getUpdate(req, res)
})

app.post('/onhold', function (req, res) {
  rc_engine.putOnhold(req, res)
})

app.post('/unhold', function (req, res) {
  rc_engine.resumeCall(req, res)
})
app.post('/startrecording', function (req, res) {
  rc_engine.startRecord(req, res)
})
app.post('/stoprecording', function (req, res) {
  rc_engine.stopRecord(req, res)
})
