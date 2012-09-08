/*
 * Model js - A simple javascript library for creating the Model part of a MVC application.
 * https://github.com/dgeorges/modeljs.git
 * @project modeljs
 * @version 1.0.0
 * @author Daniel Georges
 *
 *
 * Features
 * - Simple easy to use and intuitive library
 * - Can save/load Model to/from JSON with/without model meta data
 * - Can register on change events with any single property or group of properties
 * - Model change events bubble up.
 * - Can tie validation methods to models and properties
 * - Can suppress events notification.
 * - Can batch changes into a transaction.
 * - Transaction can be easily optimized.
 * - Incorrect uses of api are logged as errors to the console
  *
 *
 * TODO:
 *  - hook up/create/clean documentation and document methods properly.
 *  - add basic validators that can be reused.
 *  - set up gitHub site
 *  - test on IE8
 *
 * BUGS:
 * - The callback executed when listening to modelChange event on one of your children needs to refined
 *     to make more sense. Right now its the same as a property change.
 */

/**
 Provides the base Model library.
@module Model
*/
(function (window, undefined) {
    "use strict";

    // copied from underscorejs
    function isObject (obj) {
        return obj === new Object(obj) && Object.prototype.toString.call(obj) != '[object Function]';
    }

    function isEmptyObject(obj) {
        if (Object.getOwnPropertyNames) { // only exits on ECMAScript 5 compatible browsers
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            for( var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    return false;
                }
            }
            return true;
        }
    }

    /**
     * Centralized place where all Model Events pass through.
     */
    var eventProxy = function () {
        var eventQueue = [],
            state = {   ACTIVE: "active", TRANSACTION: "transaction"},
            currentState = state.ACTIVE;

        var executedCallbacks = [];
        var callbackHashs = [];
        function _fireEvent(property, oldValue) {

            // This weird executeCallback function is a bit more complicated than it needs to be but is
            // used to get around the JSLint warning of creating a function within the while loop below
            var executeCallbacksFunction = function (oldValue, property) {
                return function (callback){
                    if (Model.eventOptimization.enableSingleCallbackCall || Model.eventOptimization.enableCallbackHashOpimization){
                        var callbackExecuted = false;
                        if (Model.eventOptimization.enableSingleCallbackCall){
                            if(executedCallbacks.indexOf(callback) === -1) { // Only call callback once
                                executedCallbacks.push(callback);
                                callback.call(null, oldValue, property.getValue(), property.getName());
                                callbackExecuted = true;
                            }
                        }
                        if(Model.eventOptimization.enableCallbackHashOpimization){
                             if(!callback.hash || callbackHashs.indexOf(callback.hash) === -1) { // Only call hash identified callback once
                                if (callback.hash) {
                                    callbackHashs.push(callback.hash);
                                }
                                if (!callbackExecuted){
                                    callback.call(null, oldValue, property.getValue(), property.getName());
                                    callbackExecuted = true;
                                }
                            }
                        }
                    } else {
                        callback.call(null, oldValue, property.getValue(), property.getName());
                    }
                };
            };

            var allPropertyListeners = property._propertyListeners.concat(property._modelListeners);
            allPropertyListeners.forEach(
                executeCallbacksFunction(oldValue, property)
            );

            var propertyParent = property._parent;
            while (propertyParent){

                propertyParent._modelListeners.forEach( // when we bubble the event we only notify modelListeners
                    executeCallbacksFunction(oldValue, propertyParent)
                );
                propertyParent = propertyParent._parent;
            }
        }

        function fireEvent (property, oldValue) {
            if (currentState === state.ACTIVE){
                _fireEvent(property, oldValue);
            } else { //place event on queue to be called at a later time.
                eventQueue.push({
                    property: property,
                    oldValue: oldValue
                });
            }
        }

        function changeState(newState){
            if (state[newState] !== currentState){
                currentState = newState;
                if (newState === state.ACTIVE){
                    flushEventQueue();
                }
            }
        }

        function flushEventQueue() {

            executedCallbacks = []; //reset state
            callbackHashs = [];
            if(Model.eventOptimization.suppressPreviousPropertyChangeEvents){
                var optimizedQueue = [];
                var seenProperties = [];
                for(var i = eventQueue.length - 1; i >= 0; i-=1){// iterate backwards since last events are most recent.
                    var eventProperty = eventQueue[i].property;
                    if (seenProperties.indexOf(eventProperty) === -1){
                        // Not seen yet add it.
                        seenProperties.push(eventProperty);
                        optimizedQueue.push(eventQueue[i]);
                    } else {
                        //eventQueue[i] = null; // null out event since it's propertyChange is on the Queue Already
                    }
                }
                eventQueue = optimizedQueue;
            }

            eventQueue.forEach( function (event){
                _fireEvent(event.property, event.oldValue);
            });
            eventQueue = [];
        }

        return {
            fireEvent: fireEvent,
            startTransaction: changeState.bind(null, state.TRANSACTION),
            endTransaction: changeState.bind(null, state.ACTIVE),
            inTransaction: function () { return currentState === state.TRANSACTION;}
        };
    }();

    /**
     * A Property is a name value pair belonging to a Model.
     *
     * @class Property
     * @constructor
     * @private used internally by the Model.prototype.createProperty method.
     *
     * @param {[String]} name    The name of the property
     * @param {[String, Boolean, Number, null, Function, Object]} value   The Property Value
     * @param {[Model]} parent  The parent property
     * @param {[Object]} metadata The metadata associated with the property:
     *                         validator - a function to validate the new value is valid before it is assigned.
     */
    function Property (name, value, parent, metadata) {

        var myName = "/" + name;
        if (parent){
            myName = parent.getName() + myName;
        }

        Object.defineProperty(this, "_name", {
            value: myName,
            enumerable: false
        });

        Object.defineProperty(this, "_parent", {
            value: parent,
            enumerable: false
        });

        Object.defineProperty(this, "_myValue", {
            value: value,
            enumerable: false,
            writable: true
        });

        Object.defineProperty(this, "_metadata", {
            value: metadata || {},
            enumerable: false
        });

        Object.defineProperty(this, "_propertyListeners", {
            value: [],
            enumerable: false
        });
         Object.defineProperty(this, "_modelListeners", {
            value: [],
            enumerable: false
        });

        this.setValue(value);
    }

    /**
     * Gets the value of the property.
     *
     * @method  getValue
     *
     * @return {[String, Boolean, Number, null, Function]} The value of the property
     */
    Property.prototype.getValue = function () {
        return this._myValue;
    };

    /**
     * The fully qualified name of this. The name is calculated by concatenating the name
     * of the parent, "/", and name of this.
     *
     * @example
     *     defaultModel.getName();              // returns "/root"
     *     defaultModel.property1.getName();    // returns "/root/property1"
     *     namedRoot.property1.getName();       // returns "/customName/property1"
     * For more examples see:  <b>testGetNameMethod</b>
     *
     * @method  getName
     *
     * @return {String} The fully qualified name of this.
     */
    Property.prototype.getName = function () {
        return this._name;
    };

    /**
     * Called upon a property or Model to set it's Value. If the setValue is the same as the current value,
     * nothing will happen and no change events will be fired. If the value is different it must pass
     * the validator if there is one.  If it does pass the validator and value is changed, all registered
     * listeners will be notified unless the suppressNotifications option indicates otherwise.
     *
     * @example
     * For more examples see:  <b>testPrimitiveSetGet</b>, <b>testComplexChangePropertyValue</b> and <b>testSuppressNotifications</b>
     *
     * @method setValue
     * @for Property
     *
     * @param  {[String, Boolean, Number, null, Function, Object]} newValue The Value you want to assign to the Property.
     * @param  {[Boolean]} suppressNotifications? Indicating if listeners should be notified of change.
     *
     * @return {[string, boolean, number, null, function, object]}          The resulting value. If the operation was successful this will be the passed in value otherwise it will be the existing one.
     */
    Property.prototype.setValue = function (value, suppressNotifications) {
        var newValue = value;

        if (newValue instanceof Property || newValue instanceof Model ) {
            // this is misleading syntax because other property attributes are not copied like _listener and _parent
            // so prevent it and provide alternate.
            window.console.error("Incorrect Syntax: use setValue([property|model].getValue()) instead");
            return;
        }

        // Note: this disallows setting a property to undefined. Only when it's first created can it be undefined.
        if (newValue !== undefined && newValue !== this._myValue) {
            var validationFunction = this._metadata && this._metadata.validator;

            if (!validationFunction || validationFunction(newValue)){
                var oldValue = this._myValue;

                if (isObject(newValue)) {
                    if (!(this instanceof Model)){
                        window.console.error("Not Supported: Can't set the Model value to a property. Delete the model and use createProperty");
                        return;
                    } else {
                        //This model need to be set to the newValue
                        this.merge(newValue, false);
                    }
                } else { // newValue is a property
                    if (this instanceof Model){
                        window.console.error("Not Supported: Can't set a Property value to a model. Delete the property and use createProperty");
                        return;
                    } else {
                        this._myValue = newValue;
                    }
                }

                if (!suppressNotifications){
                    eventProxy.fireEvent(this, oldValue);
                }
            }
        }
        return this._myValue;
    };

    /**
     * Registers a callback function with the change event of this.
     *
     * @example
     *     model.onchange(callback, true); //listens to change events on entire model
     *     model.property1.onchange(callback) //listen to change on property1 only
     *     model.subModel.onchange(callback) //listen to change on subModel only. (ie. via model.subModel.setValue(..))
     * For more examples see:  <b>testOnChangeCallbackWhenSettingToSameValue</b> and <b>testBubbleUpEvents</b>
     *
     * @method  onChange
     *
     * @param {Function} callback The function to be called if the value of this changes. The call back function will be passed the following arguments (oldValue, newValue, propertyName)
     * @param {Object}   options? May contain the following:
     *                         listenToChildren {Boolean} - registers the callback with sub property changes as well.
     */
    Property.prototype.onChange = function (callback, options) {
        if (options && options.listenToChildren){
            this._modelListeners.push(callback);
        } else {
            this._propertyListeners.push(callback);
        }
        return this;
    };

    /**
     * Determine if this has a validation function associated with it.
     *
     * @example
     * For examples see:  <b>testPropertyValidationFunction</b>
     *
     * @method hasValidator
     *
     * @return {Boolean} True if this has a validator associated with it. False otherwise.
     */
    Property.prototype.hasValidator = function () {
        return !!this._metadata.validator;
    };

   /**
     * Determines if the given value will pass the validation function of this.
     *
     * @example
     * For examples see:  <b>testPropertyValidationFunction</b>
     *
     * @method  validateValue
     *
     * @param  {[String, Boolean, Number, null, Function, Object]} value A value to test against the validation function if it exists.
     * @return {Boolean}      The result of passing value against the validation function if it exists. True otherwise.
     */
    Property.prototype.validateValue = function (value) {
        if (this._metadata.validator){
            return this._metadata.validator(value);
        }
        return true;
    };
    //don't want a set validator function.

   /**
     * The model Object that wraps the JSON.
     *
     * @example
     * For examples see: <b>testPrimitiveSaveLoad</b>,  <b>testObjectsSaveLoad</b>, <b>testComplexSaveLoad</b>
     * <b>testGetNameMethod</b> and <b>testSaveLoadWithMetaData</b>
     *
     * @class Model
     * @constructor
     * @extends Property
     *
     * @param {Object} json    The json object to be modeled.
     * @param {Object} metadata? May contain the following:
     *                         validator - a function to validate the new value is valid before it is assigned.
     *                         name - name of the Model, defaults to "root"
     */
    function Model (json, metadata, parent) {
        var jsonModel = json || {} ,
            modelMetadata = metadata|| {},
            modelName = (modelMetadata.name || "root"),
            modelParent = parent || null;

        //A Model is in itself a Property so lets call our supers constructor
        Property.call(this, modelName, jsonModel, modelParent, modelMetadata);

        Object.keys(jsonModel).forEach(function (name){

            if (name.match(Model.PROPERTY_METADATA_SERIALIZED_NAME_REGEX)){ // skip special meta data properties
                return;
            }

            var value = jsonModel[name];
            var propertyMetadata = json[name + Model.PROPERTY_METADATA_SERIALIZED_NAME_SUFFIX];

            this.createProperty(name, value, propertyMetadata);
        }, this);
    }
    Model.prototype = Object.create(Property.prototype);

    Model.PROPERTY_METADATA_SERIALIZED_NAME_SUFFIX = "__modeljs__metadata";
    Model.PROPERTY_METADATA_SERIALIZED_NAME_REGEX = /__modeljs__metadata$/;

   /**
     * Gets the value associated with the Model. This will be a json Object.
     *
     * @method  getValue
     *
     * @return {Object} The json Object represented by the model
     */
    Model.prototype.getValue = function() {
        return this.toJSON();
    };

    /**
     * Creates the property with the given name on this.
     *
     * @example
     *     var model = new Model();
     *     model.createProperty("number", 1) // a simple property (model.number)
     *     .createProperty("subModel", { // a property that is a subModel (model.subModel and model.subModel.str)
     *         str: "stringProperty"
     *     })
     *     .createProperty("positiveNumber", 2, { // a property with a validator (model.positiveNumber)
     *         validator: function (value) {
     *             return value > 0;
     *         }
     *     }); // Note the method chaining.
     * For examples see: <b>testModelCreationUsingCreatePropertyMethod</b>
     *
     * @method  createProperty
     *
     * @param  {String} name    Name of the property
     * @param  {[String, Boolean, Number, null, Function, Object]} value   Property value
     * @param  {Object} metadata? A hash of metadata including:
     *                           validator {Function} The validator to associate with the new Property.
     * @return {Model}         Returns this for method chaining
     */
    Model.prototype.createProperty = function createProperty(name, value, metadata) {
        if (value instanceof Model || value instanceof Property){
            window.console.error("Unsupported Operation: Try passing the Model/Properties value instead");
        } else if (isObject(value)){
            var modelMetadata = metadata || {};
            modelMetadata.name = name;
            this[name] = new Model(value, modelMetadata, this);
        } else {
            this[name] = new Property (name, value, this, metadata);
        }
        return this;
    };

    /**
     * Clones the Model rooted at this keeping all validators that exist, but not keeping attached onChange callbacks.
     * The name of all properties are adjusted to reflect it's new root.
     *
     * @example
     *     var newModel = model.clone(); // clone root model
     *     var clonedSubModel = model.subModel.clone(); // clone subModel
     * For more examples: <b>testModelClone</b>
     *
     * @method  clone
     *
     * @return {Model}  Returns a new Model object rooted at this, keeping validator but not onChange callbacks.
     */
    Model.prototype.clone = function (){
        var myName = this.getName();
        var options = {
            name : myName.substring(myName.lastIndexOf("/") + 1),
            validator: this._metadata.validator
        };
        return new Model(this.toJSON(true), options);
    };

    function mergeLoop (model, json, doModification, keepOldProperties) {

        for (var name in json) {
            var value = json[name];
            if (model[name]){
                if (isObject(value)){ // right hand side is an object
                    if (model[name] instanceof Model) {// merging objects
                        var successful = mergeLoop(model[name], value, doModification, keepOldProperties );
                        if (!successful){
                            return false;
                        }
                    } else {
                        // Trying to assign a model to a property. This will fail.
                        return false;
                    }

                } else { // right hand side is a property
                    if (!(model[name] instanceof Model)){ // Its not a Model therefore it's a Property
                        if (doModification){
                            model[name].setValue(value);
                        }
                    } else {
                        // Trying to assign a property to a Model. This will fail.
                        return false;
                    }
                }
            } else { //create new property
                if (doModification){
                    model.createProperty(name, value);
                }
            }
        }

        // delete properties that are not found in json
        if (!keepOldProperties && doModification){
            for (var modelProp in model) {
                if (!json[modelProp]){
                    delete model[modelProp];
                }
            }
        }
        return true;
    }

    /**
     * Preforms the merge operation on this. The merge opperation will add properties that exist in the merged object
     * but not in this, remove those that are not found in the merged object (unless keepOldProperties is set to true)
     * and will call setValue for those that exist in both. Note the operation will log an error to the console, return
     * false, and not modify the object if any of the setValue operation are not valid. Not valid set operations inclded
     * those that try to set a value from a property to a model and vise versa.
     *
     * @example
     * For an example see: <b>testModelMergeMethod</b>
     *
     * @method  merge
     *
     * @param  {[Object]} json              The json object to have merged.
     * @param  {[Boolean]} keepOldProperties? True if you want to keep properties that exist in this but not in the passed in json, Otherwise they will be deleted. Defaults to false.
     * @return {Model}                   Returns true if merge was successful, false otherwise.
     */
    Model.prototype.merge = function (json, keepOldProperties) {
        //will merge the properties in json with this. result will be the same as the Object extend.
        //if a property exists in the model but not in the json it will only be kept if keepOldProperties is true.
        if (mergeLoop(this, json, false, keepOldProperties)){// check if merge will be successful
            Model.startTransaction();
            mergeLoop(this, json, true, keepOldProperties);
            Model.endTransaction();
            return true;
        } else {
            window.console.error("Merge operation Not Supported: An assignment was not valid. Model not modified");
            return false;
        }
    };


    /**
     * Retrieves the json representation of this. This json representation can be used in the Model Constructor to recreate
     * the same Model object. If you use includeMetaData validator metadata will be included.
     *
     * @example
     * For an example see: <b>testSaveLoadWithMetaData</b>
     *
     * @method  toJSON
     *
     * @param  {[Boolean]} includeMetaData? indicates if model meta data should be included in the returned JSON. Defaults to false.
     * @return {[Object]}                 The json representation of the Model.
     */
    Model.prototype.toJSON = function (includeMetaData) {
        var json = {};
        Object.keys(this).forEach( function (name){
            var property = this[name];
            if (property instanceof Model) {
                json[name] = property.toJSON(includeMetaData);
            } else {
                var value = this[name].getValue();
                json[name] = value;
                if (includeMetaData && this[name]._metadata && !isEmptyObject(this[name]._metadata)){
                    json[name + Model.PROPERTY_METADATA_SERIALIZED_NAME_SUFFIX] = this[name]._metadata;
                }
            }
        }, this);
        return json;
    };

   /**
     * Begins a transaction. All events will be put into the queued. To be fired when endTransaction is called.
     *
     * @example
     * For an examples see <b>testModelTransactions</b>
     *
     * @for  Model
     * @method  startTransaction
     * @static
     *
     */
    Model.startTransaction = function () {
        eventProxy.startTransaction();
    };


    /**
     * Ends the current transaction causing all queued up events to be fired according to the global eventOptization settings or the settings passed in if they exist.
     *
     * @example
     *     model.endTransaction(); //uses settings found in Model.eventOptimization
     *     model.endTransaction({   // override the Model.eventOptimization settings for this transaction
     *         suppressPreviousPropertyChangeEvents: false,
     *         enableSingleCallbackCall: true,
     *         enableCallbackHashOpimization: true
     *     })
     * For more examples see: <b>testSingleCallbackEventOptimization</b>, <b>testEnableCallbackHashOpimization</b>,
     *      <b>testModelEndTransactionWithOptions</b>
     *
     * @for     Model
     * @method  endTransaction
     * @static
     *
     * @param  {Object} options? A map of Model.eventOptimization options that you want overridden when clearing this transaction queue.
     */
    Model.endTransaction = function (options) {
        var originalEventOptimization;

        if (options){ // if option override global setting keeping them so they can be restored later
            originalEventOptimization = JSON.parse(JSON.stringify(Model.eventOptimization));
            Model.eventOptimization.suppressPreviousPropertyChangeEvents = !!options.suppressPreviousPropertyChangeEvents;
            Model.eventOptimization.enableSingleCallbackCall = !!options.enableSingleCallbackCall;
            Model.eventOptimization.enableCallbackHashOpimization = !!options.enableCallbackHashOpimization;
        }

        eventProxy.endTransaction();

        if (options){ //restore global settings
            Model.eventOptimization.suppressPreviousPropertyChangeEvents = originalEventOptimization.suppressPreviousPropertyChangeEvents;
            Model.eventOptimization.enableSingleCallbackCall = originalEventOptimization.enableSingleCallbackCall;
            Model.eventOptimization.enableCallbackHashOpimization = originalEventOptimization.enableCallbackHashOpimization;
        }

    };

    /**
     * Determines if you are currently in a start/end transaction block.
     *
     * @example
     * For an examples see <b>testModelTransactions</b>
     *
     * @for  Model
     * @method  inTransaction
     * @static
     *
     * @return {[Boolean]} True if your in a transaction block, false otherwise.
     */
    Model.inTransaction = function() {
        return eventProxy.inTransaction();
    };

    Model.eventOptimization = {
        /**
            Only fires last Property Change of a property during a transaction.
            @Example For an example see <b>testSuppressPreviousPropertyChangeEventsEventOptimization</b>
            @property eventOptimization.suppressPreviousPropertyChangeEvents
            @default false
            @static
            @type {boolean}
        */
        suppressPreviousPropertyChangeEvents: false,
        /**
            Will make sure a callback only gets called only once during a transaction. Even if registered with several properties.
            @Example For an example see <b>testSingleCallbackEventOptimization</b>
            @property eventOptimization.enableSingleCallbackCall
            @default false
            @static
            @type {boolean}
         **/
        enableSingleCallbackCall: false,
        /**
            Will make sure callbacks identified by .hash only gets called only once during a transaction. Even if registered with several properties.
            @Example For an example see <b>testEnableCallbackHashOpimization</b>
            @property eventOptimization.enableCallbackHashOpimization
            @default false
            @static
            @type {boolean}
        */
        enableCallbackHashOpimization: false
    };
    Object.seal(Model.eventOptimization);

    var oldModel = window.Model;
    /**
     * Release control of the global window.Model variable restoring it to its previous value
     *
     * @Example
     *     // window.Model is restore to previous value and localModel now holds the window.Model reference
     *     var localModel = window.Model.noConflict();
     * For an example see <b>testEnableCallbackHashOpimization</b>
     *
     * @for  Model
     * @method  noConflict
     * @static
     *
     * @return {[Model]} The window Model variable that was just released.
     */
    Model.noConflict = function () {
        window.Model = oldModel;
        return this;
    };

    /** @global */
    window.Model = Model;
}(window));