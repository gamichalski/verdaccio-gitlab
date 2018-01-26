// Copyright 2018 Roger Meier <roger@bufferoverflow.ch>
// SPDX-License-Identifier: MIT

var httperror = require('http-errors');
var axios = require('axios');

function Auth(config, stuff) {
  
  var self = Object.create(Auth.prototype);
  self._users = {};
  self._config = config;
  self._logger = stuff.logger;
  return self;
}

module.exports = Auth;

Auth.prototype.authenticate = function(user, password, cb) {
  axios.post(`${this._config.url}/oauth/token`, {
    "grant_type": "password",
    "username": user,
    "password": password
  })
  .then((response) => {
    console.log(response.data)
    var GitlabAPI = require('node-gitlab-api')({
      url: this._config.url,
      oauthToken: response.data.access_token
    });

    GitlabAPI.users.current().then((response) => {
      if (user !== response.username) return cb(httperror[403]('wrong gitlab username'));
      var ownedGroups = [user];
      GitlabAPI.groups.all({'owned': 'true'}).then((groups) => {
        groups.forEach(function(item) {
          if (item.path === item.full_path) { // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
            ownedGroups.push(item.path);
          }
        });
        cb(null, ownedGroups);
      });
    }).
    catch(error => {
      if (error) return cb('Personal access token invalid');
    });
  })
  .catch(function (error) {
    if (error) return cb('Personal access token invalid');
  });
};

Auth.prototype.adduser = function(user, password, cb) {
  cb(null, false);
};
Auth.prototype.allow_access = function(user, _package, cb) { // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
  if (_package.gitlab) {
    if (_package.access.includes('$authenticated') && user.name !== undefined) {
      return cb(null, true);
    } else {
      return cb(null, false);
    }
  }
};

Auth.prototype.allow_publish = function(user, _package, cb) { // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
  if (_package.gitlab) {
    var packageScopeOwner = false;
    var packageOwner = false;

    user.real_groups.forEach(function(item) { // jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
      if (item === _package.name) {
        packageOwner = true;
        return false;
      } else {
        if (_package.name.indexOf('@') === 0) {
          if (item === _package.name.slice(1, _package.name.lastIndexOf('/'))) {
            packageScopeOwner = true;
            return false;
          }
        }
      }
    });

    if (packageOwner === true) {
      return cb(null, false);
    } else {
      if (packageScopeOwner === true) {
        return cb(null, false);
      } else {
        if (_package.name.indexOf('@') === 0) {
          return cb(httperror[403]('must be owner of package-scope'));
        } else {
          return cb(httperror[403]('must be owner of package-name'));
        }
      }
    }
  }
};
