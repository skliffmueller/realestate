var cheerio = require('cheerio');

function getFrameUrl($) {
	return $('frame').attr('src')
}

function getHomeButtonLink($) {
	var onclick = $('table[bordercolor=Red] input[type=button]').attr('onclick');
	return onclick.match(/window\.location=\'([^']+)\'/)[1]
}

function getSearchForm($) {
	var url = $('form[name=form1]').attr('action')
	var obj = {}
	$('input').each((i, element) => {
		var e = $(element);
		var name = e.attr('name')
		obj[name] = e.attr('value') || '';
	})
	return {
		url:url,
		values:obj
	}
}

function parseNextPageLink($) {
	var link = ""; // http://fl-martin-appraiser.governmax.com/propertymax/standard/list_proval_t.asp?r=820&l_mv=next&sid=AFA591E266474384828688D34C302D00
	$('table[bordercolor=PINK] tr:nth-child(3) table[bordercolor=GREEN] tr td > p > font > a').each((i, element) => {
		var base = $(element)
		var key = base.children('b').text().toLowerCase();
		if(key=='next') {
			link = base.attr('href')
		}
	})
	return link;
}

function parsePageLinks($) {
	var links = []; // http://fl-martin-appraiser.governmax.com/propertymax/standard/list_proval_t.asp?r=820&l_mv=next&sid=AFA591E266474384828688D34C302D00
	$('table[bordercolor=PINK] tr:nth-child(3) table[bordercolor=GREEN] tr td > font > a').each((i, element) => {
		var key = $(element).text()
		if(/[0-9]+/.test(key)) {
			links.push({
				page:Number(key),
				link:$(element).attr('href')
			})
		}
	})
	return links;
}

function parsePageListings($) {
	var headers = [];
	var rows = [];
	// Link http://fl-martin-appraiser.governmax.com/propertymax/GRM/tab_parcel_v1002_FLMartin.asp?t_nm=base&l_cr=140&t_wc=|parcelid=55%2D38%2D41%2D490%2D000%2D00040%2D0&sid=AFA591E266474384828688D34C302D00
	$('table[bordercolor=Green] table[bordercolor=Black] tr').each((i, element) => {
		if(i==0) {
			$(element).find('td font b').each((b, e) => {
				var head = $(e).text().replace(/\r?\n|\r/g,"").trim()
				headers.push(head)
			})
		} else {
			var obj = {}
			$(element).find('td font').each((j, e) => {
				var base = $(e);
				var bold = base.children('b')
				if(bold.length) {
					base = $(bold)
				}
				var a = base.children('a')
				if(a.length) {
					obj.link = $(a).attr('href')
					base = a;
				}
				obj[headers[j]] = $(base).html().replace(/\r?\n|\r/g,"").replace(/ +/g," ").replace(/\&amp\;/g,"&").replace(/\&\#xA0\;/g,"")
			})
			rows.push(obj)
		}
	})
	return rows
}

function parseMainTable($) {
	var lastWasKey = false;
	var baseKey = "";
	var childKey = "";
	var obj = {};
	$('table[bordercolor=Green] table[cellpadding=2] tr > td > font').each((i, element) => {
		var base = $(element);
		var bold = base.children('b')
		if(bold.length) {
			// Key
			var a = bold.text().replace(/\r?\n|\r/g,"").trim();
			if(lastWasKey) {
				lastWasKey = false;
				baseKey = childKey;
			} else {
				lastWasKey = true;
			}
			childKey = a;
		} else {
			// Value
			var a = base.html().replace(/\r?\n|\r/g,"").replace(/\<br\s?\/?\>/g,"\n").replace(/ +/g," ").replace(/\&\#xA0\;/g,"");
			lastWasKey = false;
			if(!obj[baseKey]) {
				obj[baseKey] = {}
			}
			obj[baseKey][childKey] = a;
		}
	})
	return obj
}

function parseHeadTable($) {
	var headers = $('table[bordercolor=Green] table[bordercolor=Lime] tr:nth-child(1) td > font > b')
	var values = $('table[bordercolor=Green] table[bordercolor=Lime] tr:nth-child(2) td > font')
	var obj = {}
	headers.each((i, e) => {
		var key = $(e).text().replace(/\r?\n|\r/g,"").trim();
		var value = $(values[i]).text().replace(/\r?\n|\r/g,"").trim();
		obj[key] = value;
	})
	return obj
}

module.exports = {
	getFrameUrl:getFrameUrl,
	getHomeButtonLink:getHomeButtonLink,
	getSearchForm:getSearchForm,
	parseNextPageLink:parseNextPageLink,
	parsePageLinks:parsePageLinks,
	parsePageListings:parsePageListings,
	parseMainTable:parseMainTable,
	parseHeadTable:parseHeadTable
}