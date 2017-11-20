/**
 * Created by JMOQUENDO on 6/27/17.
 */

var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var request = require('request');
var mysql = require("mysql");
http.post = require("http-post");
var moment = require('moment');
var njsUrl = "http://127.0.0.1:3000";


var Invoice = function(){

    this.client = {};
    this.invoice_date = new Date();
    this.subcontractors_id = false;
    this.tax_invoice_no = null;
    this.invoice_item = [];
    this.start_date = moment().format("YYYY-MM-05");
    // this.start_date = (moment(moment().format("YYYY-MM-04")).isoWeekday() !== 6 && moment(moment().format("YYYY-MM-04")).isoWeekday() !== 7
    //     ? moment().format("YYYY-MM-04") : this.getBusinessDays(moment().format("YYYY-MM-04"),1));
    this.ts_date = moment().format("YYYY-MM-01");
    this.due_date = this.getBusinessDays(this.start_date,4);
    this.currency_date =  moment(this.currency_date).subtract(1,'months').startOf('month').format('YYYY-MM-DD');

    this.hasCurrencyAdj = false;

};

Invoice.prototype.getTaxInvoice = function()
{
//get taxinvoice , call existing api;
    var me = this;
    var tax = null;
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var data = {
        id : this.client.client_id
    }
    var callback = function(response)
    {
        var str = '';

        response.on('data', function (chunk) {
            str += chunk;
        });
        response.on('end', function () {
            tax = JSON.parse(str);
            console.log(tax);
            if(tax.success){me.tax_invoice_no = tax.tax_invoice_no;}
            willFulfillDeferred.resolve(me);
        });
    };
    http.post(njsUrl + '/clients/get-new-tax-invoice-no/',data,callback);
    return willFulfill;
};



Invoice.prototype.getSubtotal = function() {
    var me = this;
    var total = 0;
    this.invoice_item.forEach(function(item,key) {
        total += (Math.round(item.qty * 100)/100) * (Math.round(item.unit_price * 100)/100);
        // item.amount = (Math.round(item.qty * 100)/100) * (Math.round(item.unit_price * 100)/100);
        item.amount = (item.qty * item.unit_price);
        item.amount = parseFloat(item.amount.toFixed(2));
    });
    return parseFloat(total.toFixed(2));
};


Invoice.prototype.getGST = function() {

    if (this.client != null) {
        //if currency is AUD
        if (this.client.apply_gst == "Y") {

            var gstAmount = this.getSubtotal() * .1;
            return parseFloat(gstAmount.toFixed(2));

        } else {
            return 0;
        }
    } else {
        return 0;
    }

};

Invoice.prototype.getTotal = function() {

    var total = this.getSubtotal() + this.getGST();
    return parseFloat(total.toFixed(2));
};


Invoice.prototype.toJSON = function()
{
    var output = {};

    output.added_by = "Invoice auto creation";
    output.added_on = moment(this.start_date).toDate();
    output.added_on_unix = moment(this.start_date).unix();
    output.order_id = this.tax_invoice_no;
    output.client_email = this.client.lead.email;
    output.client_fname = this.client.lead.fname;
    output.client_lname = this.client.lead.lname;
    output.type = "order";
    output.payment_advise = false;
    output.mongo_synced = true;
    output.client_id = this.client.client_id;
    output.apply_gst = this.client.apply_gst;
    output.currency = this.client.currency;
    output.invoice_setup = "margin";
    output.disable_auto_follow_up = "N";
    output.status = "new";
    output.client_names = [this.client.lead.fname.toLowerCase(), this.client.lead.lname.toLowerCase()];
    output.items = this.invoice_item;
    output.sub_total = this.getSubtotal();
    output.gst_amount = this.getGST();
    output.total_amount = this.getTotal();
    output.pay_before_date = moment(this.due_date).toDate();
    output.pay_before_date_unix = moment(this.due_date).unix();

    var historydata = {
        by:"Invoice auto creation",
        timestamp:moment(this.start_date).toDate(),
        timestamp_unix:moment(this.start_date).unix()
    }
    if(!this.hasCurrencyAdj)
    {
        historydata = {
            by:"Invoice auto creation - *note: currency adjusment items not set",
            timestamp:moment(this.start_date).toDate(),
            timestamp_unix:moment(this.start_date).unix()
        }
    }

    output.history = [];
    output.history.push(historydata);


    return output;
};

//send Invoice

Invoice.prototype.send = function()
{
    console.log("sending...");
    var order_id = this.tax_invoice_no;

    var callBackDetails = function(response)
    {
        var str = '';
        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function () {
            var data = JSON.parse(str);

            if(data.success)
            {
                if(typeof data.result !== "undefined")
                {
                    var params = {
                        mongo_id : data.result._id,
                        admin : "System Generated",
                        custom : false
                    };

                    var options = {
                        method: 'POST',
                        url: njsUrl + '/send/invoice-with-attachment-per-recipient/',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        json: params
                    };

                    request(options,callBackSend);

                    function callBackSend(error, response, body)
                    {
                        if (!error) {
                            console.log("Success Sending of email");
                        }
                        else {
                            console.log('Error happened: '+ error);
                        }

                    }
                }
            }


        });
    };

    //get invoice details from mongo
    http.get(njsUrl + "/invoice/get-invoice-details/?order_id="+order_id, callBackDetails);

};


Invoice.prototype.getBusinessDays = function(date,days)
{
    date = moment(date);
    while (days > 0) {
        date = date.add(1, 'days');
        if (date.isoWeekday() !== 6 && date.isoWeekday() !== 7) {
            days -= 1;
        }
    }
    return moment(date).format('YYYY-MM-DD');

};




module.exports = Invoice;
