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
    ok(m.str._value === jsonModel.str, "Passed");
    ok(m.number._value === jsonModel.number, "Passed");
    m.str._value  = 1;
    m.number._value = "aString";

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
    var modelXReturnValue = m.x._value();
    var modelFReturnValue = m.subModel.f._value();
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
    m.number._value = 2;
    m.number._value = 3;
    m.number._value = 3; // value is the same should not fire a change

    ok(count === 2, "Passed");

});


test("testModelCreationFromScratch", function () {
    var expectedJSON = {
        x: 1,
        y: "y",
        obj: {
            desc: "a New point"
        },
        obj2: {
            desc: "This is obj2"
        }
    };

    var m = new Model();
    m.createProperty("x", 1);
    m.createProperty("y", "y");

    var subModel = new Model();
    subModel.createProperty("desc", "a New point");
    m.obj = subModel;

    // alternate - just pass in JSON
    m.createProperty("obj2", {desc: "This is obj2"});


    ok(JSON.stringify(m.toJSON()) === JSON.stringify(expectedJSON), "Passed");
});

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

    //setting a property to a model should fail
    m.property._value = {prop: "this is an obj property", prop2: "this is prop2"};

    //setting a model to a property should fail
    m.model._value = "new string property";

    // setting a property to an object indirectly should fail
    m.model._value = {key1: "This should not be set",
                        key2: {prop1:"this is an Object", prop2: "this should fail, since setting key2 to an object"}};

    // setting a model to an property indirectly should fail
    m.model._value = {key1: "this should not be set", subModel: "setting a model to a property should fail"};

    //setting a model to another model should do a merge
    m.model._value = {key1: "this is key1's new value", key3: "we have added a key"};

/* This isn't passing yet. Since _parent of property is immutable. Think about it.
    var subModel = new Model();
    subModel.createProperty("desc", "This is obj1");
    m.obj._value = subModel;
    m.obj = subModel // will also break things because parent not assigned.
 */
    // alternate
    //m.obj2._value = {desc: "This is obj2"};

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
    m.x._value = 2;
    ok(notified, "Passed");
    notified = false;
    m.x._value = {_value: 4, suppressNotifications: true}; //special object setting
    ok(!notified, "Passed");
    ok(m.x._value === 4, "Passed");
});

test("testPropertyValidationFunction", function () {

    var validateX = function (value){
        return value > 0;
    };
    var m = new Model();
    m.createProperty("x", 1, {validator: validateX});
    m.createProperty("y", "y");
    ok(m.x._value === 1, "Passed");
    m.x._value = 5;
    ok(m.x._value === 5, "Passed");
    m.x._value = -1;
    ok(m.x._value === 5, "Passed");

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
    m.number._value = 5;
    m.bool._value = true; //should not fire a onChange event since value not changes

    ok(!callbackCalled, "Passed");
    Model.endTransaction();
    ok(callbackCalled, "Passed");
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

    m.number._value = 5;
    ok(callbackCalled, "Passed");

    ok(count===2, "Passed");
});

test("testModelClone", function (){
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
    var clone = model.clone();
    ok(JSON.stringify(model.toJSON()) === JSON.stringify(clone.toJSON()), "Passed");

});

test("modlejsTutorial", function (){

    //The code below will teach you how to use modeljs by example. It attepts to go though all the features in logical progression.

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
    // create properties via the createProperty method
    modelFromCode.createProperty("PropertyName", "property Value");
    modelFromCode.createProperty("number", 1);
    // value can be any of the native Javascript types

    //modelFromCode.createProperty("obj", new Model({"subModel": "I am a inlined Model object"})); // This will throw an error to the console
    // Here is a complex type
    modelFromCode.createProperty("obj", {"submodel2": "a way to programatically set a property to a submodel"}); //This is recommended.
    // the createProperty method can also take options like a validator function
    modelFromCode.createProperty("positiveNumber", 2, {validator: function (value){return typeof value === 'number' && value > 0;}});
    // Validator functions get run when you try to change the property value.
    // It take the newValue to be set as the arguement and returns true if the value.
    // If the value is not valid it will not be set and the property remains unchanged.
    // Note validators can only be bound to the property at creation time.
    // Let look at how we can set/change property values

    /** --- Model manipulation --- */
    //getting/setting a model value behaves simarly to  like JavaScript Objects.
    // This is a getter. it retieves the value 1
    var numberPropertyValue = modelFromJSON.numberProperty._value;
    //This sets the Property value to 2;
    modelFromJSON.numberProperty._value = 2;
    // We can set the property to anything, but remember it must pass the validator.
    // This string will fail the positiveNumber validator. _value will still be 2
    modelFromCode.positiveNumber._value = "a String";

    //if you don't like the silent failure you can use these methods to check if a validator exists
    modelFromCode.positiveNumber.hasValidator();
    modelFromCode.positiveNumber.validateValue("a String"); // or even do the test yourself

    //you can even use set notation to change the value to a complex type like a model
    modelFromCode.obj._value = {"submodel": "A submodel set via the '_value = {}' setter"};

    // These two lines should fail.
    modelFromJSON.objProperty._value = {name: {nameObj: "Setting a property to a ModelObj should fail"}};
    modelFromJSON.objProperty._value = {name: "this is a proptery value change", value: "this trys to replace obj with property"};

    // Although if your using JSON notation be mindful if the JSON object has a _value property it will be treated specially
    // Here the property _value indicates the value and the other properties are options. acceptable options are:
    // suppressNotifications - which does not call any of the registered listeners.
    modelFromCode.obj._value = {_value: {replacementObj: "replacement obj"},
        suppressNotifications: true
    };

    // The next section will talk about events


    /* --- Events --- */
    /** The core responsibility of the Model in the MVC patter is to notify the view when the model changes */
    // using modeljs the you can listen to when any model property value changes by registaring a callback.
    // below is a example
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
    modelFromJSON.stringProperty._value = "new String Property";
    modelFromJSON.objProperty.name._value = "new name";

    // it doesn't matter how you set the value or which Model you are manipulating. Transaction apply to everything
    modelFromCode.number.onChange(callback);
    modelFromCode.number._value = 8;
    Model.endTransaction();

    // To check if your in a transaction block you can call
    Model.inTransaction();

    //Finally if your using transaction there is a way to be smart about the callbacks you at the end of the transaction.
    // This feature is still in development, and is unclear of the strategies it will use, but it can be turn on and off via the boolean
    Model.eventOptimizationEnabled = true; // likely to change in the near future;
    Model.eventOptimizationEnabled = false;


    /* --- Saving and Loading from saved --- */
    // Finally, last but not least is saving your model. The toJSON method will return the JSON representation of
    // the model that you can persist and reload at a later time. If you pass true as an argument to the toJSON function
    // the JSON will include model metadata like validators, otherwise it will be JSON with only the property name/values
    // being outputted.
    modelFromJSON.toJSON(true);
    modelFromJSON.toJSON(false);

   ok(JSON.stringify(modelFromJSON.toJSON()) !== JSON.stringify(modelAsJSON), "Passed");

});