var fs = require('fs');
var async = require('async')
var request = require('request');
var parsers = require('./lib/parsers');
var db = require('./lib/db')

var singlePageBody = fs.readFileSync('./example_of_single_page.html', 'utf8');
console.log(parsers.parseHeadTable(singlePageBody))
console.log(parsers.parseMainTable(singlePageBody))