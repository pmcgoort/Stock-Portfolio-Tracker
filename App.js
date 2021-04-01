//require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')
const ejs = require('ejs')
const fetch = require("node-fetch");
mongoose.connect('mongodb+srv://pmcgoorty:KyHwSmTVTOcc7ZPU@cluster0.bnerd.mongodb.net/<dbname>?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(cors())

app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())


app.get('/input', function(req, res){
  updatePrices()
  res.sendFile(__dirname + '/views/input.html')
})


//stocks
var stockSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  shares: {
    type: Number,
    required: true
  }
})

var Stock = mongoose.model('Stock', stockSchema)

//function adds new stocks to portfolio
var updatePortfolio = (stock, done) => {
  Stock.findOne({username: stock.username, symbol: stock.symbol}, (err, foundData) => {
    //if stock symbol is not found in portfolio, it is added here
    if(foundData === null){
        stock.save((err, data) => {
        if(err){
          return console.error(err)
        }
        done(null, data)
      })
    } else if(err){
      done(err)
    } else {
      if(foundData.shares + stock.shares !== 0){
        //if stock is found, new shares are added
        Stock.updateOne({symbol: foundData.symbol}, {$set:{shares: foundData.shares + stock.shares}}, (err, update) =>{
          if(err) console.log(err)
          done(null, update)
          })
        } else {
          Stock.remove({symbol: foundData.symbol}, (err, remove) =>{
            if(err) console.log(err)
            done(null, remove)
          })
        }
    }
  })
}


//stock price lookup
var stockPriceSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  lookupDate: {
    type: String,
    required: true
  }
})

var StockPrice = mongoose.model('StockPrice', stockPriceSchema)

//function checks if stock is already in StockPrice DB
var stockPriceInDB = (symbol) =>{
  StockPrice.findOne({symbol: symbol}, (err, foundData) => {
    if(foundData === null){
      //api url
      var url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + symbol + '&apikey=PX8VTK8WLYV0G3TB'
      //get stock price
      fetch(url)
        .then(res => res.json())
        .then(json => {
          var price = json['Global Quote']['02. open']
          var date = json['Global Quote']['07. latest trading day']

            const newStockPrice = new StockPrice({symbol: symbol, price: price, lookupDate:date})
            newStockPrice.save((err, data) => {
            if(err){
              return console.error(err)
            }
          })

        })

    }
  })
}

//function updates stockPriceSchema
var updatePrices = () => {

  fetch('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=PX8VTK8WLYV0G3TB')
    .then(res => res.json())
    .then(json => {
      //this finds current date
      var curDate = json['Global Quote']['07. latest trading day']
      StockPrice.find({}, (err, data) => {
        for(let i in data){
          //updates price if stock price is not up to date
          if(data[i].lookupDate !== curDate){
            //api url
            var symbol = data[i].symbol
            var url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + symbol + '&apikey=PX8VTK8WLYV0G3TB'

            //get stock price
            fetch(url)
              .then(res => res.json())
              .then(json => {
                var price = json['Global Quote']['02. open']
                var date = json['Global Quote']['07. latest trading day']
                StockPrice.updateOne({symbol: data[i].symbol}, {$set:{price: price, lookupDate: date}}, (err, update) => {
                  if(err) console.log(err)
                })
              })
          }
        }
      })
    })

}



//add stock to db, goes here from input
app.post('/api/input', (req, res) => {
  const stock = new Stock({'username': req.body.username, 'symbol': req.body.symbol, 'shares': req.body.shares})
  updatePortfolio(stock, (err, data) => {
    if(err){
      res.send({error: 'Error'})
    }
  })

  if(req.body.shares > 0){
    var operator = 'added'
  } else if(req.body.shares < 0){
    var operator = 'subtracted'
  }

  stockPriceInDB(stock.symbol, (err, data) => {
    if(err){
      res.send({error: 'Error'})
    }
  })



  if(req.body.shares !== '0'){
    //sends stock info to screen
    res.send(Math.abs(req.body.shares) + ' shares of ' + req.body.symbol + ' were ' + operator + ' to ' + req.body.username + '\'s portfolio')
  } else {
    res.sendFile(__dirname + '/views/input.html')
  }
})


app.get('/portfolio', (req, res) => {
  Stock.find({username: req.query.usernamePortfolio}, (err, data) => {
    if(data === null){
      res.send('No data found')
    } else {
      let portfolio = []

      for(let i in data){
        portfolio.push([data[i].symbol, data[i].shares])
      }

      //add price to Portfolio
      for(let i = 0; i < portfolio.length; i++){
        StockPrice.find({symbol: portfolio[i][0]}, (err, priceData) => {
          portfolio[i].push(priceData[0].price)
          if(i === portfolio.length - 1){
            res.render(__dirname + '/views/portfolio.ejs', {portfolio: portfolio, username: req.query.usernamePortfolio})
          }
        })
      }
    }
  })
})




var port = 3002;
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})
