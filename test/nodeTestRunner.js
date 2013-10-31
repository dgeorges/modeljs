// usage: npm -run-script test or node ./test/nodeTestRunner.js
var testrunner = require("qunit");
// set up Test runner
//testrunner.options.coverage = true;
testrunner.run({code:"./src/model", tests:"./test/ModelTests.js"});