/**
 * To run these tests in node execute the following command when in th modeljs directory:
 *     node ./test/modeljsNodeTests.js
 */
var ModelTests = require("./ModelTests.js");

(function (globalNS) {
    "use strict";

    function test (testName, testFn) {
        testFn.call(ModelTests);
    }

    console.log("Begin Tests");

        Object.keys(ModelTests.tests).forEach(function (key) {

            // noConflict test not applicable to node. filter it out.
            if (key === "testModelNoConflict") {
                return;
            }

            test(key, ModelTests.tests[key]);
        });

    // Node can't do asyncTests right now.
    /*
        Object.keys(ModelTests.asyncTests).forEach(function (key) {
            asyncTest(key, ModelTests.asyncTests[key]);
        });
    */

    console.log("End Tests");


}(this));




