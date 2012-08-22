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
 * - Can register onChange events with any property or group of properties
 * - Model change events bubble up.
 * - Can tie validation methods to model properties
 * - Can suppress events completely or delay them by putting them into a transaction.
 *
 *
 * TODO:
 *  - Optimize Transaction callbacks, by being smart/removing duplicates etc...
 *  - hook up/create/clean documentation and document methods properly.
 *  - clean up unit tests
 *  - consider deleteProperty method.
 *
 * BUGS:
 * - The callback executed when listening to modelChange event on one of your childrens needs to refined
 *     to make more sense. Right now its the same as a property change.
 * - bug in testComplexChangePropertyValue need to fix
 */

(function (window, undefined) {
    "use strict";

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
    function Property (value, parent, options) {

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
            value: options,
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
            get: function () {return this._myValue;},
            set: function (newValue) { this.setValue(newValue);}
        });

        this.setValue(value);
    }

    /**
     * [getter_setter description]
     * @param  {[type]} newValue The Value you want to assign to the Property.
     * @param  {[type]} options  May contain the following:
     *                           suppressNotifications - boolean indicating if listeners should be notified of change.
     *
     *
     * @return {[type]}          The resulting value of the Property
     */
    Property.prototype.setValue = function (value) {
        var newValue,
            suppressNotifications = false;

        if (value !== null && typeof value === 'object' && value._value) {
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

                if (newValue instanceof Property || newValue instanceof Model){
                    //TODO Test failing for this case because _parent is immutable. see testComplexChangeProperty Value
                    newValue._parent = this;
                    this._myValue = newValue;
                } else if (newValue !== null && typeof newValue === 'object') {
                    this._myValue = new Model(newValue, this);
                } else {
                    this._myValue = newValue;
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
     * @param {[type]} json [description]
     */
    function Model (json, parent, options) {
        var jsonModel = json || {};

        //A Model is in itself a Property so let inherit property
        // call with empty options for now and this is the value
        Property.call(this, this, parent, options);
/*
        Object.defineProperty(this, "onChange", {
            value: this.addChangeCallback
        });
 */
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
        if (value !== null && typeof value === 'object'){
            this[name] = new Model(value, this, options);
        } else {
            this[name] = new Property (value, this, options);
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
             var value = this[name]._value;
             if (value instanceof Model) {
                json[name] = value.toJSON();
             } else {
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

    window.Model = Model;
}(window));