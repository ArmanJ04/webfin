const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const bcryptjs = require("bcryptjs");
const multer = require("multer");
const axios = require("axios");
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('views'));
app.use(session({
    secret: "YourSecretKey",
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    req.session.lang = req.query.lang || req.session.lang || 'en';
    res.locals.lang = req.session.lang; 
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect("mongodb+srv://Jansatov:jansatov04@cluster0.84lsw32.mongodb.net/myDatabase?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true });

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

const fruitSchema = new mongoose.Schema({
    names: {
        english: String,
        russian: String
    },
    descriptions: {
        english: String,
        russian: String
    },
    pictures: [String],
    nutrition: Object,
    recipe: Object,
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
    deletedAt: Date
});
const quizQuestionSchema = new mongoose.Schema({
    question: String,
    options: [String],
    correctAnswer: String
});

const QuizQuestion = mongoose.model("QuizQuestion", quizQuestionSchema);
async function generateQuestions() {
    try {
        const questions = await QuizQuestion.aggregate([{ $sample: { size: 5 } }]); 
        return questions;
    } catch (error) {
        console.log(error);
        return [];
    }
}
app.get("/quiz", async function(req, res) {
    const questions = await generateQuestions();
    res.render("quiz", { questions, lang: res.locals.lang });
});

app.post("/submit-quiz", async function(req, res) {
    const userAnswers = req.body;
    const questions = await generateQuestions();

    let score = 0;
    for (let i = 0; i < questions.length; i++) {
        const correctAnswer = questions[i].correctAnswer;
        const userAnswer = userAnswers[`answer-${i}`];

        if (userAnswer === correctAnswer) {
            score++;
        }
    }

    const totalQuestions = questions.length;
    res.send(`You scored ${score} out of ${totalQuestions}`);
});


const Fruit = mongoose.model("Fruit", fruitSchema);
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    next();
};
app.get("/", function(req, res) {
    res.render("login", { lang: res.locals.lang  }); 
});


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads'); 
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + '.jpg'); 
    }
});

const upload = multer({ storage: storage });

app.post("/login", async function (req, res) {
    const { username, password } = req.body;

    try {
        const adminUser = await User.findOne({ username: username, isAdmin: true });
        if (adminUser && bcryptjs.compareSync(password, adminUser.password)) {
            req.session.user = { username: adminUser.username, isAdmin: true };
            res.redirect("/admin");
            return;
        }

        const regularUser = await User.findOne({ username: username, isAdmin: false });
        if (regularUser && bcryptjs.compareSync(password, regularUser.password)) {
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

app.get("/register", function (req, res) {
    res.render("register", { lang: res.locals.lang  });
});

app.post("/register", async function (req, res) {
    try {
        const { name, username, password } = req.body;
        const hashedPassword = await bcryptjs.hash(password, 10);

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

app.get("/logout", function (req, res) {
    req.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect("/");
        }
    });
});

app.get("/admin", async function (req, res) {
    try {
        if (req.session.user && req.session.user.isAdmin) {
            const users = await User.find();
            const fruits = await Fruit.find({ deletedAt: { $exists: false } }).populate('recipe');
            res.render("admin", { username: req.session.user.username, users: users, user: req.session.user, fruits: fruits ,lang: res.locals.lang  });
        } else {
            res.send("Unauthorized access.");
        }
    } catch (error) {
        console.log(error);
        res.send("Error fetching users.");
    }
});

app.post("/admin/add-fruit", upload.array("pictures", 3), async function(req, res) {
    try {
        const { name } = req.body;
        const pictures = req.files.map(file => '/uploads/' + file.filename);
        const nutritionResponse = await axios.get(`https://www.fruityvice.com/api/fruit/${name}`);
        const nutrition = nutritionResponse.data;
        const recipeResponse = await axios.get(`https://recipe-by-api-ninjas.p.rapidapi.com/v1/recipe?query=${name}`, {
            headers: {
                'X-RapidAPI-Key': '12f3ff4359msh61eca82b12f2e53p1428c9jsn63f44706479e',
                'X-RapidAPI-Host': 'recipe-by-api-ninjas.p.rapidapi.com'
            }
        });
        const recipe = recipeResponse.data;

        const newFruit = new Fruit({
            names: { english: name, russian: "" },
            descriptions: { english: "", russian: "" },
            pictures: pictures,
            nutrition: nutrition,
            recipe: recipe
        });
        await newFruit.save();
        res.redirect("/admin");
    } catch (error) {
        console.log(error);
        res.send("Error adding fruit.");
    }
});

app.post("/admin/edit-fruit/:id", upload.array("pictures", 3), async function (req, res) {
    try {
        const { name } = req.body;
        const fruitId = req.params.id;
        let pictures = [];

        if (req.files) {
            pictures = req.files.map(file => '/uploads/' + file.filename);
        }

        const fruit = await Fruit.findById(fruitId);
        if (!fruit) {
            return res.send("Fruit not found.");
        }

        fruit.names.english = name;

        if (pictures.length > 0) {
            fruit.pictures = pictures;
        }

        await fruit.save();
        res.redirect("/admin");
    } catch (error) {
        console.log(error);
        res.send("Error editing fruit.");
    }
});

app.post("/admin/delete-fruit/:id", async function (req, res) {
    try {
        const fruitId = req.params.id;
        await Fruit.findByIdAndDelete(fruitId);
        res.redirect("/admin");
    } catch (error) {
        console.log(error);
        res.send("Error deleting fruit.");
    }
});

app.get("/main", requireLogin, async (req, res) => {
    try {
        const fruits = await Fruit.find({ deletedAt: { $exists: false } }).populate('recipe');
        res.render("main", { fruits, lang: res.locals.lang });
    } catch (error) {
        console.log(error);
        res.send("Error fetching fruits.");
    }
});

app.listen(3001, function () {
    console.log("Server is running on port 3001");
});
