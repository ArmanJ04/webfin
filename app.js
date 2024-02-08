const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const request = require("request");
const https = require("https");
const path = require("path");

const app = express();
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'views')));
app.use(session({
    secret: "YourSecretKey",
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user;
    next();
});

mongoose.connect("mongodb+srv://Jansatov:jansatov04@cluster0.84lsw32.mongodb.net/?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    userID: String,
    name: String,
    username: String,
    password: String,
    creationDate: { type: Date, default: Date.now },
    updateDate: Date,
    deletionDate: Date,
    isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model("User", userSchema);

const weatherSchema = new mongoose.Schema({
    city: String,
    temperature: Number,
    feelsLike: Number,
    description: String,
    icon: String,
    humidity: Number,
    pressure: Number,
    windSpeed: Number,
    countryCode: String,
    rainVolume: Number,
    timezone: String,
    population: Number,
    isCapital: Boolean
});

const WeatherData = mongoose.model("WeatherData", weatherSchema);

app.get("/", function(req, res) {
    res.render("login.ejs");
});

app.post("/login", async function(req, res) {
    const { username, password } = req.body;

    try {
        const adminUser = await User.findOne({ username: username, isAdmin: true });
        if (adminUser && bcrypt.compareSync(password, adminUser.password)) {
            req.session.user = { username: adminUser.username, isAdmin: true }; 
            res.redirect("/admin"); 
            return;
        }
        
        const regularUser = await User.findOne({ username: username, isAdmin: false });
        if (regularUser && bcrypt.compareSync(password, regularUser.password)) {
            req.session.user = { username: regularUser.username, isAdmin: false }; 
            res.redirect("/main"); 
            return;
        }

        res.send("Incorrect username or password.");
    } catch (error) {
        console.log(error);
        res.send("Error finding user.");
    }
});

app.get("/main", async function(req, res) {
    try {
        const weatherData = await WeatherData.findOne().sort({$natural:-1}).limit(1); 
        const username = req.session.user ? req.session.user.username : null;
        res.render("main", { weatherData: weatherData, username: username });
    } catch (error) {
        console.log(error);
        res.send("Error fetching weather data.");
    }
});

app.get("/admin", async function(req, res) {
    try {
        if (req.session.user && req.session.user.isAdmin) {
            const users = await User.find();
            res.render("admin", { username: req.session.user.username, users: users, user: req.session.user });
        } else {
            res.send("Unauthorized access.");
        }
    } catch (error) {
        console.log(error);
        res.send("Error fetching users.");
    }
});


app.post("/admin/add", async function(req, res) {
    try {
        const { name, username, password, isAdmin } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const existingUser = await User.findOne({ username: username });
        if (existingUser) {
            return res.send("Username already taken. Please choose another one.");
        }
        
        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword,
            isAdmin: isAdmin || false
        });
        await newUser.save();        
        res.redirect("/admin"); 
    } catch (error) {
        console.log(error);
        res.send("Error adding user.");
    }
});

app.get("/admin/edit/:username", async function(req, res) {
    try {
        if (req.session.user && req.session.user.isAdmin) {
            const username = req.params.username; 
            const user = await User.findOne({ username: username });
            if (user) {
                const users = await User.find(); // Fetch all users
                res.render("admin", { 
                    username: req.session.user.username, 
                    user: user,  // Pass the user data
                    users: users 
                });
            } else {
                res.send("User not found.");
            }
        } else {
            res.send("Unauthorized access.");
        }
    } catch (error) {
        console.log(error);
        res.send("Error rendering edit page.");
    }
});

app.post("/admin/edit/:username", async function(req, res) {
    try {
        const { name, username, password, isAdmin } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const editUsername = req.params.username;
        const user = await User.findOne({ username: editUsername });
        if (!user) {
            return res.send("User not found.");
        }

        user.name = name;
        user.username = username;
        user.password = hashedPassword;
        user.updateDate = new Date(); 
        user.isAdmin = isAdmin || false;
        await user.save();

        res.redirect("/admin");
    } catch (error) {
        console.log(error);
        res.send("Error editing user.");
    }
});

app.post("/admin/delete/:username", async function(req, res) {
    try {
        const username = req.params.username;
        await User.findOneAndDelete({ username: username });
        res.redirect("/admin");
    } catch (error) {
        console.log(error);
        res.send("Error deleting user.");
    }
});


app.get("/register", function(req, res) {
    res.render("register");
});

app.post("/register", async function(req, res) {
    try {
        const { name, username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const existingUser = await User.findOne({ username: username });
        if (existingUser) {
            return res.send("Username already taken. Please choose another one.");
        }
        
        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });
        await newUser.save();        
        req.session.user = newUser;
        res.redirect("/main"); 
    } catch (error) {
        console.log(error);
        res.send("Error registering user.");
    }
});

app.post("/main", async function(req, res) {
    const city = req.body.city;
    const openWeatherMapApiKey = "1440a81f89afb0a2eda2045fd09454fb";
    const ciApiKey = 'FJiT4b3NW8ar50vc8bKGmg==HE78LsXRHeCE4WgM';

    const openWeatherMapUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${openWeatherMapApiKey}&units=metric`;

    try {
        const weatherData = await new Promise((resolve, reject) => {
            request(openWeatherMapUrl, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    const parsedBody = JSON.parse(body);
                    resolve(parsedBody);
                } else {
                    reject(error || "Error fetching weather data.");
                }
            });
        });

        const cityApiUrl = `https://api.api-ninjas.com/v1/city?name=${city}`;
        request({
            url: cityApiUrl,
            headers: {
                'X-Api-Key': ciApiKey,
            },
        }, async function(cityError, cityResponse, cityBody) {
            if (cityError) {
                console.error("Error fetching city data:", cityError.message);
                return res.status(500).send("Error fetching city data");
            }

            try {
                const cityInfo = JSON.parse(cityBody);
                const population = cityInfo[0].population;
                const isCapital = cityInfo[0].is_capital;

                const newWeatherData = new WeatherData({
                    city: city,
                    temperature: weatherData.main.temp,
                    feelsLike: weatherData.main.feels_like,
                    description: weatherData.weather[0].description,
                    icon: weatherData.weather[0].icon,
                    humidity: weatherData.main.humidity,
                    pressure: weatherData.main.pressure,
                    windSpeed: weatherData.wind.speed,
                    countryCode: weatherData.sys.country,
                    rainVolume: weatherData.rain ? weatherData.rain["1h"] || 0 : 0,
                    timezone: weatherData.timezone,
                    population: population,
                    isCapital: isCapital
                });

                await newWeatherData.save(); 
                res.redirect("/main");
            } catch (error) {
                console.error("Error parsing city data:", error.message);
                res.status(500).send("Error parsing city data");
            }
        });

    } catch (error) {
        console.log("Error fetching weather data:", error);
        res.send("Error fetching weather data.");
    }
});

app.get("/logout", function(req, res) {
    req.session.destroy(function(err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    });
});

app.listen(3001, function() {
    console.log("Server is running on port 3001");
});

async function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, function(response) {
            let data = "";
            response.on("data", function(chunk) {
                data += chunk;
            });
            response.on("end", function() {
                const parsedData = JSON.parse(data);
                resolve(parsedData);
            });
        }).on("error", function(error) {
            reject(error);
        });
    });
}
