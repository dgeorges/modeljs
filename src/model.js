/**
 * Model js - A simple javascript library for creating the Model part of a MVC application.
 * https://github.com/dgeorges/modeljs.git
 * @version 1.0.0
 * @author Daniel Georges
 *
 *
 * Features
 * - Simple easy to use and intuitive Model library
 * - Can save/load Model to/from JSON with/without model meta data
 * - Can register onChange events with any single property or group of properties
 * - Model change events bubble up.
 * - Can tie validation methods to models and properties
 * - Can suppress events notification.
 * - Can batch changes into a transaction.
 * - Logs error Message to concole when api used incorrectly to help catch bugs
 *
 *
 * TODO:
 *  - Optimize Transaction callbacks, by being smart/removing duplicates etc...
 *  - hook up/create/clean documentation and document methods properly.
 *  - clean up unit tests
 *  - add basic validators that can be reused.
 *  - set up gitHub site
 *
 * BUGS:
 * - The callback executed when listening to modelChange event on one of your childrens needs to refined
 *     to make more sense. Right now its the same as a property change.
 */

(function (window, undefined) {
    "use strict";

    // copied from underscorejs
    function isObject (obj) {
        return obj === new Object(obj) && Object.prototype.toString.call(obj) != '[object Function]';
    }

    /**
     * Centralized place where all Model Events pass through.
     * @type {Object}
     */
    var eventProxy = function () {
        var eventQueue = [],
            state = {   ACTIVE: "active", TRANSACTION: "transaction"},
            currentState = state.ACTIVE;

        function _fireEvent(property, oldValue) {

            // This weird executeCallback function is a bit more complicated than it needs to be but is
            // used to get around the JSLint warning of creating a function within the while loop below
            var executeCallbacksFunction = function (oldValue, property) {
                return function (callback){
                    callback.call(null, oldValue, property._value);
                };
            };

            property.getListeners().forEach(
                executeCallbacksFunction(oldValue, property)
            );

            var propertyParent = property.getParent();
            while (propertyParent){

                propertyParent.getListeners(false).forEach(
                    executeCallbacksFunction(oldValue, propertyParent)
                );
                propertyParent = propertyParent.getParent();
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

            if(Model.eventOptimizationEnabled){
                //do something clever.
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
     * A given property in the model.
     *
     * @param {[type]} value   property Value
     * @param {[type]} options May contain the following:
     *                         validator - a function to validate the new value is valid before it is assigned.
     */
    function Property (name, value, parent, options) {

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

        Object.defineProperty(this, "_options", {
            value: options || {},
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

        Object.defineProperty(this, "_value", {
            get: function () { //ideally would like to override the getter in the Model calss but this will have to do.
                if (this instanceof Model) {
                    return this.toJSON();
                } else {
                    return this._myValue;
                }
            },
            set: function (newValue) { this.setValue(newValue);}
        });

        this.setValue(value);
    }

    Property.prototype.getName = function () {
        return this._name;
    };

    /**
     * [getter_setter description]
     * @param  {[type]} newValue The Value you want to assign to the Property.
     * @param  {[type]} options  May contain the following:
     *                           suppressNotifications - boolean indicating if listeners should be notified of change.
     *
     * @return {[type]}          The resulting value of the Property
     */
    Property.prototype.setValue = function (value) {
        var newValue,
            suppressNotifications = false;

        if (isObject(value) && value._value) {
            newValue = value._value;
            suppressNotifications = value.suppressNotifications;
        } else {
            newValue = value;
        }

        // Note: this disallows setting a property to undefined. Only when it's first created can it be undefined.
        if (newValue !== undefined && newValue !== this._myValue) {
            var validationFunction = this._options && this._options.validator;

            if (!validationFunction || validationFunction(newValue)){
                var oldValue = this._myValue;

                if (newValue instanceof Property || newValue instanceof Model ) {
                    // this is misleading syntax because other property attributes are not copied like _listener and _parent
                    // so prevent it and provide alternate.
                    window.console.error("Incorrect Syntax: use ._value = [property|model]._value instead");
                } else if (isObject(newValue)) {
                    if (!(this instanceof Model)){
                        window.console.error("Not Supported: Can't set the Model value to a property. Delete the model and use createProperty");
                    } else {
                        //This model need to be set to the newValue
                        this.merge(newValue, false);
                    }
                } else { // newValue is a property
                    if (this instanceof Model){
                        window.console.error("Not Supported: Can't set a Property value to a model. Delete the propert and use createProperty");
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
     * [addChangeCallback description]
     * @param {Function} callback [description]
     * @param {[type]}   options May contain the following:
     *                         listenToChildren - register the listener with any sub property change.
     */
    Property.prototype.onChange = function (callback, options) {
        if (options && options.listenToChildren){
            this._modelListeners.push(callback);
        } else {
            this._propertyListeners.push(callback);
        }
    };

    Property.prototype.getOptions = function () {
        return this._options;
    };

    Property.prototype.hasValidator = function () {
        return !!this._options.validator;
    };

    Property.prototype.validateValue = function (value) {
        if (this._options.validator){
            return this._options.validator(value);
        }
        return true;
    };
    //don't want a set validator function.

    Property.prototype.getListeners = function (type) { //TODO type is very undiscriptive
        if (type === undefined){ //return all listeners
            return this._propertyListeners.concat(this._modelListeners);
        } else if (type) {
            return this._propertyListeners;
        } else {
            return this._modelListeners;
        }

    };

    Property.prototype.getParent = function () {
        return this._parent;
    };

    /**
     * The model Object that wraps the JSON.
     * @param {[type]} options May contain the following:
     *                         validator - a function to validate the new value is valid before it is assigned.
     *                         name - name of modei
     * @param {[type]} json [description]
     */
    function Model (json, options, parent) {
        var jsonModel = json || {} ,
            modelOptions = options|| {},
            modelName = (modelOptions.name || "root"),
            modelParent = parent || null;

        //A Model is in itself a Property so let inherit property
        // call with empty options for now and this is the value
        Property.call(this, modelName, jsonModel, modelParent, modelOptions);

        Object.keys(jsonModel).forEach(function (name){

            if (name.match(Model.PROPERTY_OPTIONS_SERIALIZED_NAME_REGEX)){
                return;
            }

            var value = jsonModel[name];
            var options = json[name + Model.PROPERTY_OPTIONS_SERIALIZED_NAME_SUFFIX];

            this.createProperty(name, value, options);
        }, this);
    }
    Model.prototype = Object.create(Property.prototype);


    Model.PROPERTY_OPTIONS_SERIALIZED_NAME_SUFFIX = "__modeljs__options";
    Model.PROPERTY_OPTIONS_SERIALIZED_NAME_REGEX = /__modeljs__options$/;

    /**
     * [createProperty description]
     * @param  {[type]} name    [description]
     * @param  {[type]} value   [description]
     * @param  {[type]} options [description]
     * @return {[type]}         [description]
     */
    Model.prototype.createProperty = function createProperty(name, value, options) {
        if (value instanceof Model || value instanceof Property){
            window.console.error("Unsupported Opperation: Try passing the Model/Properties value instead");
        } else if (isObject(value)){
            var modelOptions = options || {};
            modelOptions.name = name;
            this[name] = new Model(value, modelOptions, this);
        } else {
            this[name] = new Property (name, value, this, options);
        }
    };

    Model.prototype.clone = function (){
        return new Model(this.toJSON(), this.getOptions(), this.getParent());
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
                            model[name]._value = value;
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

    Model.prototype.merge = function (json, keepOldProperties) {
        //will merge the properties in json with this. result will be the same as the Object extend.
        //if a property exists in the model but not in the json it will only be kept if keepOldProperties is true.
        if (mergeLoop(this, json, false, keepOldProperties)){// check if merge will be successful
            Model.startTransaction();
            mergeLoop(this, json, true, keepOldProperties);
            Model.endTransaction();
        } else {
            window.console.error("Operation Not Supported: Model assignment not valid. Model not modified");
            return;
        }
    };

    /**
     * [toJSON description]
     * @param  {[type]} includeMetaData indicates if model meta data should be included in the returned JSON
     * @return {[type]}                 The json representation of the Model.
     */
    Model.prototype.toJSON = function (includeMetaData) {
        var json = {};
        Object.keys(this).forEach( function (name){
            var property = this[name];
            if (property instanceof Model) {
                json[name] = property.toJSON(includeMetaData);
            } else {
                var value = this[name]._value;
                json[name] = value;
                if (includeMetaData && this[name].getOptions()){
                    json[name + Model.PROPERTY_OPTIONS_SERIALIZED_NAME_SUFFIX] = this[name].getOptions();
                }
            }
        }, this);
        return json;
    };

    Model.startTransaction = function () {
        eventProxy.startTransaction();
    };

    Model.endTransaction = function () {
        eventProxy.endTransaction();
    };

    Model.inTransaction = function() {
        eventProxy.inTransaction();
    };

    Model.eventOptimizationEnabled = false;

    window.Model = Model;
}(window));