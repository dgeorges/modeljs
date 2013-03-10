/**
 * A module that exports all modeljs test. The exported object has the following properties:
 *   tests - a map of testName to testFunction for test that are enviornment independent
 *   browserOnlyTests - a map of testName to testFunction for test that are only for the browser
 *   nodeOnlyTests - a map of testName to testFunction for test that are only for node
 *
 * Test are written for qunit and assume the assert function (ok, equal, equals, deepEqual) are
 * defined in the global name space, along with Model.
 * For example usage of running these tests see ModelTests.html or modeljsNodeTest.html
 *
 * If the test function has the isAsync flag set it is an asynchronous test
 *
 */

(function (globalNS) { //globalNS === window in the browser or GLOBAL in nodejs
    "use strict";

    var ModelTests = {};
    ModelTests.tests = {
        testPrimitiveSaveLoad : function () {
            expect(1);
            var jsonModel = { number: 1,
                str : "aString",
                bool : true,
                nil: null,
                undef: undefined,
                fun: function () {return true;}
            };
            var m = new Model(jsonModel);

            deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(jsonModel), "Model From JSON and back equal");
        },

        testObjectsSaveLoad : function () {
            expect(1);
            var jsonModel = {   number: 1,
                                str : "aString",
                                subModel: {
                                    str2: "string2"
                                }
                            };
            var m = new Model(jsonModel);
            deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(jsonModel));
        },

        testComplexSaveLoad : function () {
            expect(3);
            var jsonModel = {   number: 1,
                                str : "aString",
                                x: function () {return "I am function x";},
                                subModel: {
                                    str2: "string2",
                                    f: function () {return "I am a function";}
                                }
                            };
            var jsonXValue = jsonModel.x(),
                jsonFValue = jsonModel.subModel.f();

            var m = new Model(jsonModel);
            var modelXValue = m.x.getValue()(),
                modelFValue = m.subModel.f.getValue()();

            equal(jsonXValue, modelXValue, "Function preserved From JSON To Model");
            equal(jsonFValue, modelFValue, "Function preserved From JSON To Model");

            var jsonFromModel = m.toJSON();

            deepEqual(JSON.stringify(jsonFromModel), JSON.stringify(jsonModel), "Complex Model From JSON and back equal");

        },

        testPrimitiveSetGet : function () {
            expect(3);
            var jsonModel = { number: 1,
                str : "aString",
                bool : true,
                nil: null,
                undef: undefined
            };

            var m = new Model(jsonModel);
            equal(m.str.getValue(), jsonModel.str, "retrieving simple Model values are correct");
            equal(m.number.getValue(), jsonModel.number, "retrieving simple Model values are correct");
            // change some values
            m.str.setValue(1);
            m.number.setValue("aString");
            m.bool.setValue(false); // use the setValue method.
            var jsonModelExpected = { number: "aString",
                str : 1,
                bool : false,
                nil: null,
                undef: undefined
            };

            deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(jsonModelExpected), "toJSON method work after model modification");
        },

        testGetNameMethod : function () {
            expect(8);
            var jsonModel = {   number: 1,
                                str : "aString",
                                x: function () {return "I am function x";},
                                subModel: {
                                    str2: "string2",
                                    f: function () {return "I am a function";}
                                }
                            };
            var m = new Model(jsonModel);
            equal(m.getName(), "/root");
            equal(m.str.getName(), "/root/str");
            equal(m.subModel.getName(), "/root/subModel");
            equal(m.subModel.f.getName(), "/root/subModel/f");

            // passing in a name to our model changes the default of root.
            var m2 = new Model(jsonModel, {name: "test"});
            equal(m2.getName(), "/test");
            equal(m2.str.getName(), "/test/str");
            equal(m2.subModel.getName(), "/test/subModel");
            equal(m2.subModel.f.getName(), "/test/subModel/f");
        },

        testOnChangeCallbackWhenSettingToSameValue : function () {
            expect(2);
            var jsonModel = { number: 1,
                str : "aString",
                bool : true,
                nil: null,
                undef: undefined
            };

            var count = 0;
            var m = new Model(jsonModel);
            var f = function (property, oldValue) {
                count++;
                ok(true, "change callback should be hit twice. Once for each time the value actually changed");
            };
            m.number.onChange(f);
            m.number.setValue(2);
            m.number.setValue(3);
            m.number.setValue(3); // value is the same should not fire a change
        },

        testModelCreationUsingCreatePropertyMethod : function () {
            expect(5);
            var expectedJSON = {
                x: 1,
                y: "y",
                obj: {
                    desc: "an obj property name desc"
                },
                obj2: {
                    desc: "This is obj2"
                },
                positiveNumber: 2
            };

            // use method chaining to create 2 simple properties
            var m = new Model();
            m.createProperty("x", 1)
             .createProperty("y", "y");

            var subModel = new Model();
            subModel.createProperty("desc", "an obj property name desc");

            // Do not directly assign properties like this use createProperty.
            m.obj = subModel;
            equal(m.obj.getName(), "/root", "assigning property directly like this results in incorrect property name");
            equal(m.obj._parent, null, "assigning property directly like this results in incorrect parent");
            delete m.obj;

            // Correct way to create a Model sub object
            m.createProperty("obj", {desc: "an obj property name desc123"});
            m.obj.setValue(subModel.getValue());
            // Alternative is to create an empty Object and use setValue to set it
            m.createProperty("obj2", {});
            m.obj2.setValue({
                desc: "This is obj2"
            });

            //createProperty also takes a validator
            m.createProperty("positiveNumber", 2, { // a property with a validator (model.positiveNumber)
                validator: function (value) {
                    return value > 0;
                }
            });
            ok(m.positiveNumber.hasValidator(), "'positiveNumber' property was created with a validator");
            ok (!m.positiveNumber.validateValue(-1), "'positiveNumber' property validator works");
            equal(JSON.stringify(m.toJSON()), JSON.stringify(expectedJSON), "Model Creation from api generates correct JSON");
        },

        testPropertyDestroyMethod : function() {
            expect(7);
            var jsonModel = {
                number: 1,
                str : "aString",
                x: function () {return "I am function x";},
                subModel: {
                    str2: "string2",
                    f: function () {return "I am a function";}
                },
                arr: [1,2,3]
            };

            var deleteCallbackCalled = false;
            function deleteCallback(property) {
                deleteCallbackCalled = true;
                ok(deleteCallbackCalled, "destroy callback called, 3 times");
            }

            var model = new Model(jsonModel);
            ok(model.number);
            model.number.onDestroy(deleteCallback);
            model.number.destroy();
            ok(!model.number, "number Property no longer exists it was destroyed");

            deleteCallbackCalled = false;
            model.subModel.str2.onDestroy(deleteCallback);
            model.subModel.destroy();
            ok(!model.subModel, "SubModel Property no longer exists it was destroyed");

            deleteCallbackCalled = false;
            model.arr[1].onDestroy(deleteCallback);
            model.arr.destroy();
            ok(!model.arr, "Array Property no longer exists it was destroyed");

        },

        testModelMergeMethod : function () {
            expect(11);
            var modelJSON = {
                x: 1,
                y: "y",
                obj: {

                    desc: "an obj property name desc"
                },
                obj2: {
                    key1: "key1",
                    key2: "key2",
                    subModel : {v1: "value1", v2: "value2"},
                    aArray: [1,2, 3, 8 , 5]
                }
            };

            var mergeObj = {
                key1: "new key1Value",
                key3: "new key",
                aArray: [1,4]
            };


            function callback (property, arg) {
                // should be called 4 times
                ok (true, "new property added1");
            }
            function callback1 (property, arg) {
                // should be called once
                ok (true, "new property added2");
            }

            var m = new Model(modelJSON);
            m.obj2.key2.onDestroy(callback); // 1 callback
            m.obj2.on("childCreated childDestroyed", callback); // 3 callbacks

            m.obj2.merge(mergeObj);//keepOldProperties = false
            ok (!m.obj2.key2, "old properties removed");
            equal (m.obj2.key1.getValue(), "new key1Value", "existing property overridden");
            equal (m.obj2.key3.getValue(), "new key", "new property added");
            //equal (callbackCount, 4, "new property added");

            var m1 = new Model(modelJSON);
            m1.obj2.key2.onDestroy(callback1);
            m1.obj2.on("childCreated childDestroyed", callback1); //1 callback for create

            m1.obj2.merge(mergeObj, true); // keepAllProperties = true
            equal (m1.obj2.key2.getValue(), "key2", "old properties remain");
            equal (m1.obj2.key1.getValue(), "new key1Value", "existing property overridden");
            equal (m1.obj2.key3.getValue(), "new key", "new property added");

        },

        testComplexChangePropertyValue : function () {
            expect(2);
            var json = {
                x: 1,
                y: "y",
                property: "This is not obj1",
                model: {
                    key1: "key1",
                    key2: "key2",
                    subModel : {v1: "value1", v2: "value2"}
                }
            };
            var expectedJSON = {
                x: 1,
                y: "y",
                property: "This is not obj1",
                model: {
                    key1: "this is key1's new value",
                    key3: "we have added a key"
                }
            };

            var m = new Model(json);

            //setting a property to a model should fail.
            m.property.setValue({prop: "this is an obj property", prop2: "this is prop2"});

            //setting a model to a property should fail
            m.model.setValue("new string property");

            // setting a property to an object indirectly should fail
            m.model.setValue({  key1: "This should not be set",
                                key2: {
                                    prop1:"this is an Object",
                                    prop2: "this should fail, since setting key2 to an object"
                                }
                            });

            // setting a model to an property indirectly should fail
            m.model.setValue({
                key1: "this should not be set",
                subModel: "setting a model to a property should fail"
            });

            if (Model.enableLogging){
                console.log("testComplexChangePropertyValue: 4 errors to console expected");
            }

        /* Note commented out code is not detected but also incorrect. see testModelCreationUsingCreatePropertyMethod
            var subModel = new Model();
            subModel.createProperty("desc", "This is obj1");
            m.obj.setValue(subModel);
            m.obj = subModel // will also break things because parent not assigned.
         */

            deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(json), "Incorrect sytax for setting does noop");

            //setting a model to another JSON model is correct syntax and should do a merge with keepOldProperties = false;
            m.model.setValue({
                key1: "this is key1's new value",
                key3: "we have added a key"
            });
            deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(expectedJSON), "Incorrect sytax for setting does noop");
        },

        testSuppressNotifications : function () {
            expect(2);
            var jsonModel = {
                x: 1,
                y: "y",
                obj: {
                    desc: "a New point"
                }
            };

            var m = new Model(jsonModel);

            var callback = function (property, oldValue) {
                ok(true, "onChange Callback works");
            };

            var callback1 = function (property, oldValue) {
                // this callback should be suppressed
                ok(false, "onChange callback suppressed succesfully");
            };

            m.x.onChange(callback);
            m.x.setValue(2);

            m.y.onChange(callback1);
            m.y.setValue(5, true); // way to set value and suppress notification
            equal(m.y.getValue(), 5, "Assignment successful when notification suppressed");
        },

        testPropertyValidation : function () {
            expect(5);
            var onlyPositive = function (value){
                return value > 0;
            };
            var m = new Model();
            m.createProperty("x", 1, {validator: onlyPositive})
             .createProperty("y", "y");

            ok(m.x.hasValidator, "Validator exists");
            equal(m.x.getValue(), 1);
            m.x.setValue(5);
            equal(m.x.getValue(), 5, "Assignment Passed because validator passed");
            ok(!m.x.validateValue(-1), "Value should not pass the validator");
            m.x.setValue(-1); // try it anyways.
            equal(m.x.getValue(), 5, "Assignment failed because value did not pass validator");
        },

        testSaveLoadWithMetaData : function () {
            expect(4);
            var expectedJSON = {
                x: 1,
                x__modeljs__metadata: {
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

            equal(JSON.stringify(m.toJSON(true)), JSON.stringify(expectedJSON), "JSON with metadata is as expected");

            var m2 = new Model(expectedJSON);
            ok(m2.x.hasValidator(), "Loading Model using JSON w/ metadata keeps the validator");
            ok(!m2.x.validateValue(-1) && m2.x.validateValue(2), "loaded json validator functions correctly");
            equal(JSON.stringify(m2.toJSON(true)), JSON.stringify(expectedJSON), "Loading Model from JSON with metadata and saving back to JSON equal");
        },

        testModelTransactions : function () {
            expect(5);
            var jsonModel = { number: 1,
                str : "aString",
                bool : true,
                nil: null,
                undef: undefined
            };

            var callbackCalled = false;
            var count = 0;
            var callback = function (property, oldValue) {
                callbackCalled = true;
                count++;
            };

        var suppresCallback = function (property, oldValue) {
                ok(false, "callbackShuld not be called because suppressed");
            };

            var m = new Model(jsonModel);
            m.number.onChange(callback);
            m.bool.onChange(suppresCallback);
            m.str.onChange(callback);

            Model.startTransaction();
            m.number.setValue(5);
            m.bool.setValue(true); //should not fire a onChange event since value not changes
            m.str.setValue("new value set in transaction");
            ok(!callbackCalled, "onChange Callback not executed till transaction complete");
            ok(Model.inTransaction(), "Model inTranaction repoting correctly");
            Model.endTransaction();
            ok(!Model.inTransaction(), "Model inTranaction repoting correctly");

            setTimeout(function () {
                // transaction should be fired by now.
                ok(callbackCalled, "onChange Callback called after tranaction ended");
                equal(count, 2, "Expected number of callbacks after transaction completed");
            }, 0)
        },

        testBubbleUpEvents : function () {
            expect(4);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "subPropOriginalValue",
                    subSubModel: {
                        str: "another string"
                    }
                }
            };

            var rootCallback = function (property, oldValue) {
                // should be called twice
                ok(true, "Root notified of Change");
            };

            var numberCallback = function (property, oldValue) {
                equal(oldValue, 1, "Number Changed event fired");
            };

            var subModelCallback = function (property, oldValue) {
                equal(oldValue, "subPropOriginalValue", "SubModel Changed event fired");
            };


            var m = new Model(jsonModel);
            m.onChange(rootCallback, true);
            m.number.onChange(numberCallback);

            // should fire 2 events one on number and one on root.
            m.number.setValue(5);

            m.subModel.onChange(subModelCallback, true);

            // should fire 2 events one on submodel and one on root.
            m.subModel.subProp.setValue("new value");

        },

        testModelClone : function () {
            expect(7);
            var jsonModel = {
                number: 1,
                number__modeljs__metadata: {
                    validator: function (value){
                        return value > 0;
                    }
                },
                str: "aString",
                bool: true,
                nil: null,
                aArray: [1,2],
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            function callback(){
                ok(true, "callback called");
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            var clone = model.clone();

            ok (model.number.hasValidator(), "Model has a validator");
            ok (clone.number.hasValidator(), "Clone keeps the validator");
            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(clone.toJSON(true)), "Model.clone looks identical");

            model.number.setValue(-3); // shouldn't pass validator thus callback not called
            model.number.setValue(3); // should pass and notify the callback

            //same applies to clone
            clone.number.setValue(-3); // shouldn't pass validator
            equal(clone.number.getValue(), 1, "Cloned attributes have the same validator");

            var subModelClone = model.subModel.clone();
            equal(subModelClone.getName(), "/subModel", "Cloned name adjusted");
            equal(subModelClone.subProp.getName(), "/subModel/subProp", "Cloned child properties names adjusted");
        },

        testGetFormattedValue : function() {
            expect(5);
            Model.Formatter = function (value) {

                if (typeof value ==='string'){
                    return value.toUpperCase();
                }
                return value;
            };

            var json = {
                str: "unformattedString",
                str2: "another string",
                str2__modeljs__metadata: {
                    Formatter: function (value) {
                        return "localFormatedResult";
                    }
                },
                number: 1,
                date: new Date()
            };

            var model = new Model(json);
            equal(model.str.getValue(), "unformattedString", "getValue returns raw value");
            equal(model.str.getFormattedValue(), "UNFORMATTEDSTRING", "getFormattedValue returns formatted value");
            equal(model.str.getValue(), "unformattedString", "getValue still returns raw value");
            equal(model.str2.getValue(), "another string", "getValue return the raw value regardless of Formatters defined");
            equal(model.str2.getFormattedValue(), "localFormatedResult", "Formatter in metadata takes precedence over global Formatter");

            Model.Formatter = undefined; //restore formatter

        },

        testFireOnlyMostRecentPropertyEvent : function () {
            expect(4);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                },
               subModel2: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            function callback(property, oldValue) {
                equal(property.getValue(), 4, "fireOnlyMostRecentPropertyEvent onChange event is the most recent");
            }

            var model = new Model(jsonModel);
            //lets registar a bunch of onChangeListeners.
            model.number.onChange(callback);

            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = true;
            Model.startTransaction();
            //Lets change number multiple time. should only be called once with last value of change
            model.number.setValue(2);
            model.number.setValue(3);
            model.number.setValue(4);
            Model.endTransaction();

            function callback1(property, oldValue) {
                equal(property.getValue(), "new subProp value3", "fireOnlyMostRecentPropertyEvent onChange event is the most recent");
            }

            //test on Model
            model.subModel.onChange(callback1, true);
            Model.startTransaction();
            model.subModel.subProp.setValue("new subProp value1");
            model.subModel.subProp.setValue("new subProp value2");
            model.subModel.subProp.setValue("new subProp value3");
            Model.endTransaction();

            function transactionCallback(property, oldValue) {
                if (property.getShortName() === "subProp") {
                    equal(property.getValue(), "new value1", "fireOnlyMostRecentPropertyEvent onChange event is the most recent");
                } else if (property.getShortName() === "fun") {
                    equal(property.getValue(), "changeFunAgain", "fireOnlyMostRecentPropertyEvent onChange event is the most recent");
                } else {
                    ok(false, "unexpected call");
                }
            }

            // test on model with mulitple changes
            model.subModel2.onChange(transactionCallback, true);
            Model.startTransaction();
            model.subModel2.subProp.setValue("new value");
            model.subModel2.subProp.setValue("new value1");
            model.subModel2.fun.setValue("changeFun");
            model.subModel2.fun.setValue("changeFunAgain");
            Model.endTransaction();

            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = false; //restore
        },

        testFlattenCallbacks : function () {
            expect(2);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            function callback(property, oldValue){
                ok(true, "onChange callback called once, even though registared on different porperties");
            }
            function callback2(property, oldValue){
                ok(true, "onChange callback2 called once because different than other callback");
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            model.subModel.onChange(callback, true);
            model.subModel.onChange(callback2, true);
            model.subModel.subProp.onChange(callback);
            model.str.onChange(callback2);

            Model.TRANSACTION_OPTIONS.flattenCallbacks = true;

            Model.startTransaction();
            model.number.setValue(3);
            model.subModel.subProp.setValue("value Changed");
            model.str.setValue("new Value");
            Model.endTransaction();

            Model.TRANSACTION_OPTIONS.flattenCallbacks = false; //restore
        },

        testFlattenCallbacksByHash : function () {
            expect(4);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            var count = 0;
            function callback(property, oldValue){
                ok(count++ === 0, "Hashed function called once when flattenCallbacksByHash set");
            }
            callback.hash = "uniqueID";

            function callback2(property, oldValue){
                ok(true, "unhashed function called more than once when flattenCallbacksByHash set");
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            model.number.onChange(callback2);
            model.subModel.onChange(callback, true);
            model.subModel.onChange(callback2, true);
            model.subModel.subProp.onChange(callback);
            model.subModel.subProp.onChange(callback2);

            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = true;

            Model.startTransaction();
            model.number.setValue(3);
            model.subModel.subProp.setValue("value Changed");
            model.str.setValue("new Value");
            Model.endTransaction();
            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = false;
        },

        testSuppressAllEvents : function () {
            expect(0);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            function callback(property, oldValue){
                ok(false, "This callback should be suppressed");
            }
            function callback2(property, oldValue){
                ok(false, "This callback should be suppressed");
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            model.subModel.onChange(callback, true);
            model.subModel.subProp.onChange(callback);
            model.str.onChange(callback2);

            Model.TRANSACTION_OPTIONS.suppressAllEvents = true;

            Model.startTransaction();
            model.number.setValue(3);
            model.subModel.subProp.setValue("value Changed");
            model.str.setValue("new Value");
            Model.endTransaction();

            Model.TRANSACTION_OPTIONS.suppressAllEvents = false; //restore
        },

        testModelEndTransactionWithOptions : function () {
            expect(8);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            var count = 0;
            function callback(property, oldValue) {
                ok(count++ === 0, "Hashed function called once when flattenCallbacksByHash set");
            }

            callback.hash = "uniqueID";
            function callback2(property, oldValue){
                ok(true, "unhashed function called more than once when flattenCallbacksByHash set");
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            model.number.onChange(callback2);
            model.subModel.onChange(callback, true);
            model.subModel.onChange(callback2, true);
            model.subModel.subProp.onChange(callback);
            model.subModel.subProp.onChange(callback2);

            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = true; // to start change defaults
            Model.TRANSACTION_OPTIONS.flattenCallbacks = true;
            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = true;
            Model.TRANSACTION_OPTIONS.suppressAllEvents = true;

            Model.startTransaction();
            model.number.setValue(3);
            model.subModel.subProp.setValue("value Changed");
            model.str.setValue("new Value");
            Model.endTransaction({
                flattenCallbacksByHash: true,
                flattenCallbacks: false,
                fireOnlyMostRecentPropertyEvent: false,
                suppressAllEvents: false
            });

            ok(Model.TRANSACTION_OPTIONS.flattenCallbacksByHash, "global event setting restore after endTransaction with options");
            ok(Model.TRANSACTION_OPTIONS.flattenCallbacks, "global event setting restore after endTransaction with options");
            ok(Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent, "global event setting restore after endTransaction with options");
            ok(Model.TRANSACTION_OPTIONS.suppressAllEvents, "global event setting restore after endTransaction with options");


            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = false; // test ended restore defaults
            Model.TRANSACTION_OPTIONS.flattenCallbacks = false;
            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = false;
        },

        testInvalidInitialValue : function () {
            expect(5);
            function isPositive(value) {
                return value > 0;
            }

            function countableObject(value){
                return value && value.count;
            }

            var m = new Model();

            m.createProperty("blankProp", undefined, {validator:isPositive});
            m.createProperty("negativeNumber", -1, {validator:isPositive});
            m.createProperty("positiveNumber", 1, {validator:isPositive});
            m.createProperty("invalidCountable", {str:"123"}, {validator:countableObject});
            m.createProperty("validCountable", {str:"123", count:1}, {validator:countableObject});

            var expectedJSON = {
                blankProp: undefined,
                negativeNumber: undefined,
                positiveNumber:1,
                invalidCountable: {},
                validCountable: {
                    str:"123",
                    count:1
                }
            };

            ok(m.negativeNumber.getValue() === undefined, "invalid Property value not set on initialization");
            ok(JSON.stringify(m.invalidCountable.getValue()) === "{}", "invalid Model value not set on initialization");
            equal(JSON.stringify(m.toJSON()), JSON.stringify(expectedJSON), "Creation validation toJSON works");

            m.invalidCountable.setValue({str:1, count:1});
            m.negativeNumber.setValue(3);

            equal(JSON.stringify(m.invalidCountable.getValue()), JSON.stringify({str:1, count:1}), "assignment to undefined Model");
            equal(m.negativeNumber.getValue(), 3, "assignment to undefined Property");
        },

        testGetMetadataMethod : function () {
            expect(4);
            var expectedJSON = {
                number: 1,
                number__modeljs__metadata: {
                    validator: function (value){
                        return value > 0;
                    },
                    customMetaDataProperty: true
                },
                str: "strValue with no metadata",
                str__modeljs__metadata: {
                    addedCustomMetaDataProperty: true
                }
            };

            var model = new Model();
            model.createProperty("number", 1, { // inserting metadata during construction
                validator: function (value){
                        return value > 0;
                    },
                customMetaDataProperty: true    //custom metadata property
            })
            .createProperty("str", "strValue with no metadata");

            ok(model.number.hasValidator(), "validators are in the metadata");
            ok(model.number.getMetadata().customMetaDataProperty, "Can retrieve custom metadata set during construction");

            model.str.getMetadata().addedCustomMetaDataProperty = true; //add a metadata property
            ok(model.str.getMetadata().addedCustomMetaDataProperty, "Can retrieve custom metadata set post construction");

            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(expectedJSON), "metadata serialized correctly");
        },

        testCustomEvent : function () {
            expect(6);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };
            var model = new Model(jsonModel);

            function callback (property, arg) {
                //var a = arguments;
                equal(arg, "bar", "correct argument passed to callback");
                equal(property, model.str, "callback property argument is the property event was triggered on");
                equal(this, model.str, "callback this is the property event was triggered on");
            }

            model.str.on("foo", callback); // register custom event
            model.str.trigger("bar", "bar"); // trigger incorrect custom event
            model.str.trigger("foo", "bar"); // trigger correct custom event

            function fourArgsCallback() {
                ok (arguments.length === 4);
            }
            model.str.on("fourArgsCallback", fourArgsCallback);
            //first arg is always the property.
            model.str.trigger("fourArgsCallback", "a", "b", "c");

            var numberCallbackCount = 0;
            function numberCallback (property, arg) {
                ok(numberCallbackCount++ < 2, "this custome Event should be triggered twice");
            }

            model.number.on("foo", numberCallback); //registar same callback twice
            model.number.on("foo", numberCallback);
            model.number.trigger("foo", "bar");

            model.number.off("foo", numberCallback); // should remove everything
            model.number.trigger("foo", "bar");
         },

        testChildCreatedEvent : function () {
            expect(3);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";}
                }
            };

            function callback (property, arg){
                equal(JSON.stringify(this.toJSON()), JSON.stringify(model.toJSON()), "creteChildCallback this equals model listener attached too");
                equal(JSON.stringify(property.toJSON()), JSON.stringify(model.toJSON()), "creteChildCallback property argument equals model listener attached too");
                equal(JSON.stringify(arg.getValue()), JSON.stringify(model.newProp.getValue()), "creteChildCallback arg argument equals newly created property");
            }

            var model = new Model(jsonModel);
            model.on("childCreated", callback);
            model.createProperty("newProp", "string Prop");

        },

        testAllEvent : function () {
            expect(5);
            var jsonModel = {
                number: 1,
                str: "a string",
                obj: {
                    first: "prop on obj"
                }
            };

            var model = new Model(jsonModel);
            function callback(property, originalArg, eventName) {
                var a = arguments;// put breakpoint here to see arguments to callback which depend on event.
                ok(true, "Callback should be fired 5 times");
            }
            model.on(Model.Event.ALL, callback);
            // all event does not listen to propegated MODEL_CHANGED events. Only listens to real events.
            model.number.setValue(10);

            // Do stuff to model. And make sure it works.

            model.createProperty("second", "secondProp");//CHILD_CREATED

            model.trigger("knockKnock", "whose", "there", "son");//CUSTOM

            model.number.on(Model.Event.ALL, callback);

            model.number.setValue(2); //PROPERTY_CHANGE

            model.number.destroy(); // DESTROY & CHILD_DESTROYED
        },

        testDoNotPersist : function () {
            expect(4);
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    fun: function () {return "I am a function";},
                    obj: {
                        num: 1,
                        num2: 2
                    }
                }
            };

            var model = new Model(jsonModel);
            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(jsonModel), "metadata serialized correctly");

            var doNotPersistNumberPropertyJSON = {
                    number: undefined,
                    number__modeljs__metadata: {
                        doNotPersistValue: true
                    },
                    str: "aString",
                    bool: true,
                    nil: null,
                    undef: undefined,
                    fun: function () {return "I am a function";},
                    subModel: {
                        subProp: "I am the subProp",
                        fun: function () {return "I am a function";},
                        obj: {
                            num: 1,
                            num2: 2
                        }
                    }
                };

            model.number.getMetadata().doNotPersistValue = true;
            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(doNotPersistNumberPropertyJSON), "metadata serialized correctly");
            delete model.number.getMetadata().doNotPersistValue; // restore original

            var doNotPersistObjectPropertyJSON = {
                    number: 1,
                    str: "aString",
                    bool: true,
                    nil: null,
                    undef: undefined,
                    fun: function () {return "I am a function";},
                    subModel: {},
                    subModel__modeljs__metadata: {
                        doNotPersistValue: true
                    }
                };

            model.subModel.getMetadata().doNotPersistValue = true;
            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(doNotPersistObjectPropertyJSON), "metadata serialized correctly");

            model.subModel.getMetadata().doNotPersist = true;
            delete doNotPersistObjectPropertyJSON.subModel;
            delete doNotPersistObjectPropertyJSON.subModel__modeljs__metadata;
            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(doNotPersistObjectPropertyJSON), "metadata serialized do not persistcorrectly");
        },

        testThinModel : function () {
            expect(4);
            var jsonModel = {
                matrix: {
                    obj2: {
                        obj3: {
                            prop: "propValue"
                        }
                    }
                }
            };

            var jsonModel2 = {
                a: {
                    b: {
                        c:1
                    }
                }
            };

            var model = new Model(jsonModel, {thin:true});

            // create property should fail
            model.createProperty("subProp", "shouldFail");
            equal(model.subProp, undefined, "Can not create Properties on a Model that is thin");

            deepEqual(JSON.stringify(model.getValue()), JSON.stringify(jsonModel), "getValue still works on thin models");

            model.merge(jsonModel2);
            deepEqual(JSON.stringify(model.getValue()), JSON.stringify(jsonModel2), "merge still works on thin models");

            deepEqual(JSON.stringify(model.toJSON(true)), JSON.stringify(jsonModel2), "toJSON still works on thin models");
        },

        testModelFunctionProperties : function () {
            expect(2);
            var person = {
                firstName: "John",
                lastName: "Smith",
                fullName: function () {
                    return this.firstName.getValue() + " " + this.lastName.getValue();
                }
            };

            var john = new Model(person);
            equal(john.fullName.getValue()(), "John Smith", "function properties have this bound to parent");

            john.createProperty("testFunctionThis", function () { return this;}.bind("NotParentModel"));
            equal(john.testFunctionThis.getValue()(), "NotParentModel", "function this stays to value bound by bind");

        },

        testPropertyArrayLoading : function () {
            expect(1);
            var jsonModel0 = {
                matrix: {
                    obj2: {
                        obj3: {
                            prop: "propValue"
                        }
                    }
                }
            };

            var jsonModel = {
                matrix: [[1, 2],[3,4]]
            };

            var model = new Model(jsonModel);

            deepEqual(JSON.stringify(model.getValue()), JSON.stringify(jsonModel), "Complex Model From JSON and back equal");
        },

        testPropertyArrayPushPopSort : function () {
            expect(17);

            function testPropertyArrayOnlyContainsProperties(propertyArray) {
                for (var i = 0; i < propertyArray.length; i++){
                    if (!Model.isProperty(propertyArray[i])){
                        return false;
                    }
                }
                return true;
            }

            var model = new Model();
            var arrayPrimitiveValue = [1,2,3];
            model.createProperty("oArray", arrayPrimitiveValue);
            ok( Model.isArray(model.oArray), "Array Property created");
            equal(model.oArray.length, 3, "Array initial size correct");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "test Array initial getValue");
            ok (testPropertyArrayOnlyContainsProperties(model.oArray), "Property Array contains only Properties");

            var callbackCount = 0,
                childDestroyedCallbackCount = 0,
                childCreatedCallbackCount = 0;
            function changeCallback (property, oldValue) {
                var a = arguments.length; // put breakpoint here to see arguments
                ok(callbackCount++ < 1, "sort causes a CHANGE event");
            }

            function childCreatedCallback(property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                ok(childCreatedCallbackCount++ < 6, "pushing multiple item cause a CHILD_CREATED event for each item");
            }
            function childDestroyedCallback (property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                ok(childDestroyedCallbackCount++ < 1, "pop cause a CHILD_DESTROYED event for each item");
            }

            model.oArray.onChange(changeCallback);
            model.oArray.on(Model.Event.CHILD_CREATED, childCreatedCallback);
            model.oArray.on(Model.Event.CHILD_DESTROYED, childDestroyedCallback);

            model.oArray.push(3,2,8,4,10); // 5 CHILD_CREATED events
            arrayPrimitiveValue.push(3,2,8,4,10);
            ok (testPropertyArrayOnlyContainsProperties(model.oArray), "Property Array contains only Properties");
            equal(model.oArray.length, 8, "test Array post push length");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "push() works as expected");


            model.oArray.pop(); // Causes one CHILD_DESTROYED event
            arrayPrimitiveValue.pop();
            equal(model.oArray.length, 7, "test Array post pop length");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "pop() works as expected");

            callbackCount = 0;
            model.oArray.sort();
            arrayPrimitiveValue.sort();  // Sort fires a change event
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "sort() works as expected");
        },

        testPropertyArrayShiftUnshitReverse : function () {
            expect(15);

            function testPropertyArrayOnlyContainsProperties(propertyArray) {
                for (var i = 0; i < propertyArray.length; i++){
                    if (!Model.isProperty(propertyArray[i])){
                        return false;
                    }
                }
                return true;
            }

            var model = new Model();
            var arrayPrimitiveValue = [1,2,3];
            model.createProperty("oArray", arrayPrimitiveValue);
            ok( Model.isArray(model.oArray), "Array Property created");
            equal(model.oArray.length, 3, "Array initial size correct");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "test Array initial getValue");
            ok (testPropertyArrayOnlyContainsProperties(model.oArray), "Property Array contains only Properties");

            var callbackCount = 0,
                childDestroyedCallbackCount = 0,
                childCreatedCallbackCount = 0;
            function changeCallback (property, oldValue) {
                var a = arguments.length; // put breakpoint here to see arguments
                ok(callbackCount++ < 3, "reverse, shift and unshift causes a CHANGE event");
            }

            function childCreatedCallback(property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                ok(childCreatedCallbackCount++ < 2, "unshifting cause a CHILD_CREATED event for each item");
            }
            function childDestroyedCallback (property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                ok(childDestroyedCallbackCount++ < 1, "pop cause a CHILD_DESTROYED event for each item");
            }

            model.oArray.onChange(changeCallback);
            model.oArray.on(Model.Event.CHILD_CREATED, childCreatedCallback);
            model.oArray.on(Model.Event.CHILD_DESTROYED, childDestroyedCallback);

            var ModelShift = model.oArray.shift();
            var ArrayShift = arrayPrimitiveValue.shift();  // shift results in one CHILD_DESTROYED event.
            equal(model.oArray.length, 2, "Shift remove element from array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "shift() works as expected");

            model.oArray.unshift(5,4); // needs to create proper properties to insert.
            arrayPrimitiveValue.unshift(5,4); // unshift results in one CHILD_CREATED event per element.
            equal(model.oArray.length, 4, "Unshift adds elements to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "unshift() works as expected");

            model.oArray.reverse();
            arrayPrimitiveValue.reverse(); // reverse fires a change event.
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "reverse() works as expected");

        },

        testPropertyArraySlice : function () {
            expect(15);

            function testPropertyArrayOnlyContainsProperties(propertyArray) {
                for (var i = 0; i < propertyArray.length; i++){
                    if (!Model.isProperty(propertyArray[i])){
                        return false;
                    }
                }
                return true;
            }

            var model = new Model();
            var arrayPrimitiveValue = [8, 4, 1, 2, 6, 3, 3, 10];
            model.createProperty("oArray", arrayPrimitiveValue);
            ok( Model.isArray(model.oArray), "Array Property created");
            equal(model.oArray.length, 8, "Array initial size correct");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "test Array initial getValue");
            ok (testPropertyArrayOnlyContainsProperties(model.oArray), "Property Array contains only Properties");

            var callbackCount = 0,
                childDestroyedCallbackCount = 0,
                childCreatedCallbackCount = 0;
            function changeCallback (property, oldValue) {
                var a = arguments.length; // put breakpoint here to see arguments
                ok(callbackCount++ < 3, "slice will fire a event");
            }

            function childCreatedCallback(property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                ok(childCreatedCallbackCount++ < 1, "slice can fire a CHILD_CREATED event");
            }
            function childDestroyedCallback (property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                ok(childDestroyedCallbackCount++ < 1, "slice can fire a DESTROY event");
            }

            model.oArray.onChange(changeCallback);
            model.oArray.on(Model.Event.CHILD_CREATED, childCreatedCallback);
            model.oArray.on(Model.Event.CHILD_DESTROYED, childDestroyedCallback);

            model.oArray.splice(1,1); // removes the second element. CHILD_DESTROYED & CHANGE event
            arrayPrimitiveValue.splice(1,1);
            equal(model.oArray.length, 7, "Splice can remove elements from array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "splice() works as expected");


            model.oArray.splice(1, 0, 99); // adds 99 to index 2. one CHILD_CREATED & CHANGE event.
            arrayPrimitiveValue.splice(1, 0, 99);
            equal(model.oArray.length, 8, "splice can add elements to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "splice() works as expected");

            childCreatedCallbackCount = 0;
            childDestroyedCallbackCount = 0;
            model.oArray.splice(1, 1, 25); // removes the second element, to add 25, this is CHANGE event rather than do a destroy and create
            arrayPrimitiveValue.splice(1, 1, 25);
            equal(model.oArray.length, 8, "Splice removes the second element, to add 25 to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "splice() works as expected");

        },

        testPropertyArraySetValue : function () {
            expect(1);

            var model = new Model({
                arr: [1,2,3,4]
            });
            model.arr.setValueAt(0, 12);
            equal(model.arr[0].getValue(), 12, "test Array setValueAt");
        },

        testLinkingModelProperties : function () {
            expect(8);
            var model = new Model({a:1, b:"str", c:100, d:300, e:"prop", f:200}, {name: "a"});
            var model2 = model.clone();

            var disconnectModel = Model.connect(model, model2);
            var disconnectA = Model.connect(model.a, model2.a);
            var disconnectE = Model.connect(model.e, model2.e);
            var disconnectF = Model.connect(model.f, model2.f);

            // do actions
            model.createProperty("anotherProp", "anotherValue", {random:1});
            model.e.destroy();
            model.a.setValue(10);
            model2.f.setValue(15);

            //test result
            setTimeout (function () {
                ok(model2.anotherProp, "linked model received CHILD_CREATED event");
                ok(!model2.e, "linked model received CHILD_DESTROYED event");
                equal(model2.a.getValue(), 10, "linked model received PROPERTY_CHANGE event");
                equal(model.f.getValue(), 15, "linked model received PROPERTY_CHANGE event in other direction");
            }, 50);

            model2.a.on("customEvent", function () {
                ok(true, "linked model received custom event");
            });
            model.a.trigger("customEvent");


            disconnectA(); // after you disconnect you need events. to flush.
            setTimeout( function () {

                model.a.setValue(5);
            }, 50);

            setTimeout( function () {
                equal(model2.a.getValue(), 10, "models were disconnected successfully");
            }, 100);


            //test "oneWay" direction
            Model.connect(model.b, model2.b, {direction:"oneWay"});
            model.b.setValue(123);
            setTimeout( function () {
                equal(model2.b.getValue(), 123, "Forward event propagates");
                model2.b.setValue(987);
            }, 100);
            setTimeout( function () {
                equal(model.b.getValue(), 123, "OneWay does not propagate in reverse direction");
            }, 150);

        },

        testLinkedModelWhiteAndBlackLists: function () {
            expect(12);
            var model = new Model({a:1, b:"str", c:100, d:300, e:"prop", f:200}, {name: "a"});
            var model2 = model.clone();

            var testCallbackSourceCalled = false;
            function testCallbackSource(property, eventArg) {
                equal(eventArg, "normalEvent", "normalEvent fired on Source Property");
            }
            var testCallbackDestCalled = false;
            function testCallbackDest(property, eventArg) {
                equal(eventArg, "normalEvent", "normalEvent fired on Dest Property");
            }

            /** test black listed events **/
            function blackListedEventCallback (property, eventArg) {
                equal(eventArg, "blackListedEventCallbackCalledOnSource", "blackListedEvent fired on Source Property");
            }

            function blackListedEventCallback2 (property, eventArg) {
                equal(eventArg, "blackListedEventCallbackCalledOnDest", "blackListedEvent fired on Dest Property");
            }

            Model.connect(model.c, model2.c, {eventBlackList:"blackListedEvent"});
            model.c.on("blackListedEvent", blackListedEventCallback);
            model.c.on("test", testCallbackSource);
            model2.c.on("blackListedEvent", blackListedEventCallback2);
            model2.c.on("test", testCallbackDest);

            //blacklisted event should not propagate
            model.c.trigger("blackListedEvent", "blackListedEventCallbackCalledOnSource");

            model2.c.trigger("blackListedEvent", "blackListedEventCallbackCalledOnDest");


            // test is not blacklisted so should propagate
            model.c.trigger("test", "normalEvent");

            model2.c.trigger("test", "normalEvent");


            /** Test white listed Events **/
            function whiteListedEventCallback (property, eventArg) {
                equal(eventArg, "whiteListedEvent", "whiteListedEvent fired on Source Property");
            }
            function whiteListedEventCallback2 (property, eventArg) {
                equal(eventArg, "whiteListedEvent", "whiteListedEvent fired on Dest Property");
            }


            function nonWhiteListedEventCallback (property, eventArg) {
                equal(eventArg, "nonWhiteListedEventCallbackOnSrc", "nonWhiteListedEvent fired on Source Property");
            }

            function nonWhiteListedEventCallback2 (property, eventArg) {
                equal(eventArg, "nonWhiteListedEventCallbackOnDest", "nonWhiteListedEvent fired on Dest Property");
            }

            Model.connect(model.d, model2.d, {eventWhiteList:"whiteListedEvent"});
            model.d.on("whiteListedEvent", whiteListedEventCallback);
            model.d.on("test", nonWhiteListedEventCallback);
            model2.d.on("whiteListedEvent", whiteListedEventCallback2);
            model2.d.on("test", nonWhiteListedEventCallback2);

            testCallbackSourceCalled = testCallbackDestCalled = false;

            //condif
            model.d.trigger("test", "nonWhiteListedEventCallbackOnSrc");
            model2.d.trigger("test", "nonWhiteListedEventCallbackOnDest");

            // whiteListedEvent should also notify linked model.
            model.d.trigger("whiteListedEvent", "whiteListedEvent");

            model2.d.trigger("whiteListedEvent", "whiteListedEvent"); // other direction
        },

        testLinkedModelArrays: function () {
            expect(2);
            //Model.asyncEvents = false;
            var arrayModel = new Model({arr: [1,2,3]});
            var arrayModel2 = new Model({arr: [4,5,6]});

            Model.connect(arrayModel.arr, arrayModel2.arr);
            arrayModel.arr.push(2);

            setTimeout(function () {
                equal(arrayModel2.arr.length, 4, "push propagated to linked Array");

                arrayModel.arr.pop();

                setTimeout(function () {
                        equal(arrayModel2.arr.length, 3, "pop propagated to linked Array");
                }, 100);
            }, 100);


        },

        testLinkingEntireModels : function () {
            expect(5);
            var model = new Model({
                a:1,
                b:"str",
                c:300,
                d: {
                    g:123,
                    arr: [1,2,3]
                }
            }, {name: "a"});
            var model2 = model.clone();

            var disconnectModel = Model.connect(model, model2, {includeChildren: true});

            model.a.setValue(1234);
            model.d.g.setValue(567);
            model.d.arr.pop();

            disconnectModel(); //TODO flush the Queue
            //since linking models works off events it is asynchronous thus notification to other model is delayed. At time of notification value may differ

            //we do these chages later after disconnect events fire. else this will be the value set.
            setTimeout(function () {
                model.d.g.setValue(999);
                setTimeout(function () {
                    equal(model2.a.getValue(), 1234, "Direct children linked");
                    equal(model2.d.g.getValue(), 567, "indirect children linked");
                    equal(model.d.arr.length, model2.d.arr.length, "arrays linked");

                    equal(model.a.getValue(), 1234, "linked properties disconnected correctly");
                    equal(model.d.g.getValue(), 999, "linked properties disconnected correctly");

                }, 50);
            }, 50);



        },

        testLinkingModelsViaMap : function () {
            expect(2);
            var model = new Model({
                a:1,
                b:"str",
                c:300,
                d: {
                    g:123,
                    arr: [1,2,3]
                }
            }, {name: "a"});

            var model2 = new Model({ linktoA: "not Linked", linktoC:1});

            var mapFunction = function (input) {
                var map = {
                    "/a/a":"/root/linktoA",
                    "/a/c": "/root/linktoC"
                };
                return map[input];
            };
            var disconnectModel2 = Model.connect(model, model2, {
                includeChildren: true,
                mapFunction: mapFunction
            });

            model.a.setValue(200);

            model2.linktoC.setValue(200);

            setTimeout(function () {
                equal(model.a.getValue(), model2.linktoA.getValue(), "mapping works forward");
                equal(model.c.getValue(), model2.linktoC.getValue(), "mapping works backwards");
            }, 50);
        },

        testModelFind : function () {
            expect(7);
            var json = {
                prop1:"prop1",
                subProp1:{
                    prop1: "prop1-l2",
                    arr: ["value1", "value2"],
                    subProp2: {
                        prop1: "prop1l3",
                        subProp3:{
                            baby: "a"
                        }
                    }
                }
            };

            var rootModel = new Model(json);
            var baby = rootModel.subProp1.subProp2.subProp3.baby;
            ok(Model.find(rootModel, baby.getName()), "search for direct child");
            ok(Model.find(baby, rootModel.subProp1.getName()), "search for direct parent");
            ok(Model.find(baby, rootModel.prop1.getName()), "search for sibling/cousin");
            ok(Model.find(baby, baby.getName()), "search for self");
            equal(Model.find(rootModel, "/root/subProp1/doesNotExist/a"), null, "Searching for non-existant property returns null");

            equal(Model.find(rootModel, rootModel.subProp1.arr[1].getName()).getValue(), "value2", "search within a array");
            equal(Model.find(rootModel, "/root/subProp1/arr/1").getValue(), "value2", "search within a array");
        },

        modlejsTutorial : function () {

            //The code below will teach you how to use modeljs by example. It attepts to go though all the features provided in modeljs in logical progression.

            /** First thing you will want to do is create your model.
            * If starting from scratch there are two ways to proceed.
            * 1. Create it from a JSON object or
            * 2. Create it programatically.
            * method 3, from an already saved modeljs JSON object will be demonstrated later.
            */

            /** --- method 1: create a model from a JSON object --- */
            // models can have anything you could put in a JavaScript object
            var modelAsJSON = {
                numberProperty: 1,
                stringProperty: "string",
                boolProperty: true,
                nullProperty: null,
                undefProperty: undefined,
                objProperty: {
                    name: "point",
                    value: {
                            x: 2,
                        y: 8,
                        desc: "a complex value"
                    },
                    desc: "This is demonstrating the recursive ability of creating your model"
                },
                objProperty2: {
                    value1: "a",
                    value2: "b"
                },
                functionProperty: function () {
                    return "This is a function";
                }
            };

            var modelFromJSON = new Model(modelAsJSON);


            /** --- method 2: creating your model programatically --- */
            var modelFromCode = new Model(); //creates a empty model equivlant of new Model({});
            // create properties via the createProperty (name, value, options) method
            modelFromCode.createProperty("PropertyName", "property Value");
            modelFromCode.createProperty("number", 1); // values can be any of the native Javascript types
            // Values can also be json objects.
            modelFromCode.createProperty("obj", {"submodel2": "a way to programatically set a property to a submodel", prop1: "a property"}); //This is recommended.

            //values can not be of tyep Model or Property like commented below.
            //modelFromCode.createProperty("obj", new Model({"subModel": "I am a inlined Model object"})); // This will throw an error to the console
            //instead do the following use the toJSON method on the model to recreate it.
            modelFromCode.createProperty("subModel", modelFromJSON.objProperty2.toJSON());

            // the createProperty method can also take options like a validator function
            modelFromCode.createProperty("positiveNumber", 2, {validator: function (value){
                return typeof value === 'number' && value > 0;}
            });
            // Validator functions get run when you try to change the property value.
            // If the value is not valid the validator will return false and the property remains unchanged.
            // Note validators can only be bound to the property at creation time.
            // Let look at how we can set/change property values

            /** --- Model manipulation --- */
            // This is a getter for a Property. it retieves the value 1.
            var numberPropertyValue = modelFromJSON.numberProperty.getValue();

            // This is a getter for a Model. It returns a JSON object.
            var objModelValue = modelFromJSON.objProperty2.getValue();

            //This sets the Property value to 2;
            modelFromJSON.numberProperty.setValue(2);

            // This is a setter for Model Objects.
            modelFromJSON.objProperty2.setValue({
                value1: "new Value1 value",
                value3: "Adding a new property"
            });
            // The above will effectively add properties that don't exist. change the values of ones that do (keeping validation and listeners untouched)
            // and remove properties that are missing.


            // We can set the property to anything, but remember it must pass the validator.
            // This string will fail the positiveNumber validator. getValue will still be 2
            modelFromCode.positiveNumber.setValue("a String");

            //if you don't like the silent failure you can use these methods to check if a validator exists
            modelFromCode.positiveNumber.hasValidator();
            modelFromCode.positiveNumber.validateValue("a String"); // or even do the test yourself

            // sometimes its desireble to change a value without notifying your listener. You can do this by using the second argument to setValue
            modelFromJSON.numberProperty.setValue(6, true);

            // Note: You can not set a Model to a Property or a Property to a Model
            modelFromJSON.numberProperty.setValue({
                prop1: 6,
                prop2: true
            });
            // Be very careful this can happen within the Object too.
            modelFromJSON.objProperty.setValue({
                name: {
                    nameObj: "Setting a property to a ModelObj should fail"
                }
            });
            modelFromJSON.objProperty.setValue({
                name: "this is a proptery value change",
                value: "this trys to replace obj with property"
            });

            if (Model.enableLogging){
                console.log("modlejsTutorial: 3 errors to console expected");
            }
            // The next section will talk about events

            /* --- Events --- */
            /** The core responsibility of the Model in the MVC patter is to notify the view when the model changes */
            // using modeljs the you can listen to when any model property value changes by registaring a callback.
            // below is a example of registaring a callback to numberProperty
            var callbackCount = 0;
            function callback (property, oldValue){
                callbackCount+=1;
            }
            modelFromJSON.numberProperty.onChange(callback);

            // Now whenever you change the value of numberProperty the callback will be called, unless the value was
            // set with the suppressNotifications set to true.

            // The callback can be put on any property
            // this is on a objProperty object. It only gets called when the objProperty changes not any of it's children
            modelFromJSON.objProperty.onChange(callback);
            // This is attaching the same listener to a child property of objProperty
            modelFromJSON.objProperty.name.onChange(callback);

            // If you want to listen to anyProperty changes of a Property and its children you can register you callback to do so.
            modelFromJSON.objProperty2.onChange(callback, true); // callback will be called with objProperty2 or it's children change value
            //this is recomended as oppose to registaring the same listener on all children.

            // Finally another useful feature is delaying your callbacks until your done munipulating the model
            // To do that you create a transaction like below.

            Model.startTransaction();
            //any code in here will not notify it's listeners until Model.endTransaction() is called
            modelFromJSON.stringProperty.setValue("new String Property");
            modelFromJSON.objProperty.name.setValue("new name");

            modelFromCode.number.onChange(callback);
            modelFromCode.number.setValue(8);
            Model.endTransaction();

            // To check if your in a transaction block you can call
            Model.inTransaction();

            //Finally if your using transaction there is a way to be smart about the callbacks you at the end of the transaction.
            // This feature is still in development, and is unclear of the strategies it will use, but it can be turn on and off via the boolean



            /* --- Saving and Loading from saved --- */
            // Finally, last but not least is saving your model. The toJSON method will return the JSON representation of
            // the model that you can persist and reload at a later time. If you pass true as an argument to the toJSON function
            // the JSON will include model metadata like validators, otherwise it will be JSON with only the property name/values
            // being outputted.
            modelFromJSON.toJSON(true);
            modelFromJSON.toJSON(false);

           ok(JSON.stringify(modelFromJSON.toJSON()) !== JSON.stringify(modelAsJSON), "Passed");

        }
    };

    ModelTests.browserOnlyTests = {

        testJSONPRemoteModel : function testJSONPRemoteModel() {
            expect(3);
            var test = new Model();
            test.createProperty ("remoteModel", {prop1: "defaultValue"}, {
                url: "http://search.twitter.com/search.json?q=tennis&callback=$jsonpCallback",
                doNotPersist: true,
                refreshRate: -1, // -1 means fetch once.
                isJSONPurl: true,
                validator: function() {
                    return true;
                }
            });

            function callback (property, oldValue) {
                ok(test.remoteModel.query, "remoteModel was modified to have a count property");
                ok(true, "onChange callback fired on remote Model");
            }
            test.remoteModel.onChange(callback);

            ok(!test.remoteModel.count, "remoteModel count property DNE");
        },

        testModelNoConflict : function () {
            expect(3);
            ok (Model, "Model exists in global namespace prior to noConflict");
            var originalModel = Model;
            var myModel = Model.noConflict();

            ok (!Model, "Model remove from global namespace after noConflict called");
            equal(myModel, originalModel, "Model returned from noConflict Method");
            window.Model = myModel; //restore the world so other tests continue to work

        }
    };


    ModelTests.nodeOnlyTests = {
    };

    // flag asyn tests
    ModelTests.browserOnlyTests.testJSONPRemoteModel.isAsync = true;

    ModelTests.tests.testOnChangeCallbackWhenSettingToSameValue.isAsync = true;
    ModelTests.tests.testPropertyDestroyMethod.isAsync = true;
    ModelTests.tests.testModelMergeMethod.isAsync = true;
    ModelTests.tests.testSuppressAllEvents.isAsync = true;

    ModelTests.tests.testSuppressNotifications.isAsync = true;
    ModelTests.tests.testModelTransactions.isAsync = true;
    ModelTests.tests.testBubbleUpEvents.isAsync = true;
    ModelTests.tests.testModelClone.isAsync = true;

    ModelTests.tests.testFireOnlyMostRecentPropertyEvent.isAsync = true;
    ModelTests.tests.testCustomEvent.isAsync = true;
    ModelTests.tests.testFlattenCallbacks.isAsync = true;
    ModelTests.tests.testFlattenCallbacksByHash.isAsync = true;
    ModelTests.tests.testChildCreatedEvent.isAsync = true;
    ModelTests.tests.testAllEvent.isAsync = true;
    ModelTests.tests.testModelEndTransactionWithOptions.isAsync = true;
    ModelTests.tests.testPropertyArraySlice.isAsync = true;
    ModelTests.tests.testPropertyArrayPushPopSort.isAsync = true;
    ModelTests.tests.testPropertyArrayShiftUnshitReverse.isAsync = true;

    ModelTests.tests.testLinkingModelProperties.isAsync = true;
    ModelTests.tests.testLinkingEntireModels.isAsync = true;
    ModelTests.tests.testLinkingModelsViaMap.isAsync = true;
    ModelTests.tests.testLinkedModelArrays.isAsync = true;
    ModelTests.tests.testLinkedModelWhiteAndBlackLists.isAsync = true;


   if (typeof define === "function" && define.amd) {
        define([], function () {
            return ModelTests;
        });
    } else if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = ModelTests;
        }
        exports.ModelTests = ModelTests;
    } else {
        /** @global */
        window["ModelTests"] = ModelTests;
    }
}(typeof window !== 'undefined' ? window : GLOBAL)); //window in the browser and GLOBAL in node