/**
 * To run benchmark in node execute the following command when in th modeljs directory:
 *     npm run-script benchmark
 * Note: this file does contain some dependencies to other module run the command below to make sure you have them:
 *     npm install -d
 */
(function (globalNS) {
    "use strict";

    var Benchmark = require("benchmark");
    var assert = require("assert");
    var ModelTests = require("./../test/ModelTests");
    globalNS.Model = require("./../src/model");

    // make asserts global because the test were original writen for qunit in the browser
    // where the asserts were global. using assert from assert Module.
    globalNS.ok = assert.ok;
    globalNS.equal = assert.equal;
    globalNS.equals = assert.equals;
    globalNS.deepEqual = assert.deepEqual;
    globalNS.expect = function () {}; //stub out this method

    //var options = new Benchmark.options;

    globalNS.console.log("Benchmark Options:", Benchmark.options, "\n");
    var suite = new Benchmark.Suite("modeljs Tests Suite", Benchmark.options);
    var errors = false;

    globalNS.console.log("Begining Benchmark... ");

    globalNS.Model.async = false;
    Object.keys(ModelTests.tests).forEach(function (key) {
        // only benchmark non-async tests
        if (ModelTests.tests[key].isAsync !== true) {
            suite.add(key, ModelTests.tests[key]);
        }
    });

    suite.on('cycle', function(event) {
      globalNS.console.log(String(event.target));
    })
    .on('complete', function() {
      globalNS.console.log('Fastest is ' + this.filter('fastest').pluck('name'));
      globalNS.console.log('Slowest is ' + this.filter('slowest').pluck('name'));
    })
    .on('error', function (event) {
        errors = true;
        globalNS.console.log(" ### ERORR on", event.target.name);
    })
    .run({async: true});

    globalNS.console.log("Benchmark Complete");
    if (errors) {
        globalNS.console.log("");
        globalNS.console.log("### There was some errors.");
    }


}(GLOBAL));