var fs = require('fs')
var request = require('request')
var cheerio = require('cheerio')
var htmlToText = require('html-to-text')
var crypto = require('crypto')
var mongoose = require('mongoose')
var mongoosastic = require('mongoosastic')
var listLinks = []

var mongoClient = require('mongodb').MongoClient
var mongoDbObj

mongoClient.connect('mongodb://localhost:27017/WikiDb', function(err, db){
	if(err)
		console.log(err)
	else {
		console.log("Connected to MongoDB")
		mongoDbObj = { 
			db: db,
			articles: db.collection('articles')
		}
	}
})

mongoose.connect('mongodb://localhost:27017/WikiDb')

var articleSchema = new mongoose.Schema({
	_id: {type: mongoose.Schema.Types.ObjectId, es_indexed:true },
	title: {type: String, es_indexed:true },
	url: String,
	md5: String,
	lastUpdated: Date,
	raw: {type: String, es_indexed:true }
})
articleSchema.plugin(mongoosastic)

var articleModel = mongoose.model("articles", articleSchema)

articleModel.createMapping(function(err, mapping) {
	if (err) {
		console.log('error creating mapping')
		console.log(err)
	}
	else {
		console.log('mapping created')
		console.log(mapping)
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
				if(article && article._id)
					art._id = article._id
				upsertArticle(art)
			}
		}
	})
} 

var upsertArticle = function (artSchema) {
	var article = artSchema
	articleModel.findOneAndUpdate({"url": article.url}, article, {upsert:true, new: true}, function(err, doc){
		if(err)
			console.log('upserting ERROR    :   ' + err)
		else {
			console.log('upserting OK')
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
			var article = new articleModel()
	        request(url, function(error, response, html){
            if(!error){
				console.log("URL ACESSADA: " + uri)
				article.url = uri;
                var $ = cheerio.load(html)

                var raw, md5
				
                $('#bodyContent').filter(function(){
                    var data = $(this)
                    raw = data.html()

                    var text = htmlToText.fromString(raw, {
                        wordwrap: 130
                    })        
					
					md5 = crypto.createHash('md5').update(text).digest("hex") 

                    article.raw = text
                    article.md5 = md5
                })

                $('#firstHeading').filter(function(){
                    var data = $(this)
                    article.title = data.text()
                })


                article.lastUpdated = new Date()
				urlOutdated(article.url, article)
				
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
