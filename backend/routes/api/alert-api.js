var AppConstants = require('../../constants/AppConstants');
var Helpers = require('../../common/Helpers');
var MongoDB = require('../../db/mongodb');
var InfluxDB = require('../../db/influxdb');

function AlertApi(){};

AlertApi.prototype.handleAlertData = function(req, res) {
    var action = req.query.action;
    switch (action) {
        case "saveAlert":
            new AlertApi().saveAlert(req, res);
            break;
        case "getAllAlerts":
            new AlertApi().getAllAlerts(req, res);
            break;
        default:
            res.send("no data");
    }
}

AlertApi.prototype.saveAlert = function(req, res) {
    var alertObj = req.body;

    if (alertObj._id) {
        var objectToUpdate = {
            warningThreshold: alertObj.warningThreshold,
            criticalThreshold: alertObj.criticalThreshold
        };

        MongoDB.updateData(AppConstants.ALERT_LIST, {'job.jobId': alertObj.job.jobId}, objectToUpdate);
        res.send(alertObj);
    } else {
        MongoDB.insertData(AppConstants.ALERT_LIST, alertObj, res);
    }

    var emailBodyToSend = 'Hi ,<br><br>' +
                            'The job you have added for <b>' +
                            alertObj.job.siteObject.value +
                            '</b> is having high respnse time.<br><br>' +
                            'Regards,<br>xSUM admin';

    Helpers.sendEmail(alertObj.email, 'Alert from xSUM', emailBodyToSend, res);
}

AlertApi.prototype.getAllAlerts = async function(req, res) {
    var userObj = req.body;
    var queryObj = {userEmail: userObj.userEmail};
    var jobData = await MongoDB.getAllData(AppConstants.DB_JOB_LIST, queryObj);

    var alertsData = [];

    for (var i = 0; i < jobData.length; i++) {
        var queryToGetJobAlert = {
            'job.jobId': jobData[i].jobId
        };

        var alertObjData = await MongoDB.getAllData(AppConstants.ALERT_LIST, queryToGetJobAlert);
        var jobResults = await InfluxDB.getAllDataFor("SELECT * FROM pageLoadTime where jobid='" + jobData[i].jobId+"'"); //+ "' and time >= '" + yesterDay + "'")

        var meanCount = 0;
        for (var j = 0; j < jobResults.length; j++) {
            meanCount += jobResults[j].mean;
        }

        var meanAvg = meanCount/jobResults.length;
        var warningThreshold = meanAvg + 3000; // 5000 in miliseconds
        var criticalThreshold = meanAvg + 5000;

        if (alertObjData.length > 0) {
            alertsData.push({
                job: alertObjData[0].job,
                meanAvg: meanAvg/1000,
                warningThreshold: alertObjData[0].warningThreshold,
                criticalThreshold: alertObjData[0].criticalThreshold,
                _id: alertObjData[0]._id
            });
        } else {
            alertsData.push({
                job: jobData[i],
                meanAvg: meanAvg/1000,
                warningThreshold: warningThreshold/1000,
                criticalThreshold: criticalThreshold/1000
            });
        }

    }

    res.send({alertsData: alertsData});
}

module.exports = new AlertApi();
