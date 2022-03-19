const router = require("express").Router();
require('dotenv').config();
const passport = require("passport");
const ejs = require("ejs");
const bcrypt = require("bcrypt");
const mysql2 = require("mysql2");
const flash = require("express-flash");
const https = require("https");
const { response } = require("express");
const bodyParser = require("body-parser");
const { appendFile } = require("fs");
const fs = require('fs');
const fetch = require('node-fetch');
const path = require("path");
const database = require("../database");
const _ = require("lodash");
// const stream = require("stream");
// const JSONStream = require('JSONStream');
// const es = require('event-stream');
// const request = require('request');

router.use(bodyParser.urlencoded({ extended: true, limit: "100kb" }))

// ***************************************************************************************

// ***************************************************************************************


const con = mysql2.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

function isloggedin(req, res, next) {
    req.user ? next() : res.sendStatus(401);
}

database.query("use portfolio_manager");

// ****************************     GET ROUTES    ********************************************************
router.get("/", function (req, res) {
    res.render("home");
})

router.get("/login", function (req, res) {
    res.render("login");
})

router.get("/signup", function (req, res) {
    res.render("signup");
})

router.get("/auth/google",
    passport.authenticate("google", { scope: ["email", "profile"] })
)

router.get('/auth/facebook',
    passport.authenticate('facebook'));


router.get("/google/callback",
    passport.authenticate("google", {
        successRedirect: "/dashboard",
        failureRedirect: "/auth/failure",
    })
);

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/auth/failure' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/dashboard');
    });

router.get("/auth/failure", function (req, res) {
    res.send("Oops login failed");
})

router.get("/dashboard", isloggedin, function (req, res) {
    
    res.render("dashboard", {username: req.user.user_name});
});

router.get("/logout", function (req, res) {
    req.logOut();
    req.session.destroy();
    res.redirect("/");
});

router.get("/terms_and_conditions", function (req, res) {
    res.render("terms_and_conditions");
});

router.get("/liabilities", isloggedin, function(req, res){

    let sql = "SELECT * FROM ((liability_amounts a INNER JOIN liability_interests b ON a.user_id = b.user_id) INNER JOIN liability_interest_rates c ON a.user_id = c.user_id) WHERE a.user_id  = ?";

    database.query(sql, req.user.user_id,function(err, result, fields){
        
        if (err) throw err;
        res.render("liabilities", { liabilities: result, username: req.params.username});

    });
    
});
 
router.get("/liabilities/edit/:liability_type", isloggedin, function(req, res, next){

    let type = req.params.liability_type;
    let liability_type = _.snakeCase(_.lowerCase(type));
    let amount = liability_type+"_amount";
    let interest = liability_type+"_interest";
    let rate = liability_type+"_rate";

    let sql = "SELECT a."+amount+", b."+interest+", c."+rate+" FROM ((liability_amounts a INNER JOIN liability_interests b ON a.user_id = b.user_id) INNER JOIN liability_interest_rates c ON a.user_id = c.user_id) WHERE a.user_id = ?";

    database.query(sql, req.user.user_id, function(err, result){

        if(err) throw err;
        console.log(result);
        res.render("edit_liability", { liability_name: type, liability: result[0], amount: amount, rate: rate });

    });
    
});


// **************************** POST ROUTES *******************************************************
router.post("/login", passport.authenticate('local-signIn', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true
}),
    function (req, res) {
        // res.redirect("/complete");
    })


router.post("/signup", passport.authenticate('local-signup', {
    successRedirect: '/login',
    failureRedirect: '/signup',
    failureFlash: true
}),
    function (req, res) {
        console.log("i am signup page");
    }
)


router.post("/liabilities/edit/:liability_type", function(req, res){

    let type = req.params.liability_type;
    let liability_type = _.snakeCase(_.lowerCase(type));
    let amount = liability_type+"_amount";
    let interest = liability_type+"_interest";
    let rate = liability_type+"_rate";

    let r = req.body.interest_rate;
    let t = req.body.time_period;
    let p = req.body.amount;
    let int = ((p * r * t) / 100);

    let sql = "UPDATE liability_amounts a, liability_interests b, liability_interest_rates c SET a."+amount+" = ?, b."+interest+" = ?, c."+rate+" = ? WHERE a.user_id = b.user_id AND b.user_id = c.user_id AND a.user_id = ?";

    database.query(sql, [p, int, r, req.user.user_id], function(err, result){

        if (err) throw err;
        console.log(result);

    });

    res.redirect("/liabilities");
});


router.get("/stocks", async function (req, res) {
    let url_stocks = "https://api.twelvedata.com/stocks?apikey=" + process.env.API_KEY + "&country=usa";
    let url_time_series = "https://api.twelvedata.com/time_series?apikey=" + process.env.API_KEY + "&interval=1min&outputsize=1&symbol=";
    const list = [];
    async function getdata() {
        try {
            const data = await fetch(url_stocks);
            const obj_data = await data.json();
            const obj_array = obj_data.data;

            const stockprice = await fetch(url_time_series);
            // res.send(stockprice);
            // console.log(url_time_series);
            // res.send(url_time_series);
            let symbol, name, currency, exchange, country, type;
            let obj = {
                symbol: symbol,
                name: name,
                currency: currency,
                exchange: exchange,
                country: country,
                type: type
            }
            // add the whole data to list array 
            obj_array.forEach(company => {
                // res.write(company.symbol + "\t" + company.name + "\t" + company.currency + "\t" + company.exchange + "\t" + company.country + "\t" + company.type + "\n");
                let newobj = {
                symbol:  company.symbol,
                name:  company.name,
                currency:  company.currency,
                exchange:  company.exchange,
                country:  company.country,
                type:  company.type
                }
                list.push(newobj);
                // res.write(obj.symbol + " " + obj.name + "\n");
            });
            // res.send(list);
            // const filePath = path.join(__dirname , "../views/stocks.ejs"); 
            // const html = ejs.renderFile(filePath, {list} , {async: true}, function(err,data ){
            //     console.log(data);
            //     res.send(data);
            // })
            // console.log(html);
            // res.send(html);
            
        }catch (error) {
            console.log(error);
        }
    }
    getdata();
    // const html = ejs.renderFile("stocks.ejs", {list} , {async:true});
    // res.send(html);
    res.render("stocks", {list});


})

router.get("/test", function (req, res) {
    res.render("test.ejs", { name: "shadab" });
})


module.exports = router;