test("testPrimitiveSaveLoad", function () {

    var jsonModel = { number: 1,
        str : "aString",
        bool : true,
        nil: null,
        undef: undefined,
        fun: function () {return true;}
    };


    var m = new Model(jsonModel);

    deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(jsonModel), "Model From JSON and back equal");
});

test("testObjectsSaveLoad", function () {
    var jsonModel = {   number: 1,
                        str : "aString",
                        subModel: {
                            str2: "string2"
                        }
                    };
    var m = new Model(jsonModel);
    deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(jsonModel));
});

test("testComplexSaveLoad", function () {

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

});

test("testPrimitiveSetGet", function () {

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
});

test("testGetNameMethod", function () {

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
});

test("testOnChangeCallbackWhenSettingToSameValue", function () {
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
    m.number.setValue(2);
    m.number.setValue(3);
    m.number.setValue(3); // value is the same should not fire a change

    equal(count, 2, "onChangeEvent only fires when OldValue != newValue");
});


test("testModelCreationUsingCreatePropertyMethod", function () {
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
});

test("testPropertyDestroyMethod", function() {

    var jsonModel = {
        number: 1,
        str : "aString",
        x: function () {return "I am function x";},
        subModel: {
            str2: "string2",
            f: function () {return "I am a function";}
        }
    };

    var deleteCallbackCalled = false;
    function deleteCallback(oldValue, property) {
        deleteCallbackCalled = true;
    }

    var model = new Model(jsonModel);
    ok(model.number);
    model.number.onDestroy(deleteCallback);
    model.number.destroy();
    ok(!model.number, "number Property no longer exists it was destroyed");
    ok(deleteCallbackCalled, "destroy callback called");

    model.subModel.destroy();
    ok(!model.subModel, "SubModel Property no longer exists it was destroyed");

});

test("testModelMergeMethod", function () {
     var modelJSON = {
        x: 1,
        y: "y",
        obj: {

            desc: "an obj property name desc"
        },
        obj2: {
            key1: "key1",
            key2: "key2",
            subModel : {v1: "value1", v2: "value2"}
        }
    };

    var mergeObj = {
        key1: "new key1Value",
        key3: "new key"
    };

    var m = new Model(modelJSON);
    m.obj2.merge(mergeObj);//keepOldProperties = false
    ok (!m.obj2.key2, "old properties removed");
    equal (m.obj2.key1.getValue(), "new key1Value", "existing property overridden");
    equal (m.obj2.key3.getValue(), "new key", "new property added");

    var m1 = new Model(modelJSON);
    m1.obj2.merge(mergeObj, true);
    equal (m1.obj2.key2.getValue(), "key2", "old properties remain");
    equal (m1.obj2.key1.getValue(), "new key1Value", "existing property overridden");
    equal (m1.obj2.key3.getValue(), "new key", "new property added");

});

/**
 * Shows correct and incorrect ways to use the setValue setter.
 * Note this test will log errors to the console
 * @return {[type]} [description]
 */
test("testComplexChangePropertyValue", function () {
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

    console.log("testComplexChangePropertyValue: 4 errors to console expected");

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
    m.x.setValue(2);
    ok(notified, "onChange Callback works");
    notified = false;
    m.x.setValue(5, true); // better way to set value and suppress notification
    ok(!notified, "onChange callback suppressed succesfully");
    equal(m.x.getValue(), 5, "Assignment successful when notification suppressed");
});

test("testPropertyValidationFunction", function () {

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
});


test("testSaveLoadWithMetaData", function () {

    var expectedJSON = {
        x: {num: 1},
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
    m.createProperty("x", {num: 1}, {validator: validateX});

    equal(JSON.stringify(m.toJSON(true)), JSON.stringify(expectedJSON), "JSON with metadata is as expected");

    var m2 = new Model(expectedJSON);
    ok(m2.x.hasValidator(), "Loading Model using JSON w/ metadata keeps the validator");
    ok(!m2.x.validateValue(-1) && m2.x.validateValue(2), "loaded json validator functions correctly");
    equal(JSON.stringify(m2.toJSON(true)), JSON.stringify(expectedJSON), "Loading Model from JSON with metadata and saving back to JSON equal");
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
    var callback = function (oldValue, newValue, propertyName) {
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
});

test("testBubbleUpEvents", function () {
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
    var callback = function (oldValue, newValue, propertyName) {
        callbackCalled = true;
        count++;
    };

    var m = new Model(jsonModel);
    m.onChange(callback, {listenToChildren: true});
    m.number.onChange(callback);

    m.number.setValue(5);

    ok(callbackCalled, "Passed");
    equal(count, 2, "EventNotification bubbled up correctly");

    count = 0; //reset counter
    callbackCalled = false;
    m.subModel.onChange(callback, {listenToChildren: true});
    m.subModel.subProp.setValue("new value");

    ok(callbackCalled, "Passed");
    equal(count, 2, "EventNotification bubbled up correctly");
});

test("testModelClone", function (){
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

});

test("testSuppressPreviousPropertyChangeEventsEventOptimization", function (){
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
    function callback(oldValue, newValue, propertyName){
        count +=1;
        callbackNewValue = newValue;
    }

    var model = new Model(jsonModel);
    //lets registar a bunch of onChangeListeners.
    model.number.onChange(callback);

    Model.eventOptimization.suppressPreviousPropertyChangeEvents = true;
    Model.startTransaction();
    //Lets change number multiple time. should only be called once with last value of change
    model.number.setValue(2);
    model.number.setValue(3);
    model.number.setValue(4);
    Model.endTransaction();

    equal(count, 1, "suppressPreviousPropertyChangeEvents does suppress all but 1 onChangeEvent");
    equal(callbackNewValue, 4, "suppressPreviousPropertyChangeEvents onChange event is the most recent");

    //test on Model
    count = 0; //reset counter
    model.subModel.onChange(callback, {listenToChildren: true});
    Model.startTransaction();
    model.subModel.subProp.setValue("new subProp value1");
    model.subModel.subProp.setValue("new subProp value2");
    model.subModel.subProp.setValue("new subProp value3");
    Model.endTransaction();

    equal(count, 1, "suppressPreviousPropertyChangeEvents does suppress all but 1 onChangeEvent");

    count = 0;
    Model.startTransaction();
    model.subModel.subProp.setValue("new subProp value");
    model.subModel.fun.setValue("replace function with string");
    Model.endTransaction();
    Model.eventOptimization.suppressPreviousPropertyChangeEvents = false; //restore

    // This is what I expect. 2 different properties change but same callback called
    equal(count, 2, "suppressPreviousPropertyChangeEvents does not effect bubbled events");
});

test("testSingleCallbackEventOptimization", function (){
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
    function callback(oldValue, newValue, propertyName){
        count +=1;
    }
    var count2 = 0;
    function callback2(oldValue, newValue, propertyName){
        count2 +=1;
    }

    var model = new Model(jsonModel);
    model.number.onChange(callback);
    model.subModel.onChange(callback, {listenToChildren: true});
    model.subModel.subProp.onChange(callback);
    model.str.onChange(callback2);

    Model.eventOptimization.enableSingleCallbackCall = true;

    Model.startTransaction();
    model.number.setValue(3);
    model.subModel.subProp.setValue("value Changed");
    model.str.setValue("new Value");
    Model.endTransaction();

    equal(count, 1, "onChange callback called once, even though registared on different porperties");
    equal(count2, 1, "onChange callback2 called once because different than other callback");
    Model.eventOptimization.enableSingleCallbackCall = false; //restore
});

test("testEnableCallbackHashOpimization", function (){
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
    function callback(oldValue, newValue, propertyName){
        count +=1;
    }
    callback.hash = "uniqueID";
    var count2 = 0;
    function callback2(oldValue, newValue, propertyName){
        count2 +=1;
    }

    var model = new Model(jsonModel);
    model.number.onChange(callback);
    model.number.onChange(callback2);
    model.subModel.onChange(callback, {listenToChildren: true});
    model.subModel.onChange(callback2, {listenToChildren: true});
    model.subModel.subProp.onChange(callback);
    model.subModel.subProp.onChange(callback2);

    Model.eventOptimization.enableCallbackHashOpimization = true;

    Model.startTransaction();
    model.number.setValue(3);
    model.subModel.subProp.setValue("value Changed");
    model.str.setValue("new Value");
    Model.endTransaction();
    Model.eventOptimization.enableCallbackHashOpimization = false;

    equal(count, 1, "Hashed function called once when enableCallbackHashOpimization set");
    equal(count2, 3, " unhashed function called more than once when enableCallbackHashOpimization set");
});

test("testModelEndTransactionWithOptions", function () {
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
    function callback(oldValue, newValue, propertyName){
        count +=1;
    }
    callback.hash = "uniqueID";
    var count2 = 0;
    function callback2(oldValue, newValue, propertyName){
        count2 +=1;
    }

    var model = new Model(jsonModel);
    model.number.onChange(callback);
    model.number.onChange(callback2);
    model.subModel.onChange(callback, {listenToChildren: true});
    model.subModel.onChange(callback2, {listenToChildren: true});
    model.subModel.subProp.onChange(callback);
    model.subModel.subProp.onChange(callback2);

    Model.eventOptimization.enableCallbackHashOpimization = true; // to start change defaults
    Model.eventOptimization.enableSingleCallbackCall = true;
    Model.eventOptimization.suppressPreviousPropertyChangeEvents = true;

    Model.startTransaction();
    model.number.setValue(3);
    model.subModel.subProp.setValue("value Changed");
    model.str.setValue("new Value");
    Model.endTransaction({
        enableCallbackHashOpimization: true,
        enableSingleCallbackCall: false,
        suppressPreviousPropertyChangeEvents: false
    });

    ok(Model.eventOptimization.enableCallbackHashOpimization, "global event setting restore after endTransaction with options");
    ok(Model.eventOptimization.enableSingleCallbackCall, "global event setting restore after endTransaction with options");
    ok(Model.eventOptimization.suppressPreviousPropertyChangeEvents, "global event setting restore after endTransaction with options");


    equal(count, 1, "Hashed function called once when enableCallbackHashOpimization set");
    equal(count2, 3, " unhashed function called more than once when enableCallbackHashOpimization set");
    Model.eventOptimization.enableCallbackHashOpimization = false; // test ended restore defaults
    Model.eventOptimization.enableSingleCallbackCall = false;
    Model.eventOptimization.suppressPreviousPropertyChangeEvents = false;
});

test("testModelNoConflict", function () {

    ok (Model, "Model exists in global namespace prior to noConflict");
    var originalModel = Model;
    var myModel = Model.noConflict();

    ok (!Model, "Model remove from global namespace after noConflict called");
    equal(myModel, originalModel, "Model returned from noConflict Method");
    window.Model = myModel; //restore the world so other tests continue to work

});

test("testGetMetadataMethod", function (){
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
});

test("testDoNotPresist", function (){
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

    var doNotPresistNumberPropertyJSON = {
            number: null,
            number__modeljs__metadata: {
                doNotPresist: true
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

    model.number.getMetadata().doNotPresist = true;
    equal(JSON.stringify(model.toJSON(true)), JSON.stringify(doNotPresistNumberPropertyJSON), "metadata serialized correctly");
    delete model.number.getMetadata().doNotPresist; // restore original

    var doNotPresistObjectPropertyJSON = {
            number: 1,
            str: "aString",
            bool: true,
            nil: null,
            undef: undefined,
            fun: function () {return "I am a function";},
            subModel: {},
            subModel__modeljs__metadata: {
                doNotPresist: true
            }
        };

    model.subModel.getMetadata().doNotPresist = true;
    equal(JSON.stringify(model.toJSON(true)), JSON.stringify(doNotPresistObjectPropertyJSON), "metadata serialized correctly");
});

asyncTest("remoteModel", function () {

    expect(3);
    var test = new Model();
    test.createProperty ("remoteModel", {prop1: "defaultValue"}, {
        url: "http://search.twitter.com/search.json?q=tennis&callback=$jsonpCallback",
        doNotPresist: true,
        refreshRate: -1, // -1 means fetch once.
        isJSONPurl: true,
        validator: function() {
            return true;
        }
    });

    var onChangeRegistered = false;
    function callback (oldValue, newValue, prop) {
        onChangeRegistered = true;
    }
    test.remoteModel.onChange(callback);

    ok(!test.remoteModel.count, "remoteModel count property DNE");
    setTimeout(function () {
        start();
        ok(test.remoteModel.query, "remoteModel was modified to have a count property");
        ok(onChangeRegistered, "onChange callback fired on remote Model");

    }, 2000);

});

test("modlejsTutorial", function (){

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

    console.log("modlejsTutorial: 3 errors to console expected");
    // The next section will talk about events

    /* --- Events --- */
    /** The core responsibility of the Model in the MVC patter is to notify the view when the model changes */
    // using modeljs the you can listen to when any model property value changes by registaring a callback.
    // below is a example of registaring a callback to numberProperty
    var callbackCount = 0;
    function callback (oldValue, newValue){
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
    modelFromJSON.objProperty2.onChange(callback, {listenToChildren: true}); // callback will be called with objProperty2 or it's children change value
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

});