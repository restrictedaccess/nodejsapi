var express = require('express');
var router = express.Router();

var configs = require("../config/configs");


/* GET margins */
router.get('/get-user', function(req, res, next) {
   var mysql_connection = configs.getMysql();

  console.log(req);
  res.setHeader('Content-Type', 'application/json');
  mysql_connection.connect();
  
  //todo
  mysql_connection.query('SELECT fname, lname FROM personal WHERE userid = 74', function(err, rows, fields) {
	
  
	  if (err) throw err;
	
	  //prepare output
	  var response = {success:true, result:rows};
	  res.send(JSON.stringify(response));
	  
      mysql_connection.end();
  });
  
	  
});




module.exports = router;
