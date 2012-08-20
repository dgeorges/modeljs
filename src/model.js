/**
 * Model js - Utility wraps a JSON object to add basic Model Functionality
 * http://${location} TODO
 * @version 1.0.0
 * @author Daniel Georges
 *
 *
 * Features
 * - Can save/load Model to/from JSON with/without model metadata
 * - Can register onChange events with any property
 * - Can tie validation methods to model properties
 * - Can suppress events completely or delay them by putting them into a transaction.
 *
 * TODO:
 *  - Optimize Transaction callbacks, by being smart/removing duplicates etc...
 *  - hook up documentation and document methods properly.
 *
 * BUGS:
 * - currently can not registar onChange on the entire Model or group of properties(including Children)
 *      only on individuals. To fix this implement bubbling up of properties change events
 *      and when attaching a listener adding the option to be notified of all downstream changes too.
 *
 */

/**
 * Centerlized place where all Model Events pass through.
 * @type {Object}
 */
var eventProxy = function () {
    var eventQueue = [],
        state = {   ACTIVE: "active", TRANSACTION: "transaction"},
        currentState = state.ACTIVE;

    function fireEvent (property, oldValue) {
        if (currentState === state.ACTIVE){
            property.getListeners().forEach( function (callback){
                callback(oldValue, property.getter_setter());
            });
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
            event.property.getListeners().forEach( function (callback) {
                callback(event.oldValue, event.property.getter_setter());
            });
        });
    }

    return {
        fireEvent: fireEvent,
        startTransaction: changeState.bind(null, state.TRANSACTION),
        endTransaction: changeState.bind(null, state.ACTIVE),
        inTransaction: function () { return currentState === state.TRANSACTION;}
    };
}();

/**
 * A given propery in the model.
 *
 * @param {[type]} value   property Value
 * @param {[type]} options May contain the following:
 *                         validator - a function to validate the new value is valid before it is assigned.
 */
function Property (value, options) {
    this._myValue = undefined;
    this._options = options;
    this._listeners = [];
    this.getter_setter(value);
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
Property.prototype.getter_setter = function (newValue, options) {

    if (newValue !== undefined && newValue !== this._myValue) { // Note: this disallows setting a property to undefined. Only when it's first created can it be undefined.
        var validationFunction = this._options && this._options.validator;

        if (!validationFunction || validationFunction(newValue)){
            var oldValue = this._myValue;
            this._myValue = newValue;

            if (!options || !options.suppressNotifications){
                eventProxy.fireEvent(this, oldValue);
            }
        }
    }
    return this._myValue;
};

Property.prototype.addChangeCallback = function (callback) {
    this._listeners.push(callback);
};

Property.prototype.getOptions = function () {
    return this._options;
};

Property.prototype.getListeners = function () {
    return this._listeners;
};


/**
 * The model Object that wraps the JSON.
 * @param {[type]} json [description]
 */
function Model (json) {
    var jsonModel = json || {};
    var me = this;
    Object.keys(jsonModel).forEach(function (name){

        if (name.match(Model.PROPERTY_OPTIONS_SERIALIZED_NAME_REGEX)){
            return;
        }

        var value = jsonModel[name];
        var options = json[name + Model.PROPERTY_OPTIONS_SERIALIZED_NAME_SUFFIX];

        if (value !== null && typeof value === 'object'){
            var subModel = new Model(value);
            me.createProperty(name, subModel, options);
        } else {
            me.createProperty(name, value, options);
        }

    });
}

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
    var prop = new Property (value, options);

    // **hack We must bind our method to prop otherwise 'this' will be the model since we are placing the method on the model.
    var returnFunction = prop.getter_setter.bind(prop);
    returnFunction.onChange = prop.addChangeCallback.bind(prop);
    returnFunction.options = prop.getOptions(); //TODO: is this mutable? than it needs to change
    this[name] = returnFunction;
};

/**
 * [toJSON description]
 * @param  {[type]} includeMetaData indicates if model metadata should be included in the returned JSON
 * @return {[type]}                 The json representation of the Model.
 */
Model.prototype.toJSON = function (includeMetaData) {
    var json = {};
    // **hack can't seem to do forEach.call( this, ...)
    var me = this;
    Object.keys(this).forEach( function (name){
         var value = me[name]();
         if (value instanceof Model) {
            json[name] = value.toJSON();
         } else {
            json[name] = value;
            if (includeMetaData && me[name].options){
                json[name + Model.PROPERTY_OPTIONS_SERIALIZED_NAME_SUFFIX] = me[name].options;
            }

         }
    });
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