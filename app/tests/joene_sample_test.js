var assert = require("assert");
var chai = require('chai'),
    expect = chai.expect,
    should = chai.should();

const request = require('supertest');
var app = require("../app");

//SET UP MYSQL Connection
var configs = require("../config/configs");
var mysql = require("mysql");
var mysqlCredentials = configs.getMysqlCredentials();
var pool = mysql.createPool({
	host : mysqlCredentials.host,
	user : mysqlCredentials.user,
	password : mysqlCredentials.password,
	database : mysqlCredentials.database
});


describe('Array', function() {
  describe('#indexOf()', function() {
    it('should return -1 when the value is not present', function() {
      assert.equal(-1, [1,2,3].indexOf(4));
    });
  });
});

describe('Checking of return value', function() {
  describe('#checkVal()', function() {
    it('it should return 30', function() {
    	var val = 30;
      assert.equal(val, 30);
    });
  });
});