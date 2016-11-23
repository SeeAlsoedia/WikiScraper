var fs = require('fs')
var request = require('request')
var cheerio = require('cheerio')
var htmlToText = require('html-to-text')
var crypto = require('crypto')
var listLinks = []

var mongoClient = require('mongodb').MongoClient
var mongoDbObj

mongoClient.connect('mongodb://localhost:27017/WikiDb', function(err, db){
  if(err)
    console.log(err)
  else {
    console.log("Connected to MongoDB")
    mongoDbObj = { db: db,
      articles: db.collection('articles')
    }
	}
})

var urlOutdated = function(url, obj) {
	var art = obj
	mongoDbObj.articles.find({url:url}).toArray(function(err, data){
		if(err){
			console.log(err)
		}
		else {
			var article = data.shift()
			if (article == null || article.md5 != art.md5) {
				console.log("Upserting an Article")
				upsertArticle(art)
			}
		}
	})
} 

var upsertArticle = function (json) {
	var article = json
	mongoDbObj.articles.save(json, {w:1}, function(err, result){
		if(err){
			console.log("Something go wrong. Error message: " + err)
		}
		else {
			console.log("Upserted successfully. " + result)
		}
	})
}

var scrapeURL = function(url) {

    var pattern = url.match(/https:\/\/pt.wikipedia.org\/wiki\//gi)

    if(pattern != null) {
		requestUrl(url)
    }
    else {
        console.log('The URL does not match with wikipedia pattern, URL: ' + url)
    }
}

var requestUrl = function(url) {
			var uri = url
	        request(url, function(error, response, html){
            if(!error){
				console.log("URL ACESSADA: " + url)
                var $ = cheerio.load(html)

                var raw, md5
                var json = { raw: "", title : "", url : uri, md5 : null, lastUpdated : null}
				
                $('#bodyContent').filter(function(){
                    var data = $(this)
                    raw = data.html()

                    var text = htmlToText.fromString(raw, {
                        wordwrap: 130
                    })        
					
					md5 = crypto.createHash('md5').update(text).digest("hex") 

                    json.raw = text
                    json.md5 = md5
                })

                $('#firstHeading').filter(function(){
                    var data = $(this)
                    json.title = data.text()
                })


                json.lastUpdated = new Date()
				urlOutdated(json.url, json)
				
                if(listLinks.length > 0)
                    scrapeURL(listLinks.pop())
                else {
                    var links = $('#bodyContent a')
                    $(links).each(function(i, link) {
                        var wikiArticle = $(link).attr('href')
                        if (wikiArticle != null && wikiArticle.startsWith('/wiki/'))
                            listLinks.push('https://pt.wikipedia.org' + $(link).attr('href'))
                    })

                    scrapeURL(listLinks.pop())
                }
            }
            else {
                console.log('Request Failed!')
                var url = 'https://pt.wikipedia.org/wiki/'
                scrapeURL(url)
            }
        })
}

var main = function() {
    var url = 'https://pt.wikipedia.org/wiki/'
    scrapeURL(url)
}

main()
