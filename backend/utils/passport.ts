// passportConfig.js

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { oneUser, passportCheckUser } from "./dbMethods";
import { sanitizeUserData } from "./main";
var crypto = require("crypto");

// 初始化 Passport
passport.use(
  new LocalStrategy(async function (username, password, done) {
    let data = { username };
    let { user, err } = await passportCheckUser(data);
    if (err) {
      return done(err, false, {
        message: "error.",
      });
    }
    if (!user) {
      return done(err, false, {
        message: "User not found.",
      });
    }
    // 对比hash
    crypto.pbkdf2(
      password,
      user.salt,
      310000,
      32,
      "sha256",
      function (err: any, hashedPassword: any) {
        if (err || !user) {
          return done(err);
        }
        console.log(
          Buffer.from(user?.passwordhash),
          hashedPassword,
          typeof user?.passwordhash,
          typeof hashedPassword
        );
        if (
          !crypto.timingSafeEqual(
            Buffer.from(user?.passwordhash),
            hashedPassword
          )
        ) {
          return done(err, false, {
            message: "Incorrect username or password.",
          });
        }

        return done(err, user);
      }
    );
  })
);

passport.serializeUser((user: any, done) => {
  return done(null, user.id);
});

passport.deserializeUser(async function (id: any, done) {
  let user = await oneUser(id);
  if (user) {
    return done(null, sanitizeUserData(user));
  } else {
    return done(new Error("No user with id found"));
  }
});

export default passport;
