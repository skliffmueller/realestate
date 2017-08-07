var fs = require('fs');
var async = require('async')
var request = require('request');
var cheerio = require('cheerio');
var parsers = require('./lib/parsers');
var db = require('./lib/db')

var singlePageBody = fs.readFileSync('./example_of_single_page.html', 'utf8');
var singleJquery = cheerio.load(singlePageBody)
console.log(parsers.parseHeadTable(singleJquery))
console.log(parsers.parseMainTable(singleJquery))