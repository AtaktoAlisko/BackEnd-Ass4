const express = require("express");
const axios = require("axios");
const path = require("path");
const { client, connectToDatabase } = require("../db/db.js");
const API_KEY = "94b07001ec1f4be8df8aa962a94b7dad";
const router = express.Router();
router.use(express.json());
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const session = require("express-session");
let history = [];
router.use(
    session({
        secret: "your secret key",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
    })
);

router.get("/history", function (req, res) {
    const isAuthenticated = !!req.session.user;
    if (isAuthenticated) {
        res.render("history", { history: history });
    } else {
        res.redirect("/login");
    }
});

const translations = {
    "Select city": {
        en: "Select city",
        ru: "Выберите город",
        kk: "Қала таңдаңыз",
    },
    Pressure: {
        en: "Pressure",
        ru: "Давление",
        kk: "Қысым",
    },
    Temperature: {
        en: "Temperature",
        ru: "Температура",
        kk: "Температура",
    },
    Humidity: {
        en: "Humidity",
        ru: "Влажность",
        kk: "Ылғалдылық",
    },
    "Wind Speed": {
        en: "Wind Speed",
        ru: "Скорость ветра",
        kk: "Жел асы",
    },
};

router.use(
    session({
        secret: "my_secret_key", // Секретный ключ для подписи сессионных куки
        resave: true,
        saveUninitialized: true,
        cookie: {
            secure: false, // Временно установите в false для отладки на локальном сервере
        },
    })
);

router.get("/admin", async (req, res) => {
    try {
        await connectToDatabase();
        const users = await client.db("users").collection("users").find().toArray();
        res.render(path.join(__dirname, "..", "public", "admin.ejs"), { users: users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/admin/create", async (req, res) => {
    try {
        await connectToDatabase();
        const { username, email, password } = req.body;

        // Check if password is provided
        if (!password) {
            return res.status(400).send("Password is required");
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        await client
            .db("users")
            .collection("users")
            .insertOne({
                username,
                email,
                password: hashedPassword,
                isAdmin: req.body.isAdmin === "true", // Assuming isAdmin is sent from frontend
            });
        res.redirect("/admin");
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).send("Internal Server Error");
    }
});
router.post("/admin/makeAdmin/:userId", async (req, res) => {
    try {
        await connectToDatabase();
        const { userId } = req.params;
        await client
            .db("users")
            .collection("users")
            .updateOne({ _id: new ObjectId(userId) }, { $set: { isAdmin: true } });
        res.redirect("/admin");
    } catch (error) {
        console.error("Error making user admin:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/admin/update/:id", async (req, res) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        const { username, email, password } = req.body;

        // Check if password is provided
        let hashedPassword;
        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        const updateFields = { username, email };
        if (hashedPassword) {
            updateFields.password = hashedPassword;
        }

        await client
            .db("users")
            .collection("users")
            .updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        res.redirect("/admin");
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.post("/admin/delete/:id", async (req, res) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        await client
            .db("users")
            .collection("users")
            .deleteOne({ _id: new ObjectId(id) });
        res.redirect("/admin");
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send("Internal Server Error");
    }
});

router.get("/signup", function (req, res) {
    res.render(path.join(__dirname, "..", "public", "signup.ejs"));
});

router.get("/login", function (req, res) {
    res.render(path.join(__dirname, "..", "public", "login")); // Используйте res.render вместо res.sendFile
});

router.get("/", async (req, res) => {
    const isAuthenticated = !!req.session.user;
    await connectToDatabase();
    let exchanges = [];

    try {
        exchanges = (await client.db("users").collection("exchanges").find({ deleted_at: null }).toArray()) ?? [];
    } catch (err) {
        console.log("Error fetching exchanges:", err);
    }

    exchanges = JSON.parse(JSON.stringify(exchanges));

    res.render("index", { translations: JSON.stringify(translations), isAuthenticated: isAuthenticated, history: history, exchanges: exchanges });
});

router.get("/ping", function (req, res) {
    res.status(200);
    res.send("pong");
});

router.get("/wallet/:address", function (req, res) {
    const address = req.params.address;
    const url = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/full?limit=5`;

    axios
        .get(url)
        .then((response) => {
            res.status(200).json(response.data);
        })
        .catch((error) => {
            if (error.response) {
                res.status(error.response.status).send(error.response.data);
            } else if (error.request) {
                res.status(500).send({ message: "No response received from the balance service" });
            } else {
                res.status(500).send({ message: "Error in making request to the balance service" });
            }
        });
});

router.get("/BTC", function (req, res) {
    const isAuthenticated = !!req.session.user;
    res.render("btc", { isAuthenticated });
});

router.get("/BTC/price", function (req, res) {
    const url = "https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD";

    axios
        .get(url)
        .then((response) => {
            res.status(200).json(response.data);
        })
        .catch((error) => {
            if (error.response) {
                res.status(error.response.status).send(error.response.data);
            } else if (error.request) {
                res.status(500).send({ message: "No response received from the BTC price service" });
            } else {
                res.status(500).send({ message: "Error in making request to the BTC price service" });
            }
        });
});
router.post("/signup", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Проверяем, что все данные присутствуют
        if (!username || !email || !password) {
            return res.status(400).send({ success: false, message: "Missing required fields" });
        }

        // Подключаемся к базе данных
        await connectToDatabase();

        const hashedPassword = await bcrypt.hash(password, 10);

        // Выполняем операцию добавления пользователя в коллекцию users
        await client.db("users").collection("users").insertOne({
            username,
            email,
            password: hashedPassword,
            isAdmin: false,
        });

        res.status(200).send({ success: true, redirectUrl: "/login" });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).send({ success: false, message: "Error registering user" });
    }
});

router.get("/logout", function (req, res) {
    delete req.session.user;
    req.session.destroy(function (err) {
        if (err) {
            console.error("Error logging out:", err);
            res.status(500).send("Internal Server Error");
        } else {
            res.redirect("/login");
        }
    });
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        await connectToDatabase();
        const user = await client.db("users").collection("users").findOne({ username });

        if (!user) {
            return res.status(401).send({ success: false, message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            req.session.user = user;
            return res.status(200).send({ success: true, redirectUrl: user.isAdmin ? "/admin" : "/" });
        } else {
            return res.status(401).send({ success: false, message: "Incorrect password" });
        }
    } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(500).send({ success: false, message: "Internal Server Error" });
    }
});

router.get("/auth/status", async (req, res) => {
    try {
        await connectToDatabase();
        const user = await client.db("users").collection("users").findOne({ ip: req.ip });
        if (user) {
            res.send({ isAuthenticated: true, username: user.username });
        } else {
            res.send({ isAuthenticated: false });
        }
    } catch (error) {
        console.error("Error checking authentication status:", error);
        res.status(500).send({ isAuthenticated: false });
    }
});

router.get("/admin/exchanges", async (req, res) => {
    try {
        await connectToDatabase();
        const exchanges = await client.db("users").collection("exchanges").find({ deleted_at: null }).toArray();
        const user = req.session.user;

        if (!user) {
            return res.status(401).send("Unauthorized");
        }

        return res.render("exchanges", { exchanges: exchanges ?? [], isAuthenticated: true, user, username: user?.username });
    } catch (err) {
        console.log("Error fetching exchanges:", err);
        return res.status(500).send("Internal Server Error");
    }
});

router.post("/admin/exchange/add", async (req, res) => {
    try {
        await connectToDatabase();
        const { name, name_ru, description, description_ru, links } = req.body;
        const linksSave = links ? links.split(",").map((link) => link.trim()) : [];
        const user = req.session.user;

        if (!user) {
            return res.status(401).send("Unauthorized");
        }

        await client.db("users").collection("exchanges").insertOne({
            name,
            name_ru,
            description,
            description_ru,
            links: linksSave,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
        });
        res.redirect("/admin/exchanges");
    } catch (err) {
        console.log("Error adding exchange:", err);
        return res.status(500).send("Internal Server Error");
    }
});

router.get("/admin/exchanges/delete/:id", async (req, res) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        const user = req.session.user;

        if (!user) {
            return res.status(401).send("Unauthorized");
        }

        await client
            .db("users")
            .collection("exchanges")
            .deleteOne({ _id: new ObjectId(id) });
        res.redirect("/admin/exchanges");
    } catch (err) {
        console.log("Error deleting exchange:", err);
        return res.status(500).send("Internal Server Error");
    }
});

router.get("/admin/exchanges/edit/:id", async (req, res) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        const user = req.session.user;

        if (!user) {
            return res.status(401).send("Unauthorized");
        }

        const exchange = await client
            .db("users")
            .collection("exchanges")
            .findOne({ _id: new ObjectId(id) });
        res.render("editExchange", { exchange, isAuthenticated: true, user, username: user?.username });
    } catch (err) {
        console.log("Error fetching exchange:", err);
        return res.status(500).send("Internal Server Error");
    }
});

router.post("/admin/exchange/edit/:id", async (req, res) => {
    try {
        await connectToDatabase();
        const { id } = req.params;
        const { name, name_ru, description, description_ru, links } = req.body;
        const linksSave = links ? links.split(",").map((link) => link.trim()) : [];
        const user = req.session.user;

        if (!user) {
            return res.status(401).send("Unauthorized");
        }

        await client
            .db("users")
            .collection("exchanges")
            .updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        name,
                        name_ru,
                        description,
                        description_ru,
                        links: linksSave,
                        updated_at: new Date(),
                    },
                }
            );
        res.redirect("/admin/exchanges");
    } catch (err) {
        console.log("Error updating exchange:", err);
        return res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
