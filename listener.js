var mqtt = require('mqtt')
var client  = mqtt.connect('mqtt://your-proxy-checker.com')
var exec = require('exec');

client.on('connect', function () {
  client.subscribe('start', function (err) {});
  client.subscribe('stop', function (err) {});
})

client.on('message', function (topic, message) {
switch(topic){
    default:
        console.log(topic);
        break;
    case 'start':
        execCmd('start')
        break;
    case 'stop':
        execCmd('stop')
        break;
}
})

function execCmd(cmd){
    exec('pm2 ' + cmd + ' index', function(err, out, code) {
        if (err)
          console.log(err);
      });
}