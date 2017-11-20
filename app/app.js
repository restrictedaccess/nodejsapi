var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');
var mongoose = require('mongoose');
require('events').EventEmitter.defaultMaxListeners = Infinity;
var routes = require('./routes/index');
var users = require('./routes/users');
var margins = require('./routes/margins');
var sample = require('./routes/sample');
var clients = require('./routes/clients');
var staff = require('./routes/staff');
var invoice = require('./routes/invoice');
var timesheet = require('./routes/timesheet');
var commission = require('./routes/commission');
var currency_adjustments = require('./routes/currency_adjustments');
var subcontractors = require('./routes/subcontractors');
var running_balance = require('./routes/running_balance');
var send = require('./routes/send');
require('events').EventEmitter.prototype._maxListeners = 0;
var moment = require("moment-timezone");
moment.tz.setDefault("Asia/Manila");
var quote = require('./routes/quote');
var timesheet_adjustments = require('./routes/timesheet_adjustments');
var sendgrid = require('./routes/sendgrid');
var invoice_reporting = require('./routes/invoice_reporting');
//var rsm = require('./routes/rsm');
var leave_request =  require('./routes/leave_request');
var asl_resume = require('./routes/asl');
var jobseeker =  require('./routes/jobseeker_v2');
var rs_employment_history =  require('./routes/rs_employment_history');
var timesheet_details =  require('./routes/timesheet_details');
var timesheet_details_notes =  require('./routes/timesheet_details_notes');
var available_balance =  require('./routes/available_balance');
var xero =  require('./routes/xero');
var invoice_versioning =  require('./routes/invoice_versioning');

var sync = require('./routes/sync');
var websocket = require('./routes/websocket');
var search = require('./routes/search');

var test_auto = require('./routes/test-auto');

var app = express();
mongoose.Promise = global.Promise;



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);
app.use('/margins', margins);
app.use('/sample', sample);
app.use('/clients', clients);
app.use('/staff', staff);
app.use('/invoice', invoice);
app.use('/quote', quote);
app.use('/timesheet', timesheet);
app.use('/commission', commission);
app.use('/currency-adjustments', currency_adjustments);
app.use('/send', send);
app.use('/subcontractors', subcontractors);
app.use('/running-balance', running_balance);
app.use('/timesheet-adjustments', timesheet_adjustments);
app.use('/sendgrid', sendgrid);
app.use('/invoice-reporting', invoice_reporting);
//app.use('/rsm', rsm);
app.use('/leave-request', leave_request);
app.use('/asl', asl_resume);
app.use('/jobseeker', jobseeker);
app.use('/rs-employment-history', rs_employment_history);
app.use('/sync', sync);
app.use('/search',search);
app.use('/timesheet-details',timesheet_details);
app.use('/timesheet-details-notes',timesheet_details_notes);
app.use('/available-balance',available_balance);
app.use('/xero',xero);
app.use('/websocket',websocket);

app.use('/invoice-auto-creation',test_auto);
app.use('/invoice-versioning',invoice_versioning);




// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

app.use(cors());

module.exports = app;