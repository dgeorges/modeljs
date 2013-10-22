    var testrunner = require("qunit");
    // set up Test runner
    //testrunner.module("modeljs Tests");
    testrunner.run({code:"./src/model", tests:"./test/ModelTests.js"});