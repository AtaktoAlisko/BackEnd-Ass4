const express = require("express");
const path = require("path");
const routes = require("./routes/routes");
const PORT = 3000;
const app = express();

app.set("views", path.join(__dirname, "public"));
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/", routes);

app.listen(PORT, "0.0.0.0", function () {
    console.log("Server running on port: " + PORT);
});
