/* jshint undef: true, unused: true */
/* global Model, QUnit, test, asyncTest, expect, start, stop, ok, equal, deepEqual*/

// Usage: in jqueryPage or 'node ./test/nodeTestRunner.js'

"use strict";

var primitiveModel = {
    number: 1,
    str : "aString",
    bool : true,
    nil: null,
    undef: undefined,
    fun: function () {
        return "I am a function property";
    }
};

var functionModel = {
    firstName: "John",
    lastName: "Smith",
    getFullName: function getFullName() {
        return this.firstName + " " + this.lastName;
    },
    addArgs: function add(a, b) {
        return a + b;
    },
    simpleFn: function () {
        return "pass";
    }
};

var modelModels = {
    property: "base level property",
    modelProperty1: {
        prop1: "property1",
        str2: "string2"
    },
    modelProperty2: {
        modelProperty2Property: "a property belonging to subModel",
        modelProperty2SubModel: {
            description: "this property is "
        }
    }
};

var arrayModels = {
    emptyArray: [],
    simpleArray: [3,1,2],
    complexArray: [1, "abc", 2, "def", 3],
    recursiveArray: [["array", "1"], ["array", "2", 2]]
};

var mixedModel = {
    number: 3,
    innerModel: {
        str: "this is a inner Model",
        aFunction: function () {
            return this;
        },
        arr: [1, "two", 3]
    },
    undef: undefined
};

QUnit.module("Model Creation and Persistence");

test("Model creation via constructor", function testPrimitiveSaveLoad() {
    expect(5);

    var emptyModel = new Model();
    deepEqual(emptyModel.getValue(), {}, "empty Constructor is equivalent to new Model({})");

    var m = new Model(primitiveModel);
    equal(primitiveModel.fun(), m.fun.getValue()(), "function property to/from json equal");
    deepEqual(JSON.stringify(m.toJSON()), JSON.stringify(primitiveModel), "properties to/from json");

    var models = new Model(modelModels);
    deepEqual(JSON.stringify(models.toJSON()), JSON.stringify(modelModels), "model to/from json");

    var arrays = new Model(arrayModels);
    deepEqual(JSON.stringify(arrays.toJSON()), JSON.stringify(arrayModels), "Array to/from json");
});

test("Model Creation with metadata", function () {
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
});

test("create thin model", function () {
    var model = new Model(mixedModel, {thin: true});

    // create property should fail
    model.createProperty("subProp", "shouldFail");
    equal(model.subProp, undefined, "Can not create Properties on a Model that is thin");

    deepEqual(JSON.stringify(model.getValue()), JSON.stringify(mixedModel), "getValue still works on thin models");
    deepEqual(JSON.stringify(model.toJSON(true)), JSON.stringify(mixedModel), "toJSON still works on thin models");

    var mergeJson = {
        newProperty: "new"
    };
    model.merge(mergeJson);
    deepEqual(JSON.stringify(model.getValue()), JSON.stringify(mergeJson), "merge still works on thin models");

    var newModel = {
        "propViaSet": "I can be set"
    };
    model.setValue(newModel);
    deepEqual(JSON.stringify(model.getValue()), JSON.stringify(newModel), "setValue still works on thin models");
});

test("Model Creation via createProperty Method", function () {
    expect(8);
    //lets try create the mixed Model
    // use method chaining
    var myMixedModel = new Model();
    myMixedModel.createProperty("number", 3) // regular property
        .createProperty("innerModel", {  // Object
            str: "this is a inner Model",
            aFunction: function test() {
                return this;
            },
            arr: [1, "two", 3]
        })
        .createProperty("undef", undefined); // undefined
    equal(JSON.stringify(myMixedModel.toJSON()), JSON.stringify(mixedModel), "createProperty api can create mixedModel");

    // test creating an array.
    var arrayToCreate = [1, "two", 3];
    var arrayModel = new Model();
    arrayModel.createProperty("theArray", arrayToCreate);
    deepEqual(arrayModel.theArray.getValue(), arrayToCreate, "Array Creation via createProperty Works");


    // show incorrect way of composing model objects
    var incorrectExample = new Model();
    var subModel = new Model();
    subModel.createProperty("desc", "an obj property name desc");

    // Incorrect way to create a Model. Do not directly assign properties like this.
    incorrectExample.obj = subModel;
    equal(incorrectExample.obj.getName(), "/root", "assigning property directly like this results in incorrect property name");
    equal(incorrectExample.obj._parent, null, "assigning property directly like this results in incorrect parent");
    delete incorrectExample.obj;

    // Correct way to create a Model sub object
    var correctExample = new Model();
    correctExample.createProperty("obj", subModel.getValue()); // pass in the json into constructor
    equal(correctExample.obj.getName(), "/root/obj", "assigning property like this results in correct name");
    ok(correctExample.obj._parent, "Model parent is assigned correctly");
    deepEqual(correctExample.obj.toJSON(), subModel.getValue(), "Model Creation from api generates correct JSON");

    // Alternative is to create an empty Object and use setValue to set it
    var correctExample2 = new Model();
    correctExample2.createProperty("obj2", {});
    correctExample2.setValue(subModel.getValue());
    deepEqual(correctExample2.toJSON(), subModel.getValue(), "Model Creation from api generates correct JSON");
});

test("createProperty with invalid initialValue", function (){
    var model = new Model();
    // invalid initial value
    model.createProperty("negativeNumber", 4, {
        validator: function (value) {
            return value < 0;
        }
    });
    equal(model.negativeNumber.getValue(), undefined, "Property created which does not pass it's own validation should be undefined");

    model.createProperty("invalidCountable", {
        str: "123"
    }, {
        validator: function countableObject(value) {
            return value && value.count;
        }
    });
    deepEqual(model.invalidCountable.getValue(), {}, "Model Object created which does not pass it's own validation should be empty '{}'");

});

test("DoNotPersist", function () {
    expect(6);

    var model = new Model(mixedModel);
    // test a property and an array.
    model.number.getMetadata().doNotPersistValue = true;
    model.innerModel.arr.getMetadata().doNotPersistValue = true;

    var modelJSON = model.toJSON(true);
    var recreatedModel = new Model(modelJSON);

    // test property
    equal(modelJSON.number, undefined, "property exists but is undefined because it was flagged as doNotPersist");
    equal(recreatedModel.number.getValue(), undefined, "property exists but is undefined because it was flagged as doNotPersist");
    //equal(recreatedModel.number.getMetadata().doNotPersist, true, "property metadata exists as before too");

    deepEqual(model.number.getMetadata(), recreatedModel.number.getMetadata(), "property metadata exists as before too");

    // test array property
    deepEqual(modelJSON.innerModel.arr, [], "array property exists but is undefined because it was flagged as doNotPersist");
    deepEqual(recreatedModel.innerModel.arr.getValue(), [], "array property exists but is undefined because it was flagged as doNotPersist");
    //equal(recreatedModel.innerModel.arr.getMetadata().doNotPersist, true, "property metadata exists as before too");


    // test Model Property
    model.innerModel.getMetadata().doNotPersistValue = true;
    deepEqual(model.innerModel.toJSON(), {}, "doNotPersist works on Models too, but instead of undefined it's an empty object");
});

test("ModelClone", function () {
    expect(7);
    stop();

    function callback(property){
        equal(property.getValue(), 5, "callback called");
        start();
    }

    var model = new Model(mixedModel);
    model.number.getMetadata().validator = function (value) {
        return value > 0;
    };
    model.number.onChange(callback);
    var clone = model.clone();

    ok (model.number.hasValidator(), "Model has a validator");
    ok (clone.number.hasValidator(), "Clone keeps the validator");
    equal(JSON.stringify(model.toJSON(true)), JSON.stringify(clone.toJSON(true)), "Model.clone looks identical");

    model.number.setValue(-6); // shouldn't pass validator thus callback not called
    model.number.setValue(5); // should pass and notify the callback

    //same applies to clone
    clone.number.setValue(-5); // shouldn't pass validator
    equal(clone.number.getValue(), 3, "Cloned attributes have the same validator");

    var subModelClone = model.innerModel.clone();
    equal(subModelClone.getName(), "/innerModel", "Cloned name adjusted");
    equal(subModelClone.str.getName(), "/innerModel/str", "Cloned child properties names adjusted");
});

test("ModelMerge", function () {
    stop(5);
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
        start();
    }
    function callback1 (property, arg) {
        // should be called once
        ok (true, "new property added2");
        start();
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
});

QUnit.module("Property Validation");

test("test property validation", function () {
    //createProperty also takes a validator
    var model = new Model();
    model.createProperty("positiveNumber", 2, { // a property with a validator (model.positiveNumber)
        validator: function (value) {
            return value > 0;
        }
    });
    ok(model.positiveNumber.hasValidator(), "'positiveNumber' property was created with a validator");
    equal(model.positiveNumber.getValue(), 2, "value at initial value");
    model.positiveNumber.setValue(5); // assign a valid value
    equal(model.positiveNumber.getValue(), 5, "Assignment Passed because validator passed");
    ok (!model.positiveNumber.validateValue(-1), "Value should not pass the validator");
    model.positiveNumber.setValue(-1); // try it anyways.
    equal(model.positiveNumber.getValue(), 5, "Assignment failed because value did not pass validator");
});

test("test property validator post creation", function() {
    var model = new Model();
    model.createProperty("prop", 3);
    ok(!model.prop.hasValidator(), "new property has no validator function");
    // set validator post creation
    model.prop.getMetadata().validator = function onlyNegative(value) {
        return value < 0;
    };
    ok(model.prop.hasValidator(), "property now has a validator function");
    ok(!model.prop.validateValue(3), "current value is invalid");
    equal(model.prop.getValue(), 3, "current value unchanged");
    // we don't change the value for the user, but going forward validation is now maintained
    model.prop.setValue(-2);
    model.prop.setValue(3);
    equal(model.prop.getValue(), -2, "validation effective");
});

test("Model.isProperty", function () {

    var model = new Model(primitiveModel);
    // Properties are the basic primitives
    ok(Model.isProperty(model.number), "number is modeled as a Property");
    ok(Model.isProperty(model.str), "string i modeled as a Property");
    ok(Model.isProperty(model.bool), "boolean is modeled as a Property");
    ok(Model.isProperty(model.nil), "nil i modeled as a Property");
    ok(Model.isProperty(model.undef), "undefined is modeled as a Property");
    ok(Model.isProperty(model.fun), "function is modeled as a Property");

    var anotherModel = new Model(mixedModel);
    ok(!Model.isProperty(anotherModel.innerModel), "A object literal is not is not a Property");
    ok(Model.isProperty(anotherModel.innerModel.arr), "A array treated as a Property");
    ok(Model.isProperty(anotherModel.innerModel.arr[0]), "A array values are treated as defined thus far Property");
});

QUnit.module("Function Property");

test("Function property context", function testFnPropertyContext() {
    var fnModel = new Model(functionModel);
    equal(fnModel.getFullName.getValue()(), "John Smith", "function property 'this' context bound to Object");
});

test("Function property arguments marshaled", function testFnPropertyArgument() {
    var fnModel = new Model(functionModel);
    equal(fnModel.addArgs.getValue()(3,4), 7, "function arguments marshaled");
});

QUnit.module("Property value");

test("Property setValue", function testPrimitiveSetGet() {
    var m = new Model(primitiveModel);
    equal(m.str.getValue(), primitiveModel.str, "retrieving simple Model values are correct upon initialization");
    m.str.setValue(1); // change some values
    equal(m.str.getValue(), 1, "retrieving property recently set");
});

test("Property setValue undefined", function () {
    // property value can only be undefined when it is first created
    var model = new Model(mixedModel);
    equal(model.undef.getValue(), undefined, "can initialize property as undefined");
    model.undef.setValue("defined");
    equal(model.undef.getValue(), "defined", "can change value of property from undefined");
    model.undef.setValue(undefined);
    equal(model.undef.getValue(), "defined", "cannot set defined property value to undefined");

    model.innerModel.setValue(undefined);
    notDeepEqual(model.innerModel.getValue(), undefined, "cannot set defined model value back to undefined");

    model.innerModel.arr.setValue(undefined);
    notDeepEqual(model.innerModel.arr.getValue(), undefined, "cannot set defined array value back to undefined");
});

test("Model setValue", function () {
    var models = new Model(modelModels);
    deepEqual(models.modelProperty1.getValue(), modelModels.modelProperty1, "retrieving simple Model values are correct upon initialization");
    var newProp = {
        newProp: "new"
    };
    models.modelProperty1.setValue(newProp);
    deepEqual(models.modelProperty1.getValue(), newProp, "model property get/setValue");
});

test("Array setValue", function () {
    var arrayModel = new Model(arrayModels);
    deepEqual(arrayModel.complexArray.getValue(), arrayModels.complexArray, "array value correct upon initialization");
    var newValue = [3,2,"one"];
    arrayModel.complexArray.setValue(newValue);
    deepEqual(arrayModel.complexArray.getValue(), newValue, "array get/setValue");
});

test("incorrect setValue usage", function () {
    var model = new Model(mixedModel);

    //setting a model to a property should fail.
    model.number.setValue({
        prop: "this is an obj property",
        prop2: "setting it to a Property should fail"
    });

    equal(model.number.getValue(), mixedModel.number, "setting a property to a model directly should do nothing");

    //setting a model to a property should fail
    var newValue = "s string property";
    model.innerModel.setValue(newValue);
    equal(JSON.stringify(model.innerModel.getValue()), JSON.stringify(mixedModel.innerModel), "setting a model to a property directly should do nothing");

    var modelToTest = new Model(modelModels);
    modelToTest.modelProperty2.setValue({
        modelProperty2Property: {
            attempt: "a invalid change since modelProperty2Property is property, can't convert it to a model"
        },
        modelProperty2SubModel: {
            description: "a valid change"
        }
    });
    equal(JSON.stringify(modelToTest.getValue()), JSON.stringify(modelModels), "setting a property to a model indirectly should do nothing");

    modelToTest.modelProperty2.setValue({
        modelProperty2Property: "a valid change",
        modelProperty2SubModel: "a invalid change because this was originally a obj"
    });
    equal(JSON.stringify(modelToTest.getValue()), JSON.stringify(modelModels), "setting a model to a property indirectly should do nothing");

});

test("FormattedValue", function() {
    expect(4);
    // global formatter
    Model.Formatter = function (value) {
        if (typeof value ==='string'){
            return value.toUpperCase();
        }
        return value;
    };

    var json = {
        str: "unformattedString",
        str2: "another string",
        str2__modeljs__metadata: { //local formatter
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

    equal(model.str2.getValue(), "another string", "getValue return the raw value regardless of Formatters defined");
    equal(model.str2.getFormattedValue(), "localFormatedResult", "Formatter in metadata takes precedence over global Formatter");

    Model.Formatter = undefined; //restore formatter
});

QUnit.module("Property Name");

test("testGetNameMethod", function () {
    expect(10);

    var m = new Model(mixedModel);
    equal(m.getName(), "/root");
    equal(m.number.getName(), "/root/number");
    equal(m.innerModel.getName(), "/root/innerModel");
    equal(m.innerModel.aFunction.getName(), "/root/innerModel/aFunction");

    // passing in a name to our model changes the default of root.
    var m2 = new Model(mixedModel, {name: "test"});
    equal(m2.getName(), "/test");
    equal(m2.number.getName(), "/test/number");
    equal(m2.innerModel.getName(), "/test/innerModel");
    equal(m2.innerModel.aFunction.getName(), "/test/innerModel/aFunction");

    // test short name ability
    equal(m2.number.getName(true), "number");
    equal(m2.innerModel.aFunction.getName(true), "aFunction");

});

test("Model.find", function () {
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
    equal(Model.find(rootModel, "/root/subProp1/doesNotExist/a"), null, "Searching for non-existent property returns null");

    equal(Model.find(rootModel, rootModel.subProp1.arr[1].getName()).getValue(), "value2", "search within a array");
    equal(Model.find(rootModel, "/root/subProp1/arr/1").getValue(), "value2", "search within a array");
});

test("Metadata", function () {
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
});

QUnit.module("Events");

test("Synchronous Events", function () {
    expect(2);
    var oldAsyncValue = Model.asyncEvents;
    Model.asyncEvents = false;

    var model = new Model(mixedModel);
    var eventFired = false;
    model.on("CUSTOM_EVENT", function () {
        eventFired = true;
        ok(true);
    });

    model.trigger("CUSTOM_EVENT");
    ok(eventFired, "Synchronous events fires immediately");
    Model.asyncEvents = oldAsyncValue;
});

asyncTest("Asynchronous Events", function () {
    expect(2);

    var oldAsyncValue = Model.asyncEvents;
    Model.asyncEvents = true;

    var model = new Model(mixedModel);
    var eventFired = false;
    model.on("CUSTOM_EVENT", function () {
        eventFired = true;
        ok(true, "Custom Event Fired");
        start();
    });

    model.trigger("CUSTOM_EVENT");
    ok(!eventFired, "Asynchronous event does not get fired until Synchronous code completes");

    Model.asyncEvents = oldAsyncValue;
});

test("PROPERTY_CHANGED Event", function () {
    expect(3);
    stop(1);

    var model = new Model(mixedModel);
    var numberInitValue = model.number.getValue();
    function changeListener (property, previousValue) {
        equal(previousValue, numberInitValue, "second argument to PROPERTY_CHANGED event is previousValue");
        equal(this, model.number, "second argument to PROPERTY_CHANGED event is previousValue");
        equal(property, model.number, "second argument to PROPERTY_CHANGED event is previousValue");

        start();
    }

    model.number.onChange(changeListener);
    model.number.setValue(numberInitValue + 1);
});

test("Suppress PROPERTY_CHANGED Event Notification", function () {
    expect(1);
    // make event in this test asynchronous for ease of testing. especially with expect(0)
    var oldAsyncValue = Model.asyncEvents;
    Model.asyncEvents = false;

    var model = new Model(mixedModel);
    function changeListener() {
        ok(false); // should not hit this
    }

    model.onChange(changeListener);
    model.number.onChange(changeListener); //property
    model.innerModel.onChange(changeListener); // model
    model.innerModel.arr.onChange(changeListener); // array

    model.number.setValue("str", true);
    model.innerModel.arr.setValue(["i", "changed"], true);
    model.innerModel.setValue({ prop: "str"}, true);

    equal(model.number.getValue(), "str", "change was applied");
    //restore asyncEvent value
    Model.asyncEvents = oldAsyncValue;
});

test("PROPERTY_CHANGED Notifications not fired if value unchanged", function () {
    expect(0);
    // make event in this test asynchronous for ease of testing. especially with expect(0)
    var oldAsyncValue = Model.asyncEvents;
    Model.asyncEvents = false;

    var model = new Model(mixedModel);
    function changeListener() {
        ok(false); // should not hit this
    }

    model.onChange(changeListener);
    model.number.onChange(changeListener); //property
    model.innerModel.onChange(changeListener); // model
    model.innerModel.arr.onChange(changeListener); // array

    // setting values to same should not fire change event
    model.number.setValue(mixedModel.number);
    model.innerModel.arr.setValue(mixedModel.innerModel.arr);
    model.innerModel.setValue(mixedModel.innerModel);

    //restore asyncEvent value
    Model.asyncEvents = oldAsyncValue;
});

test("MODEL_CHANGED Event aka BubbledUp PROPERTY_CHANGED event", function () {
    expect(6);
    stop(6);

    var rootCallback = function (property, oldValue) {
        // should be called twice
        ok(true, "Root notified of Change to" + property.getName());
        start();
    };

    var numberCallback = function (property, oldValue) {
        equal(oldValue, 3, "Number Changed event fired");
        start();
    };

    var innerModelCallback = function (property, oldValue) {
        ok(true, "InnerModel notified of Change to" + property.getName());
        start();
    };


    var model = new Model(mixedModel);
    model.onChange(rootCallback, true);
    model.number.onChange(numberCallback);
    model.innerModel.onChange(innerModelCallback, true);

    // should fire 2 events one on number and one on root.
    model.number.setValue(5);

    // should fire 2 events one on submodel and one on root.
    model.innerModel.str.setValue("new value");

    // 2 move events fired one on subModel and one on rood
    model.innerModel.arr[1].setValue("position one");
});

test("CHILD_CREATED Event", function () {
    stop(2);

    var model = new Model(mixedModel);
    function childCreatedNotificaion (parentProperty, property) {
        equal(arguments.length, 2, "CHILD_CREATED event has two arguments");
        equal(parentProperty, model, "the first argument is the parent of the created property");
        equal(this, model, "the 'this' property is also the parent of the created property");
        equal(property.getName(true), "NewProperty", "the newly created property is the second argument");
        start();
    }
    model.on(Model.Event.CHILD_CREATED, childCreatedNotificaion);
    model.createProperty("NewProperty", "initValue");

    // try array as a parent.
    model.innerModel.arr.on(Model.Event.CHILD_CREATED, function (parentProperty, property) {
        equal(arguments.length, 2, "CHILD_CREATED event has two arguments");
        equal(parentProperty, model.innerModel.arr, "the first argument is the parent of the created property");
        equal(this, model.innerModel.arr, "the 'this' property is also the parent of the created property");
        equal(property.getName(true), "3", "the newly created property (index 3) is the second argument");
        start();
    });
    model.innerModel.arr.push("the 4th property, it's at index 3");

});

test("CHILD_DESTROYED Event", function () {
    stop(2);

    var model = new Model(mixedModel);

    model.on(Model.Event.CHILD_DESTROYED, function childDestroyedNotificaion (parentProperty, destroyedProperty) {
        equal(arguments.length, 2, "CHILD_DESTROYED event has two arguments");
        equal(parentProperty, model, "the first argument is the parent of the created property");
        equal(this, model, "the 'this' property is also the parent of the created property");
        equal(destroyedProperty.getName(true), "number", "the destroyed property is the second argument");
        start();
    });
    model.number.destroy();

    // try array as a parent.
    model.innerModel.arr.on(Model.Event.CHILD_DESTROYED, function (parentProperty, property) {
        equal(arguments.length, 2, "CHILD_CREATED event has two arguments");
        equal(parentProperty, model.innerModel.arr, "the first argument is the parent of the created property");
        equal(this, model.innerModel.arr, "the 'this' property is also the parent of the created property");
        equal(property.getName(true), "2", "the destroyed property (index 2) is the second argument");
        start();
    });
    model.innerModel.arr.pop();
});

test("DESTROY Event", function() {
    stop(3);
    expect(13);


    var model = new Model(mixedModel);
    // test regular property
    ok(model.number, "property exists pre delete");
    model.number.onDestroy(function numberDestroyed(property){
        equal(arguments.length, 1, "destroy callback has one argument");
        equal(property.getName(), "/root/number", "the first and only argument is the deleted property 'number'");
        equal(this, property, "this is bound to the deleted property");
        start();
    });
    model.number.destroy();
    ok(!model.number, "property no longer exists it was destroyed");

    // test delete event on array subProperty when array deleted
    model.innerModel.arr[1].onDestroy(function (property) {
        equal(arguments.length, 1, "destroy callback has one argument");
        equal(property.getName(), "/root/innerModel/arr/1", "the first and only argument is the deleted property 'array[1]'");
        equal(this, property, "this is bound to the deleted property");
        start();
    });
    model.innerModel.arr.destroy();
    ok(!model.arr, "Array Property no longer exists it was destroyed");

    // test Model subProperty
    model.innerModel.str.onDestroy(function (property) {
        equal(arguments.length, 1, "destroy callback has one argument");
        equal(property.getName(), "/root/innerModel/str", "the first and only argument is the deleted property 'str'");
        equal(this, property, "this is bound to the deleted property");
        start();
    });
    model.innerModel.destroy();
    ok(!model.innerModel, "InnerModel Property no longer exists it was destroyed");

});

test("CUSTOM Event variable arguments", function () {
    expect(5);
    stop();

    var model = new Model(mixedModel);
    model.number.on("CUSTOM_EVENT", function (property, customEventArg /*...*/) {
        equal(arguments.length, 3, "custom events have 1 mandatory argument and variable optional arguments");
        equal(property, model.number, "first argument is property event triggered on");
        equal(this, property, "this context is also the property event was triggered on");
        equal(customEventArg, "optionalArgument", "second argument is optional and is passed in by the caller");
        equal(arguments[2], "anyAmountofOtherArguments", "we also have a 3rd argument");
        start();
    });
    model.number.trigger("CUSTOM_EVENT", "optionalArgument", "anyAmountofOtherArguments" /* ..*/);
});

test("Removing Event Listeners", function () {
    expect(2);
    stop(2);

    var model = new Model(mixedModel);
    function numberCallback () {
        ok(true, "this custom Event should be triggered twice");
        start();
    }

    model.number.on("foo", numberCallback); //register same callback twice
    model.number.on("foo", numberCallback);
    model.number.trigger("foo", "bar"); //triggers numberCallback twice

    model.number.off("foo", numberCallback); //  remove everything
    model.number.trigger("foo", "bar");
});

test("AllEvent", function () {
    expect(5);
    stop(5);

    var model = new Model(mixedModel);
    function callback(property, originalArg/*...*/,  eventName /*last argument*/) {
        //fyi originalArgs is an array of arguments
        var theEventName = arguments[arguments.length -1];
        ok(true, property.getName() + " fired " + theEventName);
        start();
    }
    // Listen to all events. Does not listen to propagated MODEL_CHANGED events. Only listens to real events.
    model.on(Model.Event.ALL, callback);


    model.number.setValue(10); // this cause a pseudo Model Change Event to the Model. It is not listened to by ALL.
    model.createProperty("second", "secondProp");//CHILD_CREATED
    model.trigger("knockKnock", "whose", "there", "son");//CUSTOM

    model.number.on(Model.Event.ALL, callback);

    model.number.setValue(2); //PROPERTY_CHANGE
    model.number.destroy(); // DESTROY & CHILD_DESTROYED
});

QUnit.module("Array");

test("Model.isArray", function () {

    var model = new Model(arrayModels);
    ok(Array.isArray(arrayModels.simpleArray), "javaScript native isArray method");
    ok(!Array.isArray(model.simpleArray), "javaScript native isArray method does not work on Array Models");
    ok(Model.isArray(model.simpleArray), "use Model.isArray to check if a Model is an Array Models");

});

test("Model Array length attribute", function () {

    var model = new Model(arrayModels);
    //length behaves the same as native
    equal(model.simpleArray.length, arrayModels.simpleArray.length, "length works as expected");
    equal(model.recursiveArray.length, arrayModels.recursiveArray.length, "length works as expected");

});

test("Array setValueAt", function () {
    expect(1);

    var model = new Model({
        arr: [1,2,3,4]
    });
    model.arr.setValueAt(0, 12);
    equal(model.arr[0].getValue(), 12, "test Array setValueAt");
});

test("Array push", function() {
    expect(5);
    stop();
    var model = new Model(arrayModels),
    nativeArray = arrayModels.simpleArray.concat([]);

    model.simpleArray.on(Model.Event.ALL, function(parentProperty, property, eventName) {
        equal(property.getValue(), 1, "push detected");
        equal(eventName, Model.Event.CHILD_CREATED, "array push triggered a CHILD_CREATED event");
        start();
    });

    var nativePushResult = nativeArray.push(1),
        modelPushResult = model.simpleArray.push(1);

    deepEqual(model.simpleArray.getValue(), nativeArray, "model push behaves like native push");
    equal(modelPushResult, nativePushResult, "model push return new length of array. Same as native push");
    equal(model.simpleArray.length, nativeArray.length, "Empty array now has 3 properties. same as native");
});

test("Array push multivalue", function () {
    expect(6);
    stop(3);
    var model = new Model(arrayModels),
    nativeArray = arrayModels.emptyArray.concat([]);

    model.emptyArray.on(Model.Event.CHILD_CREATED, function (parentProperty, property) {
        equal(parentProperty, model.emptyArray, "Empty array hears about creation");
        start();// called 3 times for each property
    });

    var nativePushResult = nativeArray.push(1,2,3),
        modelPushResult = model.emptyArray.push(1,2,3); //Testing this

    deepEqual(model.emptyArray.getValue(), nativeArray, "model push behaves like native push");
    equal(modelPushResult, nativePushResult, "model push return new length of array. Same as native push");
    equal(model.emptyArray.length, nativeArray.length, "Empty array now has 3 properties. same as native");
});

test("Array pop", function() {
    expect(6);
    stop(2);
    var model = new Model(mixedModel),
        nativeArray = mixedModel.innerModel.arr.concat([]);

    model.innerModel.arr.on(Model.Event.ALL, function(parentProperty, property, eventName) {
        equal(property.getValue(), 3, "push detected");
        equal(eventName, Model.Event.CHILD_DESTROYED, "array pop triggered a CHILD_DESTROYED event");
        start();
    });

    model.innerModel.arr[model.innerModel.arr.length - 1].on(Model.Event.DESTROY, function (property) {
        equal(property.getValue(), 3, "Last property DESTROY event fired");
        start();
    });

    var nativePopResult = nativeArray.pop(),
        modelPopResult = model.innerModel.arr.pop();

    deepEqual(model.innerModel.arr.getValue(), nativeArray, "model pop behaves like native pop");
    equal(modelPopResult.getValue(), nativePopResult, "model pop return same as native pop");
    equal(model.innerModel.arr.length, nativeArray.length, "Model pop shortens array by 1, same as native");

});

test("Array sort", function () {
    stop();
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    model.simpleArray.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        equal(eventName, Model.Event.PROPERTY_CHANGE, "array sort triggered a PROPERTY_CHANGE event only");
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        //TODO: is this WEIRD. should it be the old value as prop or as native?
        deepEqual(property, arrayModels.simpleArray, "the second argument is the old value as native");
        start(); // should be fired once only
    });

    var nativeArraySortResult = nativeArray.sort(),
        modelSortResult = model.simpleArray.sort();

    deepEqual(model.simpleArray.getValue(), nativeArray, "model sort behaves as native sort");
    deepEqual(modelSortResult.getValue(), nativeArraySortResult, "model sort return same as native sort");

});

test("Array shift", function () {
    stop(4);
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    // shift results in one PROPERTY_CHANGE and one CHILD_DESTROYED event.
    model.simpleArray.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        // shift cause 2 events
        ok(eventName === Model.Event.CHILD_DESTROYED || eventName === Model.Event.PROPERTY_CHANGE,
            "array shift triggers 2 events a PROPERTY_CHANGE event and a CHILD_DESTROYED event");
        start();
    });

    model.simpleArray.on(Model.Event.CHILD_DESTROYED, function (parentProperty, destroyedProperty) {
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        equal(destroyedProperty.getValue(), nativeShiftResult, "the second argument is the shifted out property");
        start();
    });

    model.simpleArray.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(property, model.simpleArray, "the first argument is the array effected");
        deepEqual(oldValue, arrayModels.simpleArray, "the second argument is the old value as native. ");
        start();
    });

    // shift return element removed
    var nativeShiftResult = nativeArray.shift(),
        modelShiftResult = model.simpleArray.shift();

    deepEqual(model.simpleArray.getValue(), nativeArray, "model shift behaves as native shift");
    equal(modelShiftResult.getValue(), nativeShiftResult, "shift returns same value as native method");
    equal(model.simpleArray.length, nativeArray.length, "array length same as native post shift");
});

test("Array unshift", function () {
    stop(4);
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    // unshift adds a value to beginning of the array
    // results in one PROPERTY_CHANGE and one CHILD_CREATED event.
    model.simpleArray.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        // shift cause 2 events
        ok(eventName === Model.Event.CHILD_CREATED || eventName === Model.Event.PROPERTY_CHANGE,
            "array shift triggers 2 events a PROPERTY_CHANGE event and a CHILD_DESTROYED event");
        start();
    });

    model.simpleArray.on(Model.Event.CHILD_CREATED, function (parentProperty, newProperty) {
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        //we actually get 2, the last element in the array since this was created. NOTE one might expect 7.
        equal(newProperty.getValue(), 2, "the second argument is the shifted out property");
        start();
    });

    model.simpleArray.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(property, model.simpleArray, "the first argument is the array effected");
        deepEqual(oldValue, arrayModels.simpleArray, "the second argument is the old value as native. ");
        start();
    });

    // unshift returns new length
    var nativeUnshiftResult = nativeArray.unshift(7),
        modelUnshiftResult = model.simpleArray.unshift(7);


    equal(nativeUnshiftResult, modelUnshiftResult, "shift returns same value as native method");
    equal(model.simpleArray.length, nativeArray.length, "array length same as native post unshift");
});

test("array reverse", function () {
    stop();
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    model.simpleArray.on(Model.Event.ALL, function (parentProperty, oldValue, eventName) {
        equal(eventName, Model.Event.PROPERTY_CHANGE, "array reverse triggered a PROPERTY_CHANGE event only");
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        //TODO: is this WEIRD. should it be the old value as prop or as native?
        deepEqual(oldValue, arrayModels.simpleArray, "the second argument is the old value as native");
        start(); // should be fired once only
    });

    // reverse return reference to array
    var nativeArrayReverseResult = nativeArray.reverse(),
        modelReverseResult = model.simpleArray.reverse();

    deepEqual(model.simpleArray.getValue(), nativeArray, "model reverse behaves as native reverse");
    deepEqual(modelReverseResult.getValue(), nativeArrayReverseResult, "model reverse return same as native reverse");
});

test("array splice remove", function () {
    stop(4);
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    // splice remove results in one one CHILD_DESTROYED & PROPERTY_CHANGE event..
    model.simpleArray.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        ok(eventName === Model.Event.CHILD_DESTROYED || eventName === Model.Event.PROPERTY_CHANGE,
            "array shift triggers 2 events a PROPERTY_CHANGE event and a CHILD_DESTROYED event");
        start();
    });

    model.simpleArray.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(property, model.simpleArray, "the first argument is the array effected");
        deepEqual(oldValue, arrayModels.simpleArray, "the second argument is the old value as native. ");
        start();
    });

    model.simpleArray.on(Model.Event.CHILD_DESTROYED, function (parentProperty, destroyedProperty) {
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        //we actually get 2, the last element in the array since this was created. NOTE one might expect 7.
        equal(destroyedProperty.getValue(), 2, "the second argument newly created element. ie. element at end of array.");
        start();
    });

    // see native documentation https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    // removing the second element. aka the middle element. [3,1,2] => [3,2]
    // creates one PROPERTY_CHANGE and CHILD_DESTROYED event.
    // splice returns an array of removed values aka [1]
    var nativeSpliceResult = nativeArray.splice(1,1),
        modelSpliceResult = model.simpleArray.splice(1,1);

    deepEqual(model.simpleArray.getValue(), nativeArray, "model splice behaves like native splice");
    deepEqual(modelSpliceResult, nativeSpliceResult, "model splice return same as native splice");
});

test("array splice add", function () {
    stop(4);
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    // splice add results in one one CHILD_CREATED & PROPERTY_CHANGE event..
    model.simpleArray.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        ok(eventName === Model.Event.CHILD_CREATED || eventName === Model.Event.PROPERTY_CHANGE,
            "array shift triggers 2 events a PROPERTY_CHANGE event and a CHILD_DESTROYED event");
        start();
    });

    model.simpleArray.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(property, model.simpleArray, "the first argument is the array effected");
        deepEqual(oldValue, arrayModels.simpleArray, "the second argument is the old value as native. ");
        start();
    });

    model.simpleArray.on(Model.Event.CHILD_CREATED, function (parentProperty, newProperty) {
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        //we actually get 2, the last element in the array since this was created. NOTE one might expect 7.
        equal(newProperty.getValue(), 2, "the second argument newly created element. ie. element at end of array.");
        start();
    });

    // see native documentation https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    // removing the second element. aka the middle element. [3,1,2] => [3, 99, 1, 2]
    // removes nothing, adds 99 to index 2. one CHILD_CREATED & PROPERTY_CHANGE event.
    var nativeSpliceResult = nativeArray.splice(1, 0, 99/*...additional elements to add*/),
        modelSpliceResult = model.simpleArray.splice(1, 0, 99);

    deepEqual(model.simpleArray.getValue(), nativeArray, "model splice behaves like native splice");
    deepEqual(modelSpliceResult, nativeSpliceResult, "model splice return same as native splice");
});

test("array splice remove and add, aka replace", function () {
    stop();
    var model = new Model(arrayModels),
        nativeArray = arrayModels.simpleArray.concat([]);

    model.simpleArray.on(Model.Event.ALL, function (parentProperty, oldValue, eventName) {
        equal(eventName, Model.Event.PROPERTY_CHANGE, "array reverse triggered a PROPERTY_CHANGE event only");
        equal(parentProperty, model.simpleArray, "the first argument is the array effected");
        //TODO: is this WEIRD. should it be the old value as prop or as native?
        deepEqual(oldValue, arrayModels.simpleArray, "the second argument is the old value as native");
        start(); // should be fired once only
    });

    // see native documentation https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
    // removes the second element, and adds 25 in that position [3,1,2] => [3, 25, 2]
    // one PROPERTY_CHANGE event is fired rather than a CHILD_DESTROYED and CHILD_CREATED
    var nativeSpliceResult = nativeArray.splice(1, 1, 25 /*...additional elements to add*/),
        modelSpliceResult = model.simpleArray.splice(1, 1, 25);

    deepEqual(model.simpleArray.getValue(), nativeArray, "model splice behaves like native splice");
    deepEqual(modelSpliceResult, nativeSpliceResult, "model splice return same as native splice");
});

test("array splice complex", function () {
    var model = new Model(arrayModels),
        nativeArray = arrayModels.complexArray.concat([]),
        model2 = new Model(arrayModels),
        nativeArray2 = arrayModels.complexArray.concat([]);

    var nativeSpliceResult = nativeArray.splice(1,3),
        modelSpliceResult = model.complexArray.splice(1,3);

    deepEqual(model.complexArray.getValue(), nativeArray, "model splice behaves like native splice");
    deepEqual(modelSpliceResult, modelSpliceResult, "model splice return same as native splice");

    var nativeSpliceResult2 = model2.complexArray.splice(1,0,"a","b","c"),
        modelSpliceResult2 = nativeArray2.splice(1,0,"a","b","c");

    deepEqual(model2.complexArray.getValue(), nativeArray2, "model splice behaves like native splice");
    deepEqual(modelSpliceResult2, nativeSpliceResult2, "model splice return same as native splice");
});

QUnit.module("Linking Models");

test("Model.connect bi-directional", function () {
    stop(2);
    var model = new Model(mixedModel),
        modelClone = model.clone();

    Model.connect(model.number, modelClone.number);
    Model.connect(model.innerModel.str, modelClone.innerModel.str);

    modelClone.number.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(oldValue, mixedModel.number, "Change propagated forward");
        start();
    });

    model.innerModel.str.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(oldValue, mixedModel.innerModel.str, "change propagated Backwards");
        start();
    });

    //test forward
    model.number.setValue(123);

    //test backwards
    modelClone.innerModel.str.setValue("newValue");
});

test("Model.connect oneWay forward", function () {
    stop(2);
    var model = new Model(mixedModel),
        modelClone = model.clone();

    Model.connect(model.number, modelClone.number, {direction:"oneWay"});
    model.number.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(oldValue, mixedModel.number, "");
        start();
    });
    modelClone.number.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(oldValue, mixedModel.number, "");
        start();
    });

    // set the value on the model this should propergate to the clone.
    model.number.setValue(200);
});

test("Model.connect oneWay backward", function () {
    stop();
    var model = new Model(mixedModel),
        modelClone = model.clone();

    Model.connect(model.number, modelClone.number, {direction:"oneWay"});
    model.number.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        ok(false, "one way connection, original should not change value");
    });
    modelClone.number.on(Model.Event.PROPERTY_CHANGE, function (property, oldValue) {
        equal(oldValue, mixedModel.number, "");
        start();
    });

    // setting the clone should not propergate to the original
    modelClone.number.setValue(200);
});

test("Model.connect entireModel", function () {
    expect(2)
    stop(2);
    var model = new Model(mixedModel),
        modelClone = model.clone();

    var disconnect = Model.connect(model, modelClone,  {includeChildren: true});
    modelClone.on(Model.Event.MODEL_CHANGE, function (property, oldValue) {
        ok(true);
        start();
    });

    model.number.setValue("one change");
    model.innerModel.str.setValue("one change");

    disconnect();

    // This should not do anything
    model.undef.setValue("abc");
});

test("Model.disconnect", function () {
    stop();
    var model = new Model(primitiveModel),
        modelClone = model.clone();

    var disconnect = Model.connect(model, modelClone,  {includeChildren: true});
    modelClone.on(Model.Event.MODEL_CHANGE, function (property, oldValue) {
        equal(property, modelClone.number, "one way connection, original should not change value");
        equal(primitiveModel.number, oldValue, "one way connection, original should not change value");
        start();
    });

    // setting the clone should not propergate to the original
    model.number.setValue(200);

    disconnect();
    // we have disconnected the model this should not propergate
    model.str.setValue("newValue");
});

test("Model.connect via map", function () {
    expect(2);
    stop(2);
    var model = new Model(mixedModel),
        modelToConnect = new Model({
            connectMeToUndef: "a property",
            innerModel: {
                subProp: "subProp",
                connectMeToNumber: 99
            },
            arr: [5, 9, 3]
        });

    function mapFunction(input) {
        var map = {
            "/root/number":"/root/innerModel/connectMeToNumber",
            "/root/undef": "/root/connectMeToUndef"
        };
        return map[input];
    };

    var disconnectModel2 = Model.connect(model, modelToConnect, {
        includeChildren: true,
        mapFunction: mapFunction
    });

    model.undef.on(Model.Event.PROPERTY_CHANGE, function () {
        equal(model.undef.getValue(), modelToConnect.connectMeToUndef.getValue(), "backward");
        start();
    });

    modelToConnect.innerModel.connectMeToNumber.on(Model.Event.PROPERTY_CHANGE, function () {
        equal(model.number.getValue(), modelToConnect.innerModel.connectMeToNumber.getValue(), "forward");
        start();
    });

    model.number.setValue(101);
    modelToConnect.connectMeToUndef.setValue("I'm changed");

});

test("Model.connect blacklist", function () {
    stop(2);
    var model = new Model(mixedModel),
        model2 = new Model(mixedModel);

    Model.connect(model.number, model2.number, {eventBlackList:"blackListedEvent"});
    Model.connect(model.innerModel.str, model2.innerModel.str, {eventBlackList:"blackListedEvent"});

    model2.number.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        equal(eventName, "notABlackListedEvent", "only allow events not on the blacklist");
        start();
    });

    model.innerModel.str.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        equal(eventName, "notABlackListedEvent", "only allow events not on the blacklist");
        start();
    });

    // forward
    model.number.trigger("blackListedEvent", "fail");
    model.number.trigger("notABlackListedEvent", "pass");

    // backwards
    model2.innerModel.str.trigger("blackListedEvent", "fail");
    model2.innerModel.str.trigger("notABlackListedEvent", "pass");
});

test("Model.connect whitelist", function () {
    stop(2);
    var model = new Model(mixedModel),
        model2 = new Model(mixedModel);

    Model.connect(model.number, model2.number, {eventWhiteList:"whiteListedEvent"});
    Model.connect(model.innerModel.str, model2.innerModel.str, {eventWhiteList:"whiteListedEvent"});

    model2.number.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        equal(eventName, "whiteListedEvent", "only allow events not on the whitelist");
        start();
    });

    model.innerModel.str.on(Model.Event.ALL, function (parentProperty, property, eventName) {
        equal(eventName, "whiteListedEvent", "only allow events not on the blacklist");
        start();
    });

    // forward
    model.number.trigger("whiteListedEvent", "pass");
    model.number.trigger("notAWhiteListedEvent", "fail");

    //backwards
    model2.innerModel.str.trigger("whiteListedEvent", "fail");
    model2.innerModel.str.trigger("notAWhiteListedEvent", "pass");
});


test("LinkedModelArrays", function () {
    expect(2);
    stop(2);

    var arrayModel = new Model(arrayModels),
        arrayModel2 = arrayModel.clone();

    Model.connect(arrayModel.emptyArray, arrayModel2.emptyArray);
    Model.connect(arrayModel.simpleArray, arrayModel2.simpleArray, {includeChildren: true});

    arrayModel2.emptyArray.on(Model.Event.ALL, function () {
        deepEqual(arrayModel2.emptyArray.getValue(), [2], "array push worked");
        start();
    });

    arrayModel2.simpleArray.on(Model.Event.ALL, function () {
        deepEqual(this.getValue(), [3, 1], "array pop worked");
        start();
    });

    arrayModel.emptyArray.push(2);
    arrayModel.simpleArray.pop();
});


QUnit.module("Model Transactions");

test("ModelTransactions", function () {
    stop(2);
    expect(4);

    var oldAsyncValue = Model.asyncEvents;
    Model.asyncEvents = false;

    var callbackCalled = false;
    function callback (property, oldValue) {
        callbackCalled = true;
        start();
    }

    function suppresCallback (property, oldValue) {
        ok(false, "callback Should not be called because suppressed");
    }

    var m = new Model(primitiveModel);
    m.number.onChange(callback);
    m.bool.onChange(suppresCallback);
    m.str.onChange(callback);

    Model.startTransaction();

    m.number.setValue(5);
    m.bool.setValue(true); //should not fire a onChange event since value not changes
    m.str.setValue("new value set in transaction");

    ok(!callbackCalled, "onChange Callback not executed till transaction complete");
    ok(Model.inTransaction(), "Model inTranaction reporting correctly");

    Model.endTransaction();

    ok(!Model.inTransaction(), "Model inTranaction reporting correctly");
    ok(callbackCalled, "onChange Callback called after transaction ended");

    Model.asyncEvents = oldAsyncValue;
});


test("FireOnlyMostRecentPropertyEvent", function () {
    stop();

    var model = new Model(mixedModel);

    model.number.onChange(function callback(property, oldValue) {
        equal(property.getValue(), 4, "fireOnlyMostRecentPropertyEvent onChange event is the most recent");
        start();
    });

    Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = true;
    Model.startTransaction();
    //Lets change number multiple time. should only be called once with last value of change
    model.number.setValue(2);
    model.number.setValue(3);
    model.number.setValue(4);
    Model.endTransaction();

    Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = false; //restore
});


test("FlattenCallbacks", function () {
    expect(2);
    stop(2);

    function callback(property, oldValue){
        ok(true, "onChange callback called once, even though registered on different properties");
        start();
    }
    function callback2(property, oldValue){
        ok(true, "onChange callback2 called once because different than other callback");
        start();
    }

    var model = new Model(mixedModel);
    model.number.onChange(callback);
    model.innerModel.onChange(callback, true);
    model.innerModel.onChange(callback2, true);
    model.innerModel.str.onChange(callback);
    model.undef.onChange(callback2);

    Model.TRANSACTION_OPTIONS.flattenCallbacks = true;

    Model.startTransaction();
    model.number.setValue(3);
    model.innerModel.str.setValue("value Changed");
    model.undef.setValue("new Value");
    Model.endTransaction();

    Model.TRANSACTION_OPTIONS.flattenCallbacks = false; //restore
});

test("Flatten callbacks by hash", function () {
    expect(4);
    stop(4);

    function callback(property, oldValue) {
        ok(true, "Hashed function called once per transaction when flattenCallbacksByHash set");
        start();
    }
    callback.hash = "uniqueID";

    function callback2(property, oldValue) {
        ok(true, "unhashed function called more than once when flattenCallbacksByHash set");
        start();
    }

    var model = new Model(mixedModel);
    model.number.onChange(callback);
    model.number.onChange(callback2);
    model.innerModel.onChange(callback, true);
    model.innerModel.onChange(callback2, true);
    model.innerModel.str.onChange(callback);
    model.innerModel.str.onChange(callback2);

    Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = true;
    Model.startTransaction();

    model.number.setValue(50);
    model.innerModel.str.setValue("value Changed");
    model.undef.setValue("new Value");

    Model.endTransaction();
    Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = false;
});

test("SuppressAllEvents", function () {
    expect(0);

    function callback(property, oldValue){
        ok(false, "This callback should be suppressed");
    }
    function callback2(property, oldValue){
        ok(false, "This callback should be suppressed");
    }

    var model = new Model(mixedModel);
    model.number.onChange(callback);
    model.innerModel.onChange(callback, true);
    model.innerModel.str.onChange(callback);
    model.undef.onChange(callback2);

    Model.TRANSACTION_OPTIONS.suppressAllEvents = true;
    Model.startTransaction();

    model.number.setValue(3);
    model.innerModel.str.setValue("value Changed");
    model.undef.setValue("new Value");

    Model.endTransaction();
    Model.TRANSACTION_OPTIONS.suppressAllEvents = false; //restore
});

test("Model.endTransaction w/ Options", function () {
    expect(8);
    stop(4);

    var count = 0;
    function callback(property, oldValue) {
        ok(count++ === 0, "Hashed function called once when flattenCallbacksByHash set");
        start();
    }
    callback.hash = "uniqueID";

    function callback2(property, oldValue){
        ok(true, "unhashed function called more than once when flattenCallbacksByHash set");
        start();
    }

    var model = new Model(mixedModel);
    model.number.onChange(callback);
    model.number.onChange(callback2);
    model.innerModel.onChange(callback, true);
    model.innerModel.onChange(callback2, true);
    model.innerModel.str.onChange(callback);
    model.innerModel.str.onChange(callback2);

    Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = true; // to start change defaults
    Model.TRANSACTION_OPTIONS.flattenCallbacks = true;
    Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = true;
    Model.TRANSACTION_OPTIONS.suppressAllEvents = true;
    Model.startTransaction();

    model.number.setValue(25);
    model.innerModel.str.setValue("value Changed");
    model.undef.setValue("new Value");

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
    Model.TRANSACTION_OPTIONS.suppressAllEvents = false;
});