test("testPrimitiveSaveLoad", function () {

    var jsonModel = { number: 1,
        str : "aString",
        bool : true,
        nil: null,
        undef: undefined
        };


    var m = new Model(jsonModel);

    ok(JSON.stringify(m.toJSON()) === JSON.stringify(jsonModel), "Passed");
});

test("testPrimitiveSetGet", function () {

    var jsonModel = { number: 1,
        str : "aString",
        bool : true,
        nil: null,
        undef: undefined
        };


    var m = new Model(jsonModel);
    ok(m.str() === jsonModel.str, "Passed");
    ok(m.number() === jsonModel.number, "Passed");
    m.str(1);
    m.number("aString");

    var jsonModelExpected = { number: "aString",
        str : 1,
        bool : true,
        nil: null,
        undef: undefined
        };

    ok(JSON.stringify(m.toJSON()) === JSON.stringify(jsonModelExpected), "Passed");
});

test("testObjectsSaveLoad", function () {
    var jsonModel = {   number: 1,
                        str : "aString",
                        subModel: {
                            str2: "string2"
                        }
                    };
    var m = new Model(jsonModel);
    ok(JSON.stringify(m.toJSON()) === JSON.stringify(jsonModel), "Passed");
});

test("testFunctionsSaveLoad", function () {

    var jsonModel = {   number: 1,
                        str : "aString",
                        x: function () {return "I am function x";},
                        subModel: {
                            str2: "string2",
                            f: function () {return "I am a function";}
                        }
                    };
    var jsonXReturnValue = jsonModel.x();
    var jsonFReturnValue = jsonModel.subModel.f();

    var m = new Model(jsonModel);
    var modelXReturnValue = m.x()();
    var modelFReturnValue = m.subModel().f()();
    ok(jsonXReturnValue === modelXReturnValue, "Passed");
    ok(jsonFReturnValue === modelFReturnValue, "Passed");

    var jsonFromModel = m.toJSON();

    ok(JSON.stringify(jsonFromModel) === JSON.stringify(jsonModel), "Passed");

});

test("testChangeListenerCallback", function () {
        var jsonModel = { number: 1,
        str : "aString",
        bool : true,
        nil: null,
        undef: undefined
        };

    var count = 0;
    var m = new Model(jsonModel);
    var f = function (oldValue, newValue) {
        count++;
    };
    m.number.onChange(f);
    m.number(2);
    m.number(3);
    m.number(3); // value is the same should not fire a change

    ok(count === 2, "Passed");

});


test("modelCreationFromScratch", function () {
    var expectedJSON = {
        x: 1,
        y: "y",
        obj: {
            desc: "a New point"
        }
    };

    var m = new Model();
    m.createProperty("x", 1);
    m.createProperty("y", "y");

    var subModel = new Model();
    subModel.createProperty("desc", "a New point");
    m.createProperty("obj", subModel);

    ok(JSON.stringify(m.toJSON()) === JSON.stringify(expectedJSON), "Passed");


});

test("testSuppressNotifications", function () {
        var jsonModel = {
            x: 1,
            y: "y",
            obj: {
                desc: "a New point"
            }
        };

    var m = new Model(jsonModel);
    var notified = false;
    var callback = function (oldValue, newValue) {
        notified = true;
    };

    m.x.onChange(callback);
    m.x(2);
    ok(notified, "Passed");
    notified = false;
    m.x(4, {suppressNotifications: true});
    ok(!notified, "Passed");
    ok(m.x() === 4, "Passed");
});

test("testPropertyValidationFunction", function () {

    var validateX = function (value){
        return value > 0;
    };
    var m = new Model();
    m.createProperty("x", 1, {validator: validateX});
    m.createProperty("y", "y");
    ok(m.x() === 1, "Passed");
    m.x(5);
    ok(m.x() === 5, "Passed");
    m.x(-1);
    ok(m.x() === 5, "Passed");

});


test("testSaveLoadWithMetaData", function () {

    var expectedJSON = {
        x: 1,
        x__modeljs__options: {
            validator: function (value){
                return value > 0;
            }
        }
    };

    var validateX = function (value){
        return value > 0;
    };

    var m = new Model();
    m.createProperty("x", 1, {validator: validateX});

    ok(JSON.stringify(m.toJSON(true)) === JSON.stringify(expectedJSON), "Passed");

    var m2 = new Model(expectedJSON);
    ok(JSON.stringify(m.toJSON(true)) === JSON.stringify(expectedJSON), "Passed");
});

test("testModelTransactions", function () {
    var jsonModel = { number: 1,
        str : "aString",
        bool : true,
        nil: null,
        undef: undefined
        };

    var callbackCalled = false;
    var count = 0;
    var callback = function (oldValue, newValue) {
        callbackCalled = true;
        count++;
    };

    var m = new Model(jsonModel);
    m.number.onChange(callback);
    m.bool.onChange(callback);
    Model.startTransaction();
    m.number(5);
    m.bool(true); //should not fire a onChange event since value not changes

    ok(!callbackCalled, "Passed");
    Model.endTransaction();
    ok(callbackCalled, "Passed");
});

test("testBubbleUpEvents", function () {
    var jsonModel = { number: 1,
        str : "aString",
        bool : true,
        nil: null,
        undef: undefined,
        subModel: {
            subProp: "I am the subProp"
        }
        };

    var callbackCalled = false;
    var count = 0;
    var callback = function (oldValue, newValue) {
        callbackCalled = true;
        count++;
    };

    var m = new Model(jsonModel);
    m.onChange(callback, {listenToChildren: true});
    m.number.onChange(callback);

    m.number(5);
    ok(callbackCalled, "Passed");

    ok(count===2, "Passed");
});