"use strict";

const express = require('express');
const router = express.Router();

const db = require('../services/db.service');
const helpers = require('../helpers');

router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, X-Auth-Token, Content-Type, Accept");
  next();
});

router.get('/token/status', helpers.authApplication, (req, res, next) => {
  db.getUser(req.hat.domain, (err, users) => {
    if (users.length === 0) {
      return res.status(404).json({ phata: req.hat.domain, error: "Token not found." });
    }

    let user = users[0];

    let permissionFound = user.permissions.find(permission => {
      return permission.permission === 'publish_actions' && permission.status === 'granted';
    });

    let response = {
      phata: req.hat.domain,
      expires: user.validUntil,
      canPost: !!permissionFound
    };

    return res.status(200).json(response);
  });
});

module.exports = router;
