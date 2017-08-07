var fs = require('fs');
var cheerio = require('cheerio');

var file = './basic.html'

var body = fs.readFileSync(file, 'utf8');
var sj = cheerio.load(body)

var jsonKeys = [];
var jsonFiles = {};

fs.readdir('./', function(err, items) {
    
 		
    for (var i=0; i<items.length; i++) {
    	if(items[i].indexOf('.json')==(items[i].length-5)) {
				var jsonString = fs.readFileSync('./' + items[i], 'utf8');
				var json = JSON.parse(jsonString);
				json.forEach((row) => {
					var keys = Object.keys(row);
					keys.forEach((k) => {
						if(jsonKeys.indexOf(k)==-1) {
							jsonFiles[k] = items[i];
							jsonKeys.push(k)
						}
					})
				})
    	}
    }
    var outputObj = {
    	keys:jsonKeys,
    	extract:extractHtmlFields(sj)
    }
    console.log(JSON.stringify(outputObj))
});



function extractHtmlFields($) {

	var extractedList = [];
	$('label, h1').each((i, element) => {

		var label = $(element).text();
		findNest(element)

		function findNest(e) {
			var testCase = $(e).parent()
			if($(testCase).find('label, h1').length>1) {
				next(e)
			} else {
				findNest(testCase)
			}
		}
		function next(e) {
			var text = $(e).text();
			var matches = text.match(/\{\{([^\}]*)\}\}/mg)


			if(!matches) {
				var doneExtract = false;
				$(e).nextAll().each((i, n) => {
					if(!doneExtract && $(n).find('label, h1').length==0) {
						var m = $(n).text().match(/\{\{([^\}]*)\}\}/mg)

						if(m) {
							if(!matches) {
								matches = m
							} else {
								matches.push.apply(matches, m)
							}
						}
					} else {
						doneExtract = true;
					}
				});
				if(!matches) {
					if($(e).prop("tagName")=='TD') {
						var index = $(e).index();

						var labelRow = $(e).parent()
						var labelLength = labelRow.find('td').length;

						var valueRow = $(e).parent().next();
						var valueColumns = valueRow.find('td');

						if(valueColumns.length==labelLength) {
							var m = $(valueColumns[index]).text().match(/\{\{([^\}]*)\}\}/mg)
							matches = m
						}
					}
				}
				makeResult(matches)
				return
			}
			makeResult(matches)
		}
		function makeResult(matches) {
			var jk = [];
			var existsList = false

			if(matches) {
				matches = matches.map((s) => {
					return s.replace(/\{\{([^}]*)\}\}/,"$1")
				})
				jsonKeys.forEach((k) => {
					var l = matches.filter((a) => {
						return a.toLowerCase().includes(k.toLowerCase())
					})
					if(l.length) {
						existsList = true
						jk.push({
							file:jsonFiles[k],
							key:k
						})
					}
				})
			}

			label = label.replace(/\{\{[^\}]*\}\}|\:/g, "").trim()

			extractedList.push({
				htmlFile:file,
				label:label,
				matches:matches,
				exists:existsList,
				jsonKey:jk
			})
		}
	})
	return extractedList
}
