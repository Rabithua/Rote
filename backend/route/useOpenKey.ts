import express from "express";
import { queryTypeCheck } from "../utils/main";
import { getOneOpenKey, createRote } from "../utils/dbMethods";

let useOpenKey = express.Router();

useOpenKey.get("/onerote", queryTypeCheck, (req, res) => {
  const { openkey, content, state, type, tag, pin } = req.query;

  if (!openkey || !content) {
    res.send({
      code: 1,
      msg: "error",
      data: "Need openkey and content!",
    });
    return;
  }

  const rote = {
    content,
    state: state || "private",
    type: type || "rote",
    tags: Array.isArray(tag) ? tag : tag ? [tag] : [],
    pin: !!pin,
  };

  getOneOpenKey(openkey.toString())
    .then(async (e) => {
      if (!e.permissions.includes("SENDROTE")) {
        res.send({
          code: 1,
          msg: "error",
          data: "OpenKey permission unmatch!",
        });
        return;
      }
      createRote({
        ...rote,
        authorid: e.userid,
      })
        .then(async (rote) => {
          res.send({
            code: 0,
            msg: "ok",
            data: rote,
          });
        })
        .catch(async (e) => {
          res.send({
            code: 1,
            msg: "error",
            data: e,
          });
        });
    })
    .catch(async (e) => {
      res.send({
        code: 1,
        msg: "error",
        data: e,
      });
    });
});

useOpenKey.post("/onerote", queryTypeCheck, (req, res) => {
  const { openkey, content, state, type, tags, pin } = req.body;

  if (!openkey || !content) {
    res.status(401).send({
      code: 1,
      msg: "error",
      data: "Need openkey and content!",
    });
    return;
  }

  const rote = {
    content,
    state: state || "private",
    type: type || "rote",
    tags: tags || [],
    pin: !!pin,
  };

  getOneOpenKey(openkey.toString())
    .then(async (e) => {
      if (!e.permissions.includes("SENDROTE")) {
        res.status(401).send({
          code: 1,
          msg: "error",
          data: "OpenKey permission unmatch!",
        });
        return;
      }
      createRote({
        ...rote,
        authorid: e.userid,
      })
        .then(async (rote) => {
          res.send({
            code: 0,
            msg: "ok",
            data: rote,
          });
        })
        .catch(async (e) => {
          res.status(401).send({
            code: 1,
            msg: "error",
            data: e,
          });
        });
    })
    .catch(async (e) => {
      res.status(401).send({
        code: 1,
        msg: "error",
        data: e,
      });
    });
});

export default useOpenKey;
