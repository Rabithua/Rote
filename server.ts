import express = require("express");
import session from "express-session";
import passport from "./utils/passport";
import bodyParser from "body-parser";

// 引入路由
import routerV1 from "./route/v1";
import recoderIpAndTime from "./utils/recoder";

const app: express.Application = express();

// 配置会话
app.use(
  session({
    secret: "RoteByRabithua",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(recoderIpAndTime);
// 初始化 Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use("/v1/api", routerV1);

// 404
app.get("*", (req, res) => {
  res.status(404).send({
    code: 1,
    msg: "Page not found",
    data: null,
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Rote Node app listening on port ${process.env.PORT}!`);
});
