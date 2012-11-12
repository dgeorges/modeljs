/**
 * Set up environment for tests.
 * The following is solely required for running the tests in the Node environment since the
 * browser tests will import model.js and qunit prior to this file.
 *
 * FYI: There may be a better way to do this.
 */

(function (globalNS) { //globalNS === window in the browser or GLOBAL in nodejs
    "use strict";

    // tests assume Model has been loaded to the global NS and qunit has also defined its asserts globally.
    // This is not the case when running tests on node. So we stub it out to get tests workng.
    if (typeof require === 'function' && typeof GLOBAL === 'object') {
        try {
            var assert = require("assert");
            GLOBAL.Model = require("./../src/model");

            if (assert && typeof ok !== 'function') {
                GLOBAL.ok = assert.ok;
                GLOBAL.equal = assert.equal;
                GLOBAL.deepEqual = assert.deepEqual;
            }
        } catch (e) {
            console.log("error setting up tests");
        }
    }

    var ModelTests = {};
    ModelTests.tests = {
        testPrimitiveSaveLoad : function () {
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
            };
            m.number.onChange(f);
            m.number.setValue(2);
            m.number.setValue(3);
            m.number.setValue(3); // value is the same should not fire a change

            equal(count, 2, "onChangeEvent only fires when OldValue != newValue");
        },

        testModelCreationUsingCreatePropertyMethod : function () {
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
            }

            var model = new Model(jsonModel);
            ok(model.number);
            model.number.onDestroy(deleteCallback);
            model.number.destroy();
            ok(!model.number, "number Property no longer exists it was destroyed");
            ok(deleteCallbackCalled, "destroy callback called");

            deleteCallbackCalled = false;
            model.subModel.str2.onDestroy(deleteCallback);
            model.subModel.destroy();
            ok(!model.subModel, "SubModel Property no longer exists it was destroyed");
            ok(deleteCallbackCalled, "destroy callback of child called");

            deleteCallbackCalled = false;
            model.arr[1].onDestroy(deleteCallback);
            model.arr.destroy();
            ok(!model.arr, "Array Property no longer exists it was destroyed");
            ok(deleteCallbackCalled, "destroy callback called on array children");

        },

        testModelMergeMethod : function () {
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

            var callbackCount = 0;
            function callback (property, arg){
                callbackCount++;
            }

            var m = new Model(modelJSON);
            m.obj2.key2.onDestroy(callback); // 1 callback
            m.obj2.on("childCreated childDestroyed", callback); // 3 callbacks

            m.obj2.merge(mergeObj);//keepOldProperties = false
            ok (!m.obj2.key2, "old properties removed");
            equal (m.obj2.key1.getValue(), "new key1Value", "existing property overridden");
            equal (m.obj2.key3.getValue(), "new key", "new property added");
            equal (callbackCount, 4, "new property added");

            callbackCount = 0; //reset Callback
            var m1 = new Model(modelJSON);
            m1.obj2.key2.onDestroy(callback);
            m1.obj2.on("childCreated childDestroyed", callback); //1 callback for create

            m1.obj2.merge(mergeObj, true);
            equal (m1.obj2.key2.getValue(), "key2", "old properties remain");
            equal (m1.obj2.key1.getValue(), "new key1Value", "existing property overridden");
            equal (m1.obj2.key3.getValue(), "new key", "new property added");
            equal (callbackCount, 1, "new property added");
        },

        testComplexChangePropertyValue : function () {
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
            var jsonModel = {
                x: 1,
                y: "y",
                obj: {
                    desc: "a New point"
                }
            };

            var m = new Model(jsonModel);
            var notified = false;
            var callback = function (property, oldValue) {
                notified = true;
            };

            m.x.onChange(callback);
            m.x.setValue(2);
            ok(notified, "onChange Callback works");
            notified = false;
            m.x.setValue(5, true); // better way to set value and suppress notification
            ok(!notified, "onChange callback suppressed succesfully");
            equal(m.x.getValue(), 5, "Assignment successful when notification suppressed");
        },

        testPropertyValidation : function () {

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

            var m = new Model(jsonModel);
            m.number.onChange(callback);
            m.bool.onChange(callback);
            m.str.onChange(callback);

            Model.startTransaction();
            m.number.setValue(5);
            m.bool.setValue(true); //should not fire a onChange event since value not changes
            m.str.setValue("new value set in transaction");
            ok(!callbackCalled, "onChange Callback not executed till transaction complete");
            ok(Model.inTransaction(), "Model inTranaction repoting correctly");
            Model.endTransaction();
            ok(!Model.inTransaction(), "Model inTranaction repoting correctly");

            ok(callbackCalled, "onChange Callback called after tranaction ended");
            equal(count, 2, "Expected number of callbacks after transaction completed");
        },

        testBubbleUpEvents : function () {
            var jsonModel = {
                number: 1,
                str: "aString",
                bool: true,
                nil: null,
                undef: undefined,
                fun: function () {return "I am a function";},
                subModel: {
                    subProp: "I am the subProp",
                    subSubModel: {
                        str: "another string"
                    }
                }
            };

            var callbackCalled = false;
            var count = 0;
            var callback = function (property, oldValue) {
                callbackCalled = true;
                count++;
            };

            var m = new Model(jsonModel);
            m.onChange(callback, true);
            m.number.onChange(callback);

            m.number.setValue(5);

            ok(callbackCalled, "Passed");
            equal(count, 2, "EventNotification bubbled up correctly");

            count = 0; //reset counter
            callbackCalled = false;
            m.subModel.onChange(callback, true);
            m.subModel.subProp.setValue("new value");

            ok(callbackCalled, "Passed");
            equal(count, 2, "EventNotification bubbled up correctly");
        },

        testModelClone : function (){
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

            var count = 0;
            function callback(){
                return count++;
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            var clone = model.clone();

            ok (model.number.hasValidator(), "Model has a validator");
            ok (clone.number.hasValidator(), "Clone keeps the validator");
            equal(JSON.stringify(model.toJSON(true)), JSON.stringify(clone.toJSON(true)), "Model.clone looks identical");

            model.number.setValue(-3); // shouldn't pass validator
            model.number.setValue(3);
            equal(count, 1, "Callback not cloned");
            var subModelClone = model.subModel.clone();
            equal(subModelClone.getName(), "/subModel", "Cloned name adjusted");
            equal(subModelClone.subProp.getName(), "/subModel/subProp", "Cloned child properties names adjusted");

        },

        testGetFormattedValue : function() {

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

        testFireOnlyMostRecentPropertyEvent : function (){
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
            var callbackNewValue;
            function callback(property, oldValue){
                count +=1;
                callbackNewValue = property.getValue();
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

            equal(count, 1, "fireOnlyMostRecentPropertyEvent does suppress all but 1 onChangeEvent");
            equal(callbackNewValue, 4, "fireOnlyMostRecentPropertyEvent onChange event is the most recent");

            //test on Model
            count = 0; //reset counter
            model.subModel.onChange(callback, true);
            Model.startTransaction();
            model.subModel.subProp.setValue("new subProp value1");
            model.subModel.subProp.setValue("new subProp value2");
            model.subModel.subProp.setValue("new subProp value3");
            Model.endTransaction();

            equal(count, 1, "fireOnlyMostRecentPropertyEvent does suppress all but 1 onChangeEvent");

            count = 0;
            Model.startTransaction();
            model.subModel.subProp.setValue("new subProp value");
            model.subModel.fun.setValue("replace function with string");
            Model.endTransaction();
            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = false; //restore

            // This is what I expect. 2 different properties change but same callback called
            equal(count, 2, "fireOnlyMostRecentPropertyEvent does not effect bubbled events");
        },

        testFlattenCallbacks : function (){
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
                count +=1;
            }
            var count2 = 0;
            function callback2(property, oldValue){
                count2 +=1;
            }

            var model = new Model(jsonModel);
            model.number.onChange(callback);
            model.subModel.onChange(callback, true);
            model.subModel.subProp.onChange(callback);
            model.str.onChange(callback2);

            Model.TRANSACTION_OPTIONS.flattenCallbacks = true;

            Model.startTransaction();
            model.number.setValue(3);
            model.subModel.subProp.setValue("value Changed");
            model.str.setValue("new Value");
            Model.endTransaction();

            equal(count, 1, "onChange callback called once, even though registared on different porperties");
            equal(count2, 1, "onChange callback2 called once because different than other callback");
            Model.TRANSACTION_OPTIONS.flattenCallbacks = false; //restore
        },

        testFlattenCallbacksByHash : function (){
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
                count +=1;
            }
            callback.hash = "uniqueID";
            var count2 = 0;
            function callback2(property, oldValue){
                count2 +=1;
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

            equal(count, 1, "Hashed function called once when flattenCallbacksByHash set");
            equal(count2, 3, " unhashed function called more than once when flattenCallbacksByHash set");
        },

        testSuppressAllEvents : function (){
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
                count +=1;
            }
            var count2 = 0;
            function callback2(property, oldValue){
                count2 +=1;
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

            equal(count, 0, "suppress all fired no events");
            equal(count2, 0, "suppress all fired no events");
            Model.TRANSACTION_OPTIONS.suppressAllEvents = false; //restore
        },

        testModelEndTransactionWithOptions : function () {
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
                count +=1;
            }
            callback.hash = "uniqueID";
            var count2 = 0;
            function callback2(property, oldValue){
                count2 +=1;
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


            equal(count, 1, "Hashed function called once when flattenCallbacksByHash set");
            equal(count2, 3, " unhashed function called more than once when flattenCallbacksByHash set");
            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = false; // test ended restore defaults
            Model.TRANSACTION_OPTIONS.flattenCallbacks = false;
            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = false;
        },

        testModelNoConflict : function () {

            ok (Model, "Model exists in global namespace prior to noConflict");
            var originalModel = Model;
            var myModel = Model.noConflict();

            ok (!Model, "Model remove from global namespace after noConflict called");
            equal(myModel, originalModel, "Model returned from noConflict Method");
            window.Model = myModel; //restore the world so other tests continue to work

        },

        testInvalidInitialValue : function () {
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
                invalidCountable: undefined,
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

        testGetMetadataMethod : function (){
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

        testCustomEvent : function (){
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

            var callbackCalled = 0;
            function callback (property, arg) {
                var a = arguments;
                callbackCalled++;
                equal(arg, "bar", "correct argument passed to callback");
                equal(property, model.str, "callback property argument is the property event was triggered on");
                equal(this, model.str, "callback this is the property event was triggered on");
            }

            model.str.on("foo", callback);
            ok(callbackCalled === 0);
            model.str.trigger("bar", "bar");
            ok(callbackCalled === 0);
            model.str.trigger("foo", "bar");
            ok(callbackCalled === 1);
            function fourArgsCallback() {
                ok (arguments.length === 4);
            }
            model.str.on("fourArgsCallback", fourArgsCallback);
            //first arg is always the property.
            model.str.trigger("fourArgsCallback", "a", "b", "c");

            callbackCalled = 0;
            function numberCallback (property, arg) {
                callbackCalled++;
            }

            model.number.on("foo", numberCallback); //registar same callback twice
            model.number.on("foo", numberCallback);
            model.number.trigger("foo", "bar");
            ok(callbackCalled === 2, "same event registered twice");

            callbackCalled = 0;
            model.number.off("foo", numberCallback); // should remove everything
            model.number.trigger("foo", "bar");
            ok(callbackCalled === 0, "same event registered twice");
         },

        testChildCreatedEvent : function (){
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

            var callbackCalled = false;
            function callback (property, arg){
                equal(JSON.stringify(this.toJSON()), JSON.stringify(model.toJSON()), "creteChildCallback this equals model listener attached too");
                equal(JSON.stringify(property.toJSON()), JSON.stringify(model.toJSON()), "creteChildCallback property argument equals model listener attached too");
                equal(JSON.stringify(arg.getValue()), JSON.stringify(model.newProp.getValue()), "creteChildCallback arg argument equals newly created property");

                callbackCalled = true;
            }

            var model = new Model(jsonModel);
            model.on("childCreated", callback);
            model.createProperty("newProp", "string Prop");

            ok(callbackCalled, "childCreate callback called");

        },

        testAllEvent : function () {
            var jsonModel = {
                number: 1,
                str: "a string",
                obj: {
                    first: "prop on obj"
                }
            };

            var model = new Model(jsonModel);
            var count = 0;
            function callback(property, originalArg, eventName) {
                var a = arguments;// put breakpoint here to see arguments to callback which depend on event.
                count++;
            }
            model.on(Model.Event.ALL, callback);
            model.number.setValue(10);
            equal(count, 0, "all event does not listen to propegated MODEL_CHANGED events. Only listens to real events.");
            // Do stuff to model. And make sure it works.

            model.createProperty("second", "secondProp");//CHILD_CREATED
            equal(count, 1, "all event Notified of CHILD_CREATED event");

            count = 0;
            model.trigger("knockKnock", "whose", "there", "son");//CUSTOM
            equal(count, 1, "all event Notified of CUSTOM event");

            model.number.on(Model.Event.ALL, callback);

            count = 0;
            model.number.setValue(2); //PROPERTY_CHANGE
            equal(count, 1, "all event Notified of PROPERTY_CHANGE event");

            count = 0;
            model.number.destroy(); // DESTROY/ CHILD_DESTROYED
            equal(count, 2, "all event Notified of DESTROY and CHILD_DESTROYED event");
        },

        testDoNotPersist : function (){
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

        testPropertyArrayLoading : function () {
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

        testPropertyArray : function (){

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
                callbackCount++;
            }

            function childCreatedCallback(property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                childCreatedCallbackCount++;
            }
            function childDestroyedCallback (property, arg){
                var a = arguments.length; // put breakpoint here to see arguments
                childDestroyedCallbackCount++;
            }

            model.oArray.onChange(changeCallback);
            model.oArray.on(Model.Event.CHILD_CREATED, childCreatedCallback);
            model.oArray.on(Model.Event.CHILD_DESTROYED, childDestroyedCallback);

            childCreatedCallbackCount = 0;
            model.oArray.push(3,2,8,4,10);
            arrayPrimitiveValue.push(3,2,8,4,10);
            ok (testPropertyArrayOnlyContainsProperties(model.oArray), "Property Array contains only Properties");
            equal(childCreatedCallbackCount, 5, "pusing multiple item cause a CHILD_CREATED event for each item");
            equal(model.oArray.length, 8, "test Array post push length");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "push() works as expected");


            childDestroyedCallbackCount = 0;
            model.oArray.pop();
            arrayPrimitiveValue.pop();
            equal(model.oArray.length, 7, "test Array post pop length");
            equal(childDestroyedCallbackCount, 1, "pop results in one CHILD_DESTROYED event.");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "pop() works as expected");

            childDestroyedCallbackCount = 0;
            model.oArray.shift();
            arrayPrimitiveValue.shift();
            equal(childDestroyedCallbackCount, 1, "shift results in one CHILD_DESTROYED event.");
            equal(model.oArray.length, 6, "Shift remove element from array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "shift() works as expected");

            childCreatedCallbackCount = 0;
            model.oArray.unshift(1,2); // needs to creat proper properties to insert.
            arrayPrimitiveValue.unshift(1,2);
            equal(childCreatedCallbackCount, 2, "unshift results in one CHILD_CREATED event per element.");
            equal(model.oArray.length, 8, "Unshift adds elements to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "unshift() works as expected");

            callbackCount = 0;
            model.oArray.sort();
            arrayPrimitiveValue.sort();
            equal(callbackCount, 1, "Sort fires a change event.");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "sort() works as expected");

            callbackCount = 0;
            model.oArray.reverse();
            arrayPrimitiveValue.reverse();
            equal(callbackCount, 1, "Sort fires a change event.");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "reverse() works as expected");

            childDestroyedCallbackCount = 0;
            model.oArray.splice(1,1); // removes the second element.
            arrayPrimitiveValue.splice(1,1);
            equal(childDestroyedCallbackCount, 1, "splice(1,1) results in one CHILD_DESTROYED event.");
            equal(model.oArray.length, 7, "Unshift adds elements to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "unshift() works as expected");

            childCreatedCallbackCount = 0;
            model.oArray.splice(1, 0, 99); // adds 99 to index 2.
            arrayPrimitiveValue.splice(1, 0, 99);
            equal(childCreatedCallbackCount, 1, "splice(1,0,99) results in one CHILD_DESTROYED event.");
            equal(model.oArray.length, 8, "Unshift adds elements to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "unshift() works as expected");

            childCreatedCallbackCount = 0;
            childDestroyedCallbackCount = 0;
            model.oArray.splice(1, 1, 25); // removes the second element, to add 99, this function changes the value rather than do a destroy and create
            arrayPrimitiveValue.splice(1, 1, 25);
            equal(childCreatedCallbackCount, 0, "splice(1,0,99) results in one CHILD_DESTROYED event.");
            equal(childDestroyedCallbackCount, 0, "splice(1,0,99) results in one CHILD_DESTROYED event.");
            equal(model.oArray.length, 8, "Unshift adds elements to array");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(arrayPrimitiveValue), "unshift() works as expected");

            callbackCount = 0;
            childDestroyedCallbackCount = 0;
            var newValue = [9, 8, 7];
            model.oArray.setValue(newValue);
            equal(model.oArray.length, 3, "test Array setValue updates length");
            equal(JSON.stringify(model.oArray.getValue()), JSON.stringify(newValue), "test Array setValue works as expected");
            equal(callbackCount, 1, "setValue fires a PROPERTY_CHANGE event.");
            equal(childDestroyedCallbackCount, 5, "setValue will call destroy on excess.");

            var modelChangeCallbackCount = 0;
            model.oArray.on(Model.Event.MODEL_CHANGE, function modelChanged (property, oldValue) {
                var a = arguments.length; // put breakpoint here to see arguments
                modelChangeCallbackCount++;
            });

            modelChangeCallbackCount = 0;
            var prop = Model.find(model, "/root/oArray/0");
            equal(prop.getValue(), 9, "test Model.find with array's");
            model.oArray.setValueAt(0, 12);
            equal(model.oArray[0].getValue(), 12, "test Array setValueAt");
            equal(modelChangeCallbackCount, 1, "setValue fires a MODEL_CHANGE event on array.");
            // The following is a limitation we currently have. String doesn't get converted into a property
            //model.oArray[0] = "Inserted value by index";
        },

        testLinkingModels : function () {

            var model = new Model({a:1, b:"str", c:100, d:300, e:"prop"}, {name: "a"});
            var model2 = model.clone();

            var disconnectModel = Model.connect(model, model2);
            var disconnectA = Model.connect(model.a, model2.a);
            var disconnectE = Model.connect(model.e, model2.e);

            model.createProperty("anotherProp", "anotherValue", {random:1});
            ok(model2.anotherProp, " linked model received CHILD_CREATED event");

            model.e.destroy();
            ok(!model2.e, " linked model received CHILD_DESTROYED event");

            model.a.setValue(10);
            equal(model2.a.getValue(), 10, " linked model received PROPERTY_CHANGE event");

            model2.a.setValue(15);
            equal(model.a.getValue(), 15, " linked model received PROPERTY_CHANGE event in other direction");

            var customEventOnModel2fired = false;
            model2.a.on("customEvent", function () {
                customEventOnModel2fired = true;
            });
            model.a.trigger("customEvent");
            ok(customEventOnModel2fired, " linked model received custom event");

            disconnectA();
            model.a.setValue(5);
            equal(model2.a.getValue(), 15, " models were disconnected successfully");

            //test "oneWay" direction
            Model.connect(model.b, model2.b, {direction:"oneWay"});
            model.b.setValue(123);
            equal(model2.b.getValue(), 123, "Forward event propagates");
            model2.b.setValue(987);
            equal(model.b.getValue(), 123, "OneWay does not propagate in reverse direction");


            var testCallbackSourceCalled = false;
            function testCallbackSource() {
                testCallbackSourceCalled = true;
            }
            var testCallbackDestCalled = false;
            function testCallbackDest() {
                testCallbackDestCalled = true;
            }

            /** test black listed events **/
            var blackListedEventCallbackCalledOnSource = false;
            function blackListedEventCallback () {
                blackListedEventCallbackCalledOnSource = true;
            }
            var blackListedEventCallbackCalledOnDest = false;
            function blackListedEventCallback2 () {
                blackListedEventCallbackCalledOnDest = true;
            }

            Model.connect(model.c, model2.c, {eventBlackList:"blackListedEvent"});
            model.c.on("blackListedEvent", blackListedEventCallback);
            model.c.on("test", testCallbackSource);
            model2.c.on("blackListedEvent", blackListedEventCallback2);
            model2.c.on("test", testCallbackDest);

            //blacklisted event should not propagate
            model.c.trigger("blackListedEvent");
            ok(blackListedEventCallbackCalledOnSource, "blackListedEvent fired on Source Property");
            ok(!blackListedEventCallbackCalledOnDest, "blackListedEvent does not propagated to connected Property");

            blackListedEventCallbackCalledOnSource = false;
            model2.c.trigger("blackListedEvent");
            ok(blackListedEventCallbackCalledOnDest, "blackListedEvent fired on Destination Property");
            ok(!blackListedEventCallbackCalledOnSource, "blackListedEvent does not propagated to connected Property");

            // test is not blacklisted so should propagate
            model.c.trigger("test");
            ok(testCallbackSourceCalled, "non black listed event still fired");
            ok(testCallbackDestCalled, "non black listed event still fired");
            testCallbackSourceCalled = testCallbackDestCalled = false;

            model2.c.trigger("test");
            ok(testCallbackSourceCalled, "non black listed event still fired");
            ok(testCallbackDestCalled, "non black listed event still fired");

            /** Test white listed Events **/
            var whiteListedEventCallbackCalledOnSource = false;
            function whiteListedEventCallback () {
                whiteListedEventCallbackCalledOnSource = true;
            }
            var whiteListedEventCallbackCalledOnDest = false;
            function whiteListedEventCallback2 () {
                whiteListedEventCallbackCalledOnDest = true;
            }

            Model.connect(model.d, model2.d, {eventWhiteList:"whiteListedEvent"});
            model.d.on("whiteListedEvent", whiteListedEventCallback);
            model.d.on("test", testCallbackSource);
            model2.d.on("whiteListedEvent", whiteListedEventCallback2);
            model2.d.on("test", testCallbackDest);

            testCallbackSourceCalled = testCallbackDestCalled = false;
            model.d.trigger("test");
            ok(testCallbackSourceCalled, "test is triggered on Source");
            ok(!testCallbackDestCalled, "test is not on the white listed so not propagated");
            testCallbackSourceCalled = false;

            model2.d.trigger("test");
            ok(testCallbackDestCalled, "test is triggered on Destination");
            ok(!testCallbackSourceCalled, "test is not on the white listed so not propagated");
            testCallbackDestCalled = false;


            model.d.trigger("whiteListedEvent");
            ok(whiteListedEventCallbackCalledOnDest, "blackListedEvent fired on Destination Property");
            ok(whiteListedEventCallbackCalledOnSource, "blackListedEvent does not propagated to connected Property");
            whiteListedEventCallbackCalledOnDest = whiteListedEventCallbackCalledOnDest = false;

            model2.d.trigger("whiteListedEvent"); // other direction
            ok(whiteListedEventCallbackCalledOnDest, "blackListedEvent fired on Destination Property");
            ok(whiteListedEventCallbackCalledOnSource, "blackListedEvent does not propagated to connected Property");
            whiteListedEventCallbackCalledOnDest = whiteListedEventCallbackCalledOnDest = false;

            // test arrays.
            var arrayModel = new Model({arr: [1,2,3]});
            var arrayModel2 = new Model({arr: [4,5,6]});
            arrayModel.arr[0].getValue();
            Model.connect(arrayModel.arr, arrayModel2.arr);
            arrayModel.arr.push(2);
            equal(arrayModel2.arr.length, 4, "push propagated to linked Array");

            arrayModel.arr.pop();
            equal(arrayModel2.arr.length, 3, "pop propagated to linked Array");

            arrayModel.arr.shift();
            equal(arrayModel2.arr.length, 2, "shift propagated to linked Array");
        },

        testLinkingEntireModels : function () {

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
            equal(model2.a.getValue(), 1234, "Direct children linked");

            model.d.g.setValue(567);
            equal(model2.d.g.getValue(), 567, "indirect children linked");

            model.d.arr.pop();
            equal(model.d.arr.length, model2.d.arr.length, "arrays linked");

            disconnectModel();

            model.a.setValue(999);
            model.d.g.setValue(999);
            equal(model2.a.getValue(), 1234, "linked properties disconnected correctly");
            equal(model2.d.g.getValue(), 567, "linked properties disconnected correctly");

            var model3 = new Model({ linktoA: "not Linked", linktoG:1});

            var mapFunction = function (input) {
                var map = {
                    "/a/a":"/root/linktoA",
                    "/a/d/g": "/root/linktoG"
                };
                return map[input];
            };
            var disconnectModel2 = Model.connect(model, model3, {
                includeChildren: true,
                mapFunction: mapFunction
            });

        },

        testModelFind : function () {
            var json = {
                prop1:"prop1",
                subProp1:{
                    prop1: "prop1-l2",
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

    ModelTests.asyncTests = {
                testRemoteModel : function () {

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

                var onChangeRegistered = false;
                function callback (property, oldValue) {
                    onChangeRegistered = true;
                }
                test.remoteModel.onChange(callback);

                ok(!test.remoteModel.count, "remoteModel count property DNE");
                setTimeout(function () {
                    start();
                    ok(test.remoteModel.query, "remoteModel was modified to have a count property");
                    ok(onChangeRegistered, "onChange callback fired on remote Model");

                }, 2500);

            }
    };

   if (typeof define === "function" && define.amd) {
        define([], function () { 
            return ModelTests;
        });
    } else if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = ModelTests;
        }
        exports.Model = ModelTests;
    } else {
        /** @global */
        window["ModelTests"] = ModelTests;
    }
}(this)); //this === window in the browser and GLOBAL in node