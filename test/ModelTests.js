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

test("testModelPropertyName", function () {

    var jsonModel = {   number: 1,
                        str : "aString",
                        x: function () {return "I am function x";},
                        subModel: {
                            str2: "string2",
                            f: function () {return "I am a function";}
                        }
                    };
    var m = new Model(jsonModel);
    ok(m.getName() === "/root", "Passed");
    ok(m.str.getName() === "/root/str", "Passed");
    ok(m.subModel.getName() === "/root/subModel", "Passed");
    ok(m.subModel.f.getName() === "/root/subModel/f", "Passed");

    // passing in a name to our model changes the default of root.
    var m2 = new Model(jsonModel, {name: "test"});
    ok(m2.getName() === "/test", "Passed");
    ok(m2.str.getName() === "/test/str", "Passed");
    ok(m2.subModel.getName() === "/test/subModel", "Passed");
    ok(m2.subModel.f.getName() === "/test/subModel/f", "Passed");



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
    var callback = function (oldValue, newValue, propertyName) {
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
    var callback = function (oldValue, newValue, propertyName) {
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
    model.number._value = 2;
    model.number._value = 3;
    model.number._value = 4;
    Model.endTransaction();

    ok(count === 1, "Passed");
    ok(callbackNewValue === 4, "Passed");

    //test on Model
    model.subModel.onChange(callback, {listenToChildren: true});
    Model.startTransaction();
    model.subModel.subProp._value = "new subProp value1";
    model.subModel.subProp._value = "new subProp value2";
    model.subModel.subProp._value = "new subProp value3";
    Model.endTransaction();


    ok(count === 2, "Passed");

    Model.startTransaction();
    model.subModel.subProp._value = "new subProp value";
    model.subModel.fun._value = "replace function with string";
    Model.endTransaction();
    Model.eventOptimization.suppressPreviousPropertyChangeEvents = false;
    // Is this what I expect with suppressPreviousPropertyChangeEvents on? Should this be 3?
    ok(count === 4, "Passed");

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
    model.number._value = 3;
    model.subModel.subProp._value = "value Changed";
    model.str._value = "new Value";
    Model.endTransaction();

    ok(count === 1, "Passed");
    ok(count2 === 1, "Passed");
    Model.eventOptimization.enableSingleCallbackCall = false;
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
    model.number._value = 3;
    model.subModel.subProp._value = "value Changed";
    model.str._value = "new Value";
    Model.endTransaction();
    Model.eventOptimization.enableCallbackHashOpimization = false;

    ok(count === 1, "Passed");
    ok(count2 === 3, "Passed");
});

test("modelNoConflict", function () {

    var myModel = Model.noConflict();

    ok (!Model);
    ok(myModel);
    window.Model = myModel; //restore the world

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
    //getting/setting a model values goes throught the ._value keyword.
    // This is a getter for a Property. it retieves the value 1.
    var numberPropertyValue = modelFromJSON.numberProperty._value;

    // This is a getter for a Model. It returns a JSON object.
    var objModelValue = modelFromJSON.objProperty2._value;

    //This sets the Property value to 2;
    modelFromJSON.numberProperty._value = 2;

    // This is a setter for Model Objects.
    modelFromJSON.objProperty2._value = {value1: "new Value1 value", value3: "Adding a new property"};
    // The above will effectively add properties that don't exist. change the values of ones that do (keeping validation and listeners untouched)
    // and remove properties that are missing.


    // We can set the property to anything, but remember it must pass the validator.
    // This string will fail the positiveNumber validator. _value will still be 2
    modelFromCode.positiveNumber._value = "a String";

    //if you don't like the silent failure you can use these methods to check if a validator exists
    modelFromCode.positiveNumber.hasValidator();
    modelFromCode.positiveNumber.validateValue("a String"); // or even do the test yourself

    // sometimes its desireble to change a value without notifying your listener. You can do this is the special set notation
    modelFromJSON.numberProperty._value = {_value: 6, suppressNotifications: true};

    // this notation can be used on objects aswell.
    // Here the property _value indicates the value and the other properties are the options.
    // suppressNotifications is the only currently accepted options. It does not call any of the registered listeners when it changes the value.
    modelFromCode.obj._value = {_value: {replacementObj: "replacement obj"},
        suppressNotifications: true
    };
    // Do to this notation, "_value" should not be used as a key.

    // Without the _value keyword in the it will attempt to set the value to a Model type.
    // This fails. You can not set a Model to a Property or a Property to a Model
    modelFromJSON.numberProperty._value = {newValue: 6, suppressNotifications: true};
    // Be very careful this can happen within the Object.
    modelFromJSON.objProperty._value = {name: {nameObj: "Setting a property to a ModelObj should fail"}};
    modelFromJSON.objProperty._value = {name: "this is a proptery value change", value: "this trys to replace obj with property"};

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
    modelFromJSON.stringProperty._value = "new String Property";
    modelFromJSON.objProperty.name._value = "new name";

    modelFromCode.number.onChange(callback);
    modelFromCode.number._value = 8;
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