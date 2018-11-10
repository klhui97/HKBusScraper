// Imports
// -----------------------------------------------------------------
const exec = require('child_process').exec;
const axios = require('axios')
const express = require('express')
const md5 = require('md5')
const router = express.Router();

// To-do
// -----------------------------------------------------------------
/**
 * To-do List
 * @var deviceId
 *  A registerd deviceId are required. Try to sniff https request and get a vaild deviceId. 
 *  The deviceId is the same as value of the parameter - 'tk'
 */
var deviceId = '4e63705245fa1a09943f0f7004c51987b8a1d834f262856af434a9f3e663b8a3'
// -----------------------------------------------------------------

// CNbus Param setup
// -----------------------------------------------------------------
/**
 * 
 * @param {*} callback 
 *  a callback funtion that return a dict of common parameters
 *  java -jar routes/syscode2.jar is used to generate syscode2
 */
function getCommonParas(callback) {
    exec('java -jar routes/syscode2.jar', function (error, stdout, stderr) {
        sysCode2 = stdout.replace("\n", "")
        console.log("generated syscode 2 ------> ", sysCode2)
        callback({
            'l': '0',
            'p': 'iPhone',
            'version': '3.5.3',
            'version2': '5',
            'syscode': getSyscode(),
            'syscode2': sysCode2
        })
    });
}
/**
 *  a helper function to generate syscode
 */
function getSyscode() {
    secret = "firstbusmwymwy"
    timestamp = String(Math.round(new Date().getTime() / 1000)).substring(4)
    randonInt = "1234"
    stringToEncode = timestamp + randonInt + secret
    return timestamp + randonInt + md5(stringToEncode)
}
/**
 * A helper function to geenrate complete params
 * combine user request's query, common params, device id
 * @param {dict} query user request's query
 * @param {*} callback return params dict and deviceId
 */
function generateQueryAndTk(query, callback) {
    getCommonParas(function (params) {
        params = Object.assign({}, params, query)
        callback(params, deviceId)
    })
}
// -----------------------------------------------------------------

// For reference only
// -----------------------------------------------------------------
/**
 * refresh the token
 * @param {str} tk 
 */
function refreshToken(tk) {
    getCommonParas(function (params) {
        params['tk'] = tk
        params['devicetoken'] = tk
        params['bm'] = ''
        params['devicetype'] = 'iphone'
        params['mode'] = 'F'
        const instance = getAxios()
        instance.get('https://mobile.nwstbus.com.hk/push/pushtoken.php', { params: params }).then(response => {
            console.log("refresh token ", params['tk'], response.data)
        })
    })
}
/**
 * Seem not working, for reference
 * Try to generate and register a device id. Using loopPushToken
 * @param {int} job the number of device id you want to generate
 * @returns {[int]} a list of device ids
 */
router.get('/cnbus/test', function (req, res) {
    loopPushToken(1, [], function (deviceList) {
        res.send(deviceList)
    })
})
function loopPushToken(job, deviceList, callback) {
    if (job == 0) {
        callback(deviceList)
    }else {
        pushToken(function (token) {
            deviceList.push(token)
            job--;
            console.log("remaining jobs: ", job)
            loopPushToken(job, deviceList, callback)
        })
    }
}
function pushToken(callback) {
    const tk = require('crypto').randomBytes(32).toString('hex')
    getCommonParas(function (params) {
        params['tk'] = tk
        params['devicetoken'] = tk
        params['bm'] = ''
        params['devicetype'] = 'iphone'
        params['mode'] = 'R'
        // console.log(params)
        const instance = getAxios()
        instance.get('https://mobile.nwstbus.com.hk/push/pushtoken.php', { params: params }).then(response => {
            console.log("pushtoken ", params['tk'], response.data)
        })
    })
    getCommonParas(function (params) {
        params['tk'] = tk
        params['devicetoken'] = tk
        params['bm'] = ''
        params['mode'] = 'Y'
        // console.log(params)
        const instance = getAxios()
        instance.get('https://mobile.nwstbus.com.hk/push/pushtokenenable.php', { params: params }).then(response => {
            console.log("pushtokenenable ", params['tk'], response.data)
            getCommonParas(function (params) {
                params['tk'] = tk
                params['width'] = '640'
                // console.log(params)
                const instance = getAxios()
                instance.get('https://mobile.nwstbus.com.hk/api6/getadv.php', { params: params }).then(response => {
                    console.log("getadv ", params['tk'], response.data)
                })
                callback(tk)
            })
        })
    })
}
// -----------------------------------------------------------------

// Main program
// -----------------------------------------------------------------
/**
 * Refer to CNBus.postman_collection.json in postman/ to understand how it works
 * 'User-Agent': 'CitybusNWFB/5 CFNetwork/975.0.3 Darwin/18.2.0' must be put in the header
 */
function getAxios() {
    return axios.create({
        headers: { 'User-Agent': 'CitybusNWFB/5 CFNetwork/975.0.3 Darwin/18.2.0' }
    });
}

router.use(function timeLog(req, res, next) {
    res.set('Access-Control-Allow-Origin', "*")
    next();
});

router.get('/cnbus/getBusList', function (req, res) {
    refreshToken(deviceId)
    generateQueryAndTk(req.query, function (params, token) {
        params['tk'] = token
        const instance = getAxios()
        instance.get('http://mobile.nwstbus.com.hk/api6/getmmroutelist.php', { params: params }).then(response => {
            var buses = []
            var rows = response.data.split('<br>')
            rows.pop()
            for (i in rows) {
                array = rows[i].split('||')
                dict = {
                    busType: array[0],
                    route: array[1],
                    destCode: array[2],
                    oriName: array[4],
                    destName: array[5],
                    id: array[7],
                    bound: array[9]
                }
                buses.push(dict)
            }
            res.send({
                success: true,
                buses: buses
            })
        }).catch(error => {
            console.log(error)
            res.send({
                success: false
            })
        })
    })
})

router.get('/cnbus/getVariant', function (req, res) {
    var query = {
        id: req.query.id
    }
    generateQueryAndTk(query, function (params, token) {
        params['tk'] = token
        const instance = getAxios()
        instance.get('https://mobile.nwstbus.com.hk/api6/getvariantlist.php', { params: params }).then(response => {
            var service = []
            var rows = response.data.split('<br>')
            rows.pop()
            for (i in rows) {
                array = rows[i].split('||')
                // console.log(array)
                dict = {
                    color: array[1],
                    rdv: array[2],
                    description: array[3],
                    qInfo: '0|*|' + array[4].split('***').join('||')
                }
                service.push(dict)
            }
            res.send({
                success: true,
                service: service
            })
        }).catch(error => {
            console.log(error)
            res.send({
                success: false
            })
        })
    })
})

router.get('/cnbus/getStops', function (req, res) {
    var query = {}
    query['info'] = req.query.qInfo
    generateQueryAndTk(query, function (params, token) {
        params['tk'] = token
        const instance = getAxios()
        instance.get('https://mobile.nwstbus.com.hk/api6/ppstoplist.php', { params: params }).then(response => {
            var stops = []
            var rows = response.data.split('<br>')
            rows.pop()
            // console.log(response.data)
            for (i in rows) {
                array = rows[i].split('||')
                dict = {
                    stopSeq: array[2],
                    stopId: String((parseInt(array[3]))),
                    lat: parseFloat(array[5]),
                    long: parseFloat(array[6]),
                    name: array[7]
                }
                stops.push(dict)
            }
            res.send({
                success: true,
                stops: stops
            })
        }).catch(error => {
            console.log(error)
            res.send({
                success: false
            })
        })
    })
})

router.get('/cnbus/eta', function (req, res) {
    generateQueryAndTk(req.query, function (params, token) {
        params['removeRepeatedSuspend'] = "Y"
        params['interval'] = "60"
        params['showtime'] = 'Y'
        params['tk'] = token

        const instance = getAxios()

        instance.get('https://mobile.nwstbus.com.hk/api6/getnextbus2.php', { params: params }).then(response => {
            console.log(params)
            console.log(response.data)
            var etas = []
            var rows = response.data.split('<br>')
            rows.pop()
            for (i in rows) {
                array = rows[i].split('||')
                if (array[0] == 'HTML') {
                    break
                }
                dict = {
                    'distance': array.pop().split('|')[0],
                    'direction': array.pop().split('|')[0],
                    'time': array.pop().split('|')[0]
                }
                etas.push(dict)
            }
            res.send({
                success: true,
                response: etas
            })
        }).catch(error => {
            console.log(error)
            res.send({
                success: false
            })
        })
    })
})

router.get('/cnbus/nearby', function (req, res) {
    var params = req.query
    params['syscode'] = getSyscode()
    console.log(params)

    axios.get('https://mobile.nwstbus.com.hk/api6/getnearbystop.php?', { params: params }).then(response => {
        var rows = response.data.split('<br>')
        bus = []
        rows.pop()
        for (i in rows) {
            array = rows[i].split('||')
            bus.push({
                busType: array[0],
                route: array[1],
                destCode: array[2],
                oriName: array[4],
                destName: array[5],
                id: array[7],
                bound: array[14]
            })
        }
        res.send({
            success: true,
            buses: bus
        })
    }).catch(error => {
        console.log(error)
        res.send({
            success: false
        })
    })
})

router.get('/cnbus/ttb', function (req, res) {
    var syscode = getSyscode()
    var rdv = req.query.rdv
    var bound = req.query.bound
    console.log(req.query)

    res.redirect('https://mobile.nwstbus.com.hk/api6/gettimetable.php?rdv=||' + rdv + '&bound=' + bound + '&syscode=' + syscode);
})

module.exports = router
// End of program
// -----------------------------------------------------------------