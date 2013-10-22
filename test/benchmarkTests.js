/**
 * To run benchmark in node execute the following command when in th modeljs directory:
 *     npm run-script benchmark
 * Note: this file does contain some dependencies to other module run the command below to make sure you have them:
 *     npm install -d
 */
(function (globalNS) {
    "use strict";

    var Benchmark = require("benchmark");
    var Model = require("./../src/model");


    //var options = new Benchmark.options;

    globalNS.console.log("Benchmark Options:", Benchmark.options, "\n");
    var suite = new Benchmark.Suite("modeljs Benchmark Suite", Benchmark.options);
    var errors = false;

    globalNS.console.log("Begining Benchmark... ");

    suite.add("Model Creation", function () {
        var model = new Model({
            number: 1,
            str: "test"
        });
    });

    suite.on('cycle', function(event) {
        globalNS.console.log(String(event.target));
    })
    .on('complete', function() {
        globalNS.console.log("Benchmark Complete");
        globalNS.console.log('Fastest is ' + this.filter('fastest').pluck('name'));
        globalNS.console.log('Slowest is ' + this.filter('slowest').pluck('name'));
    })
    .on('error', function (event) {
        errors = true;
        globalNS.console.log(" ### ERORR on", event.target.name);
    })
    .run({async: true});


    if (errors) {
        globalNS.console.log("");
        globalNS.console.log("### There was some errors.");
    }

}(GLOBAL));