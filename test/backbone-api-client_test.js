// Load in test dependencies
var _ = require('underscore');
var Backbone = require('backbone');
var expect = require('chai').expect;
var BackboneApiClient = require('../');
var FakeGitHub = require('./utils/fake-github');
var githubUtils = require('./utils/github');

// Define some models/collections
var GithubModel = BackboneApiClient.mixinModel(Backbone.Model).extend({
  callApiClient: function (methodKey, options, cb) {
    // Prepare headers with data and send request
    var params = _.clone(options.data) || {};
    if (options.headers) {
      params.headers = options.headers;
    }
    var method = this.methodMap[methodKey];
    return this.apiClient[this.resourceName][method](params, cb);
  }
});
var GithubCollection = BackboneApiClient.mixinCollection(Backbone.Collection).extend({
  callApiClient: GithubModel.prototype.callApiClient
});
var UserModel = GithubModel.extend({
  // https://developer.github.com/v3/issues/comments/
  // http://mikedeboer.github.io/node-github/#user
  resourceName: 'user',
  idAttribute: 'login',
  methodMap: {
    read: 'get',
    update: 'update'
  },
});
var CommentModel = GithubModel.extend({
  // https://developer.github.com/v3/users/
  // http://mikedeboer.github.io/node-github/#issues.prototype.createComment
  resourceName: 'issues',
  methodMap: {
    create: 'createComment',
    'delete': 'deleteCommment'
  }
});
var IssueCollection = GithubCollection.extend({
  // https://developer.github.com/v3/issues/
  // http://mikedeboer.github.io/node-github/#issues.prototype.repoIssues
  resourceName: 'issues',
  methodMap: {
    read: 'repoIssues'
  }
});

// Define a set of utilities to instantiate new models easily
var apiModelUtils = {
  createUser: function () {
    before(function createUser () {
      // Generate our user
      this.user = new UserModel({login: 'twolfsontest'}, {
        apiClient: this.apiClient
      });
    });
    after(function cleanupUser () {
      delete this.user;
    });
  }
};

// Start the tests
describe('A BackboneApiClient-mixed model using GitHub\'s API client', function () {
  FakeGitHub.run();
  githubUtils.createClient();

  // Before we do any updates, reset the user data to a known state
  // DEV: This verifies that previous test runs do not affect the current one (and eight-track guarantees nobody is actively updating the content)
  before(function resetUserBio (done) {
    this.apiClient.user.update({
      bio: 'This is a test account'
    }, done);
  });

  // Test out `.fetch` functionality
  describe('fetching data', function () {
    apiModelUtils.createUser();
    before(function fetchUserData (done) {
      var that = this;
      this.user.fetch(done);
    });

    it('retrieves data from the API', function () {
      expect(this.user.attributes).to.have.property('bio', 'This is a test account');
    });
  });

  describe('updating data', function () {
    apiModelUtils.createUser();
    before(function fetchUserData (done) {
      var that = this;
      this.user.save({
        bio: 'Hello World'
      }, done);
    });

    it('updates API data', function () {
      expect(this.user.attributes).to.have.property('bio', 'Hello World');
    });
  });
});

describe('A model fetching from a downed server', function () {
  // Simulate a downed server (by not running FakeGitHub) and verify we get back errors
  githubUtils.createClient();
  apiModelUtils.createUser();
  before(function fetchUserData (done) {
    var that = this;
    this.user.fetch(function saveError (err, userModel, userInfo) {
      that.err = err;
      done();
    });
  });

  it('calls back with an error', function () {
    expect(this.err).to.have.property('message', 'connect ECONNREFUSED');
  });
});
// TODO: Test the entirety of methods (e.g. create, read, update, patch, delete)

// TODO: Test collections
