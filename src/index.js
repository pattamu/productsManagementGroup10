const express = require('express');
const bodyParser = require('body-Parser');
const mongoose = require('mongoose');
const multer = require('multer')

const route = require('./routers/routes.js')

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use( multer().any())

mongoose.connect("mongodb+srv://pattamu:bqPvauaKLfc6SIBP@cluster0.eqx53.mongodb.net/group10Database", {
    useNewUrlParser: true
})
    .then(() => console.log("MongoDb is connected"))
    .catch(err => console.log(err))

app.use('/', route);

app.listen(process.env.PORT || 3000, function (){
    console.log('Express app running on port: ' + (process.env.PORT || 3000))
});


