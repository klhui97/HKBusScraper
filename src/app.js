var express = require('express')
var eta = require('./routes/cnbus');
var bodyParser = require('body-parser')

var app = express()
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use('/api', eta);

app.listen(8081, function () {
    console.log('listening on *:8081');
});