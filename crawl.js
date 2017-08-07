var fs = require('fs');
var async = require('async')
var request = require('request');
var parsers = require('./lib/parsers');
var db = require('./lib/db')
var cheerio = require('cheerio');

var baseUrl = 'http://fl-martin-appraiser.governmax.com/propertymax'

var baseRequest = request.defaults({
	baseUrl: baseUrl,
	followAllRedirects: true,
	headers:{
		'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Safari/537.36'
	}
})


//var singlePageBody = fs.readFileSync('./example_of_single_page.html', 'utf8');
//console.log(parsers.parseHeadTable(singlePageBody))
//console.log(parsers.parseMainTable(singlePageBody))


//var middlePageBody = fs.readFileSync('./example_of_middle_page.html', 'utf8');
//console.log(parsers.parsePageListings(middlePageBody))
//console.log(parsers.parsePageLinks(middlePageBody))

//var p = parsers.parsePageListings(middlePageBody)

var queModel = null;

db.createConnection()
db.go(function() {
	queModel = require('./models/que')
	startSession()
})

var currentPageR = "";
var sid = "";

function startSession() {
	baseRequest.get('/site_authlink.asp?r=martin.fl.us', (err, res, body) => {

		let homeUrl = parsers.getFrameUrl(cheerio.load(body))
		baseRequest.get('/' + homeUrl, (err, res, body) => {
			let searchUrl = parsers.getHomeButtonLink(cheerio.load(body));
			baseRequest.get({
				baseUrl:'',
				url:searchUrl
			}, (err, res, body) => {
				let form = parsers.getSearchForm(cheerio.load(body))
				form.values['n.own_name'] = '%%%';
				baseRequest.post('/' + form.url, { form:form.values }, (err, res, body) => {
					parsePageListStart(body, () => {
						setInterval(() => {
							getNextQue()
						}, 2000)
					})
				})
			})
		})
	})
}

function parsePageListStart(body, done) {
	var j = cheerio.load(body);
	var pageLinks = parsers.parsePageLinks(j);
	var qs = parseQueryString(pageLinks[0].link)
	if(qs.r) {
		currentPageR = qs.r
	}
	if(qs.sid) {
		sid = qs.sid
	}
	var i = 0;
	async.each(pageLinks, (page, cb) => {
		var link = page.link.replace('..', '')
		queModel.update({
			action:'page',
			page: page.page
		},{
			$set:{
				rawLink:page.link,
				parsedLink:{
					url: baseUrl + link,
					uri: link.split('?')[0],
					query: parseQueryString(link)
				}
			},
			$setOnInsert:{
				status:'ready',
				parcelId:"",
				log:[{
					status:'ready',
					date:new Date()
				}]
			}
		},{
			upsert:true
		}, (err, data) => {
			if(err) {
				console.log('error', err)
				return cb(err)
			}
			cb()
		})
	}, (err) => {
		i++
		if(i>=2) {
			done(pageLinks, listings)
		}
	})

	var listings = parsers.parsePageListings(j)
	async.each(listings, (l, cb) => {
		var link = l.link.replace('..', '')
		queModel.update({
			action:'profile',
			parcelId: l['Parcel ID']
		},{
			$set:{
				rawLink:l.link,
				parsedLink:{
					url: baseUrl + link,
					uri: link.split('?')[0],
					query: parseQueryString(link)
				}
			},
			$setOnInsert:{
				status:'ready',
				page:-1,
				log:[{
					status:'ready',
					date:new Date()
				}]
			}
		},{
			upsert:true
		}, (err, data) => {
			if(err) {
				console.log('error', err)
				return cb(err)
			}
			cb()
		})
	}, (err) => {
		i++
		if(i>=2) {
			done(pageLinks, listings)
		}
	})
}

var isRunning = false;

function getNextQue() {
	if(isRunning) {
		return;
	}
	isRunning = true;
	queModel.find({
			status:'ready'
		})
		.sort({action:-1, parcelId:1, page:1})
		.limit(1)
		.lean()
		.exec((err, data) => {
			if(err) {
				isRunning = false;
				return;
			}
			if(!data.length) {
				console.log('nothing to que')
				isRunning = false;
				return;
			}
			var job = data[0];

			if(job.action=='profile') {
				getProfile(job, function(err) {
					console.log(err)
					isRunning = false;
				});
				return;
			}
			if(job.action=='page') {
				getPage(job, function(err) {
					console.log(err);
					isRunning = false;
				});
				return;
			}
			isRunning = false;
		})
}

function getProfile(job, cb) {
	var qsObj = job.parsedLink.query;
	if(qsObj.r) {
		qsObj.r = currentPageR;
	}
	if(qsObj.sid) {
		qsObj.sid = sid;
	}
	baseRequest.get({
		url:job.parsedLink.uri+'?'+createQueryString(qsObj)
	}, (err, res, body) => {
		if(err) {
			cb(err);
			return;
		}
		var j = cheerio.load(body);
		var head = parsers.parseHeadTable(j);
		var main = parsers.parseMainTable(j);
		var d = JSON.stringify({
			head: head,
			main: main
		})
		queModel.update({
			_id:job._id
		},{
			$set:{
				status:'done',
				rawData:body,
				parsedData:d
			}
		}, (err, data) => {
			if(err) {
				cb(err);
				return;
			}
			cb()
		})
	})

}

function getPage(job, cb) {
	var qsObj = job.parsedLink.query;
	if(qsObj.r) {
		qsObj.r = currentPageR;
	}
	if(qsObj.sid) {
		qsObj.sid = sid;
	}
	baseRequest.get({
		url:job.parsedLink.uri+'?'+createQueryString(qsObj)
	}, (err, res, body) => {
		if(err) {
			cb(err);
			return;
		}
		asyncPages(body, (err, pageLinks, listings) => {
			if(err) {
				cb(err);
				return;
			}
			var d = JSON.stringify({
				pages:pageLinks,
				profiles:listings
			})
			queModel.update({
				_id:job._id
			},{
				$set:{
					status:'done',
					rawData:body,
					parsedData:d
				}
			}, (err, data) => {
				if(err) {
					cb(err);
					return;
				}
				cb()
			})
		})
	})
}


function asyncPages(body, done) {
	var j = cheerio.load(body);
	var pageLinks = parsers.parsePageLinks(j);
	var qs = parseQueryString(pageLinks[0].link)
	if(qs.r) {
		currentPageR = qs.r
	}
	var i = 0;
	async.each(pageLinks, (page, cb) => {
		var link = page.link.replace('..', '')
		queModel.update({
			action:'page',
			page: page.page
		},{
			$set:{
				rawLink:page.link,
				parsedLink:{
					url: baseUrl + link,
					uri: link.split('?')[0],
					query: parseQueryString(link)
				}
			},
			$setOnInsert:{
				status:'ready',
				parcelId:"",
				log:[{
					status:'ready',
					date:new Date()
				}]
			}
		},{
			upsert:true
		}, (err, data) => {
			if(err) {
				return cb(err)
			}
			cb()
		})
	}, (err) => {
		if(err) {
			done(err)
			return;
		}
		i++
		if(i>=2) {
			done(null, pageLinks, listings)
		}
	})

	var listings = parsers.parsePageListings(j)
	async.each(listings, (l, cb) => {
		var link = l.link.replace('..', '')
		queModel.update({
			action:'profile',
			parcelId: l['Parcel ID']
		},{
			$set:{
				rawLink:l.link,
				parsedLink:{
					url: baseUrl + link,
					uri: link.split('?')[0],
					query: parseQueryString(link)
				}
			},
			$setOnInsert:{
				status:'ready',
				page:-1,
				log:[{
					status:'ready',
					date:new Date()
				}]
			}
		},{
			upsert:true
		}, (err, data) => {
			if(err) {
				return cb(err)
			}
			cb()
		})
	}, (err) => {
		if(err) {
			done(err)
			return;
		}
		i++
		if(i>=2) {
			done(null, pageLinks, listings)
		}
	})
}



function createQueryString(obj) {
	var esc = encodeURIComponent;
	var query = Object.keys(obj)
	    .map(k => k + '=' + obj[k])
	    .join('&');
	return query
}

function parseQueryString(url) {
	url = url.split('?')
	if(url.length>1) {
		url = url[1]
	} else {
		url = url[0]
	}
	url = url.split('&')
	var obj = {}
	url.forEach((v) => {
		var a = v.split('=');
		var key = a.splice(0, 1)
		obj[key] = a.join("=")
	})
	return obj;
}