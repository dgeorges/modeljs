/**
 * To run these tests in node execute the following command when in th modeljs directory:
 *     npm test    or     node ./test/modeljsNodeTests.js
 *
 * Note this file depends on the 'qunitjs' module. Run the following command in the modeljs directory to
 * install the modeljs dev dependencies which include qunitjs.
 *     npm install -d
 */
(function runTests(global) {
    "use strict";

    function log() {
        global.console.log.apply(global, arguments);
    }

    // make Model global because test assume so.
    global.Model = require("./../src/model");
    var ModelTests = require("./ModelTests.js");
    var testrunner = require("qunitjs");

    // make asserts global because the test were original writen for qunit
    // in the browsers where the asserts were global
    global.ok = testrunner.ok;
    global.equal = testrunner.equal;
    global.equals = testrunner.equals;
    global.deepEqual = testrunner.deepEqual;
    global.expect = testrunner.expect;
    global.start = testrunner.start;


    var showPassingTests = false;
    var testCount = 0;


    // set up Test runner
    testrunner.module("modeljs Tests");


    // called whenever and assertion completes
    testrunner.log(function( details ) {
        if (showPassingTests && details.result) { // test passed
            log("  ", details.message, "PASSED");
        } else if (!details.result) { // test failed
            log("  ### ", details.message, "##", details);
        }
    });


    // Called when test Complete
    testrunner.testDone(function( details ) {
        testCount +=1;
        log(testCount + ".", details.name);
        log("       -", "(" + details.passed + "/" + details.total+ ")", "PASSED -", "\n");
    });



    // do work execute tests
    testrunner.module("modeljs Tests");
    Object.keys(ModelTests.tests).forEach(function (key) {
        var testFunction = ModelTests.tests[key];
        if (testFunction.isAsync) {
            testrunner.asyncTest(key, function () {
                testFunction();
                setTimeout(function() {
                    start();
                }, 1000);
            });
        } else {
            testrunner.test(key, testFunction);
        }
    });
    Object.keys(ModelTests.nodeOnlyTests).forEach(function (key) {
        var testFunction = ModelTests.nodeOnlyTests[key];
        if (testFunction.isAsync) {
            testrunner.asyncTest(key, function () {
                testFunction();
                setTimeout(function() {
                    start();
                }, 1000);
            });
        } else {
            testrunner.test(key, testFunction);
        }
    });



    // Called when test Suite Complete
    testrunner.moduleDone(function( details ) {
        // keep track of current progress
        //currentProgress = details;

        if (details.failed > 0) {
            log("### some tests FAILED ###", "\n", details);
        } else {
            log("### all tests PASSED ###", "\n", details);
        }
    });


}(GLOBAL));