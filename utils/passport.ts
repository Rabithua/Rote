// passportConfig.js

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
var crypto = require("crypto");
import { passportCheckUser } from ".././script";

// 初始化 Passport
passport.use(
  new LocalStrategy(async function (username, password, done) {
    console.log(username, password);
    let data = { username };
    let { user, err } = await passportCheckUser(data);
    if (err) {
      console.log(`查找用户时出现错误`);
      return done(err, false, {
        message: "error.",
      });
    }
    if (!user) {
      console.log(`用户${username}不存在`);
      return done(err, false, {
        message: "User not found.",
      });
    }
    console.log(user);
    // 对比hash
    crypto.pbkdf2(
      password,
      user.salt,
      310000,
      32,
      "sha256",
      function (err: any, hashedPassword: any) {
        console.log(`对比用户信息`, hashedPassword, err);
        if (err || !user) {
          console.log(`对比出现错误`, err);
          return done(err);
        }
        if (!crypto.timingSafeEqual(user?.passwordhash, hashedPassword)) {
          console.log(`未匹配`);
          return done(err, false, {
            message: "Incorrect username or password.",
          });
        }

        console.log(`匹配`);
        return done(err, user);
      }
    );
  })
);

passport.serializeUser((user: any, done) => {
  console.log(`user:${JSON.stringify(user)}`)
  return done(null, user.id)
})

passport.deserializeUser(function (user: any, done) {
  console.log(`user:${JSON.stringify(user)}`)
  return done(null, user)
});

export default passport;
