var express = require('express');
var router = express.Router();
var request = require('request');
var models = require('../models/accounts');
var services = require('../libs/services');
var config = require('../config/fbHatModels');
var appConfig = require('../config');

router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Welcome to HAT sync service HATTAR',
    stepInformation: 'Step 1 - Providing HAT details',
    hatPostLink: appConfig.appBaseUrl + '/hat' });
});

router.post('/hat', function (req, res, next) {

  // TODO: implement method to validate access token for given url
  if (req.body.hatAccessToken && req.body.hatUrl) {

    var query = { hatToken: req.body.hatAccessToken, hatBaseUrl: req.body.hatUrl };

    models.Accounts.findOneAndUpdate(query, {}, { new: true, upsert: true },
      function(err, account) {
        if (err) return res.render('error', { message: err });


        req.session.hatAccessToken = account.hatToken;
        req.session.hatUrl = account.hatBaseUrl;
        req.session.accountId = account._id;
        res.render('authorisation', {
          title: 'HAT sync service HATTAR',
          stepInformation: 'Step 2 - Authorise HATTER to access your Facebook data',
          facebookAppId: process.env.FB_APP_ID,
          redirectUri: appConfig.appBaseUrl + '/facebook',
          fbAccessScope: appConfig.fbAccessScope });

    });

  } else {
    res.send("Sorry, provided access token or hat url address are not valid. Please try again.");
  }

});

router.get('/facebook', function (req, res, next) {
  if (req.query.code) {

    var tokenRequestUrl = 'https://graph.facebook.com/v2.5/oauth/access_token?client_id=' +
      process.env.FB_APP_ID + '&redirect_uri=' + appConfig.appBaseUrl + '/facebook&client_secret=' +
      process.env.FB_APP_SECRET + '&code=' + req.query.code;

    request.get(tokenRequestUrl, function (err, response, body) {
        if (err) return res.send('Facebook authentication failed.');

        var parsedBody = JSON.parse(body);
        req.session.fbAccessToken = parsedBody.access_token;

        // Workaround for a bug in a session module
        req.session.save(function (err) {
          res.redirect('/facebook');
        });

    });

  } else if (true) {
    res.render('services', {
    title: 'HAT sync service HATTAR',
    stepInformation: 'Step 3 - Schedule record synchronisation',
    hatServicesLink: appConfig.appBaseUrl + '/services' });
  } else {
    res.send('Authentication with facebook failed. Please start again.');
  }

});

router.post('/services', function (req, res, next) {

  var dataSources = req.body.dataSources;
  if (typeof dataSources === 'string') dataSources = [dataSources];

  var numberOfDataSources = dataSources.length;
  var completed = 0;

  dataSources.forEach(function (dataSource) {
    services.findModelOrCreate(dataSource, 'facebook', req.session.hatUrl, req.session.hatAccessToken, config[dataSource], function (err, hatIdMapping) {

      console.log(hatIdMapping);

      var hatDataSource = {
        name: dataSource,
        source: 'facebook',
        sourceAccessToken: req.session.fbAccessToken,
        dataSourceModel: config[dataSource],
        hatIdMapping: hatIdMapping,
        lastUpdated: null
      };

      var dbEntry = new models.HatDataSource(hatDataSource);

      dbEntry.save(function (err, result) {
        if (err) return console.log(err);

        models.Accounts.findByIdAndUpdate(
          req.session.accountId,
          { $push: { 'dataSources': result._id } },
          { safe: true, upsert: true, new: true },
          function (err, newAccount) {

              completed++;
              services.addUpdateJob(dataSource, 'facebook', req.session.hatAccessToken, '2 minutes');

              if (completed >= numberOfDataSources) {
                res.send('Woopidy doo! Done');
              }
          });
        });
      });
    });
});

module.exports = router;
