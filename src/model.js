/**
 * Model js - A simple javaScript library for creating the Model part of a MVC application.
 * https://github.com/dgeorges/modeljs.git
 *
 * Copyright 2012, Daniel Georges
 * modeljs is distributed freely under a MIT license
 *
 * @project modeljs
 * @author Daniel Georges
 * @version 2.1.0
 * @module Model
 */
(function (globalNS, undefined) { //globalNS === window in the browser or GLOBAL in nodejs
    "use strict";

    // copied from underscorejs
    function isFunction(fn) {
        return !!fn && Object.prototype.toString.call(fn) === '[object Function]';
    }

    function isObject(obj) {
        return obj === new Object(obj) && !isFunction(obj) && !Array.isArray(obj) && !(obj instanceof Date);
    }

    function extend(destination, source) {
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    }

    function isEmptyObject(obj) {
        if (Object.getOwnPropertyNames) { // only exits on ECMAScript 5 compatible browsers
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isValidDate(d) {
        if (Object.prototype.toString.call(d) !== "[object Date]") {
            return false;
        }
        return !isNaN(d.getTime());
    }

    function log(level, message) {
        //Only log when enabled and console log method is available
        if (Model.enableLogging && typeof globalNS.console === 'object' && globalNS.console[level]) {
            globalNS.console[level](message);
        }
    }

    var getXHRObject = (function () {
        if (globalNS.XMLHttpRequest) { // Mozilla, Safari, ...
            return function () {
                return new XMLHttpRequest();
            };
        } else if (globalNS.ActiveXObject) { // IE
            try {
                new ActiveXObject("Msxml2.XMLHTTP");
                return function () {
                    return new ActiveXObject("Msxml2.XMLHTTP");
                };
            } catch (e1) {
                try {
                    new ActiveXObject("Microsoft.XMLHTTP");
                    return function () {
                        return new ActiveXObject("Msxml2.XMLHTTP");
                    };
                } catch (e2) {
                    //do nothing
                }
            }
        }

        log('error', "Could not create an XMLHTTPRequestObject Remote Model requests will fail");
        return undefined;
    }());

    function makeJSONPRequest(url, id) {
        var scriptTag = document.createElement("SCRIPT");
        scriptTag.id = id;
        scriptTag.type = 'text/javascript';
        scriptTag.src = url;
        document.getElementsByTagName('head')[0].appendChild(scriptTag);
    }

    var callbackId = 0;
    function generateJSONPCallback(property) {
        var fnName = "modeljsJSONPCallback" + callbackId++;
        window[fnName] = function (property, json) { //create global callback
            property.setValue(json);
            var scriptElement = document.getElementById(fnName);
            document.getElementsByTagName('head')[0].removeChild(scriptElement); //remove callback script
            try {
                delete window[fnName]; // remove global callback method
            } catch (e) {
                // this seems to throw and exception in IE8 so we will release it get garbage collected.
                window[fnName] = undefined;
            }
        }.bind(null, property);
        return fnName;
    }

    function makeRemoteRequest(property) {
        var url = property.getMetadata().url;
        if (property.getMetadata().isJSONPurl) {
            var uniqueCallbackId = generateJSONPCallback(property);
            url = url.replace("$jsonpCallback", uniqueCallbackId);
            makeJSONPRequest(url, uniqueCallbackId);
        } else {
            var httpRequest = getXHRObject();
            httpRequest.onreadystatechange = retrieveRemoteRequest.bind(null, httpRequest, property);
            //httpRequest.orgin = "localhost:8080";
            //httpRequest.setRequestHeader
            httpRequest.open('GET', url);
            httpRequest.send();
        }
    }

    function retrieveRemoteRequest(xhr, property, xhrProgressEvent) {
        if (xhr.readyState === 4) {

            if (xhr.status !== 200) {
                log('warn', "Remote request for " + property.getName() + " failded due to return status of " + xhr.status);
                if (property.getMetadata().refreshRate === -1) {
                    log('warn', "Retrying remote request for " + property.getName() + " in 2 seconds");
                    setTimeout(makeRemoteRequest.bind(null, property), 2000);// try again in 2 sec
                }
                return;
            }

            if (xhr.responseType !== "json" && xhr.responseType !== "") {
                log('error', "Remote model (" + property.getName() + ") must return JSON. Not retrying.");
                return;
            }

            //look into ArrayBuffer
            var jsonResponse = {};
            try {
                jsonResponse = JSON.parse(xhr.response);
            } catch (e) {
                log('error', "Unable to parse remote Model request for " + property.getName());
                return; //should retry? makeRemoteRequest(property);
            }

            //use response header Last-Modified time stamp to determine if we should call setValue
            var responseLastModifiedDate = xhr.getResponseHeader("Last-Modified") && new Date(xhr.getResponseHeader("Last-Modified"));
            if (responseLastModifiedDate && isValidDate(responseLastModifiedDate)) {
                var metadata = property.getMetadata();
                var propertyLastModified = metadata.lastModified && new Date(metadata.lastModified);
                if (!propertyLastModified || !isValidDate(propertyLastModified) || // my last Modified date isn't valid
                        Date.parse(responseLastModifiedDate) > Date.parse(propertyLastModified)) { //  or it is and it's stale
                    property.setValue(jsonResponse);
                    metadata.lastModified = responseLastModifiedDate;
                } else {
                    // fetch data hasn't changed.
                }
            } else { // no last Modified date in response header, always setValue
                property.setValue(jsonResponse);
            }
        }
    }

    /*
     * Centralized place where all Model Events pass through.
     */
    var eventProxy = (function () {
        var eventQueue = [],
            state = {
                ACTIVE: "active",
                TRANSACTION: "transaction"
            },
            currentState = state.ACTIVE;

        var executedCallbacks = [];
        var callbackHashs = [];

        function _fireEvent(eventName, property, eventArgs) {

            // This weird executeCallback function is a bit more complicated than it needs to be but is
            // used to get around the JSLint warning of creating a function within the while loop below
            var executeCallbacksFunction = function (thisProperty, callbackArgs) {
                return function (callback) {
                    if (Model.TRANSACTION_OPTIONS.flattenCallbacks || Model.TRANSACTION_OPTIONS.flattenCallbacksByHash) {
                        var callbackExecuted = false;
                        if (Model.TRANSACTION_OPTIONS.flattenCallbacks) {
                            if (executedCallbacks.indexOf(callback) === -1) { // Only call callback once
                                executedCallbacks.push(callback);
                                callback.apply(thisProperty, callbackArgs);
                                callbackExecuted = true;
                            }
                        }
                        if (Model.TRANSACTION_OPTIONS.flattenCallbacksByHash) {
                            if (!callback.hash || callbackHashs.indexOf(callback.hash) === -1) { // Only call hash identified callback once
                                if (callback.hash) {
                                    callbackHashs.push(callback.hash);
                                }
                                if (!callbackExecuted) {
                                    callback.apply(thisProperty, callbackArgs);
                                    callbackExecuted = true;
                                }
                            }
                        }
                    } else {
                        callback.apply(thisProperty, callbackArgs);
                    }
                };
            };

            var callbackArgs = [property].concat(eventArgs);
            var eventListeners = property._eventListeners[eventName] || [];
            if (eventName === Model.Event.PROPERTY_CHANGE) {
                eventListeners = eventListeners.concat(property._eventListeners.change);
            } else if (eventName === Model.Event.MODEL_CHANGE) {
                eventListeners = eventListeners.concat(property._eventListeners.change);
            } else if (eventName === Model.Event.CHANGE) {
                eventListeners = eventListeners.concat(property._eventListeners.propertyChange);
            }

            // update listeners registered for the event
            eventListeners.forEach(
                executeCallbacksFunction(property, callbackArgs)
            );
            property._eventListeners.all.forEach(
                executeCallbacksFunction(property, callbackArgs.concat(eventName))
            );

            //MODEL_CHANGE only propagates from the following events
            if (eventName === Model.Event.CHANGE || eventName === Model.Event.MODEL_CHANGE || eventName === Model.Event.PROPERTY_CHANGE ||
                eventName === Model.Event.CHILD_CREATED || eventName === Model.Event.CHILD_DESTROYED) {
                // propagate change up the stack for the following events by notifying all parent ModelChange listers registered.
                var propertyParent = property._parent;
                while (propertyParent) {
                    var parentListeners = propertyParent._eventListeners.modelChange.concat(propertyParent._eventListeners.change);
                    parentListeners.forEach( // when we bubble the event we only notify modelListeners
                        executeCallbacksFunction(propertyParent, callbackArgs)
                    );
                    propertyParent = propertyParent._parent;
                }
            }
        }

        function fireEvent(eventName, property, customArgs) {
            if (currentState === state.ACTIVE) { // fire event now.
                _fireEvent(eventName, property, customArgs);
            } else { //place event on queue to be called at a later time.
                eventQueue.push({
                    eventName: eventName,
                    property: property,
                    customArg: customArgs
                });
            }
        }

        function flushEventQueue() {

            executedCallbacks = []; //reset state
            callbackHashs = [];
            if (Model.TRANSACTION_OPTIONS.suppressAllEvents) {
                //discard all events
                eventQueue = [];
            } else if (Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent) {
                var optimizedQueue = [];
                var seenProperties = [];
                for (var i = eventQueue.length - 1; i >= 0; i -= 1) { // iterate backwards since last events are most recent.
                    var eventProperty = eventQueue[i].property;
                    if (seenProperties.indexOf(eventProperty) === -1) {
                        // Not seen yet add it.
                        seenProperties.push(eventProperty);
                        optimizedQueue.push(eventQueue[i]);
                    } else {
                        //eventQueue[i] = null; // null out event since it's propertyChange is on the Queue Already
                    }
                }
                eventQueue = optimizedQueue;
            }

            eventQueue.forEach(function (event) {
                _fireEvent(event.eventName, event.property, event.customArg);
            });
            eventQueue = []; //Queue has been flushed
        }

        function changeState(newState) {
            if (state[newState] !== currentState) {
                currentState = newState;
                if (newState === state.ACTIVE) {
                    flushEventQueue();
                }
            }
        }

        return {
            fireEvent: fireEvent,
            startTransaction: changeState.bind(null, state.TRANSACTION),
            endTransaction: changeState.bind(null, state.ACTIVE),
            inTransaction: function () {
                return currentState === state.TRANSACTION;
            }
        };
    }());

    /*
     * An Observable Array is a wrapper around the javaScript Array primitive which will
     * trigger the correct events when any of it mutator methods are called. It is not
     * exposed outside of this file.
     */
    function ObservableArray(myProperty, values) {
        for (var i =0; i < values.length; i++){
            this.push(values[i]);
        }
    }
    ObservableArray.prototype = Object.create(Array.prototype);

    ObservableArray.prototype.pop = function () {
        var args = Array.prototype.slice.call(arguments),
            element = Array.prototype.pop.apply(this, args);
        element.destroy();
        return element;
    };
    ObservableArray.prototype.push = function () {
        var args = Array.prototype.slice.call(arguments),
            length = this.length,
            pushedArgs = [],
            property,
            i = 0;
        for (i = 0; i < args.length; i++) {
            if ((args[i] instanceof Property) || Model.isArray(args[i])) {
                log('error', "Incorrect Syntax: use push([property].getValue()) instead");
                return;
            }
            this._myValue.push(args[i]);
            property = _createProperty(length + i, args[i], this, {});
            pushedArgs.push(property);
        }
        var newLength = Array.prototype.push.apply(this, pushedArgs);
        for (i = 0; i < pushedArgs.length; i++) {
            this.trigger(Model.Event.CHILD_CREATED, pushedArgs[i]);
        }
        return newLength;
    };
    ObservableArray.prototype.reverse = function () {
        var args = Array.prototype.slice.call(arguments),
            newValue = Array.prototype.reverse.apply(this.getValue(), args);
        this.setValue(newValue);
        return this;
    };
    ObservableArray.prototype.shift = function () { // removes first element
        var arrayValue = this.getValue(),
            removed = arrayValue.shift(),
            removedProperty = this[this.length - 1];

        this.setValue(arrayValue); // set value will set all the values correctly and delete the last property
        return removedProperty;
    };
    ObservableArray.prototype.sort = function () {
        var args = Array.prototype.slice.call(arguments),
            result = Array.prototype.sort.apply(this.getValue(), args);
        this.setValue(result);
        return this;
    };
    ObservableArray.prototype.splice = function () {
        var args = Array.prototype.slice.call(arguments),
            arrayValue = this.getValue(),
            returnValue = Array.prototype.splice.apply(arrayValue, args);

        this.setValue(arrayValue);
        return returnValue; // this is an array of primitives not Property Objects
    };
    ObservableArray.prototype.unshift = function () {
        var args = Array.prototype.slice.call(arguments),
            currentValue = this.getValue(),
            returnValue = Array.prototype.unshift.apply(currentValue, args);

        this.setValue(currentValue);
        return returnValue;
    };

    /**
     * A Property is a name value pair belonging to a Model.
     *
     * @class Property
     * @constructor
     * @private used internally by the Model.prototype.createProperty method.
     *
     * @param {[String]} name    The name of the property
     * @param {[String, Boolean, Number, null, Date, Function, Object]} value   The Property Value
     * @param {[Model]} parent  The parent property
     * @param {[Object]} metadata The metadata associated with the property. You can put any metadata you want. However the following keys have special meaning and are reserved for use by the framework.
     *                         validator - a function to validate if the new value is valid before it is assigned.
     *                         url - the resource this model should use to get it's value. Resource must return json. *Must be used with refreshRate*
     *                         refreshRate - the interval used to query the url for changes. must be > 0. minimal value used is 100. -1 indicates to only fetch value once. *Must be used with url*
     */
    function Property (name, value, parent, metadata) {

        var myName = "/" + name;
        if (parent) {
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

        Object.defineProperty(this, "_metadata", {
            value: metadata || {},
            enumerable: false
        });

        Object.defineProperty(this, "_eventListeners", {
            value: { //map of eventName to listener array. The following are modeljs Events
                propertyChange: [],
                modelChange: [],
                change: [],
                childCreated: [],
                childDestroyed: [],
                destroy: [],
                all: []
            },
            enumerable: false
        });

        var myValue = value;
        //make sure value is valid
        if (!this.validateValue(myValue)) {
            myValue = undefined;
        }

        Object.defineProperty(this, "_myValue", {
            value: myValue,
            enumerable: false,
            writable: true
        });
    }

    /**
     * Gets the value of the property.
     *
     * @method  getValue
     *
     * @return {[String, Boolean, Number, null, Date, Function]} The value of the property
     */
    Property.prototype.getValue = function () {
        return this._myValue;
    };

    Property.prototype.toJSON = function () {
        if (this.getMetadata().doNotPersistValue || this.getMetadata().doNotPersist) {
            return undefined;
        }
        return this.getValue();
    };

    /**
     * Return the formatted value calculated by passing this.getValue() to the this.getMetadata().Formatter function
     * if it exists. If the metadata Formatter does not exist it will fall back to the global Formatter located at
     * Model.Formatter. If that does not exist it will return this.getValue();
     *
     * @method getFormattedValue
     *
     * @return {any} The formatted Value
     */
    Property.prototype.getFormattedValue = function () {
        if (isFunction(this.getMetadata().Formatter)) {
            return this.getMetadata().Formatter(this.getValue());
        } else if (isFunction(Model.Formatter)) {
            return Model.Formatter.call(this, this.getValue());
        }
        // default
        return this.getValue();
    };

    /**
     * The fully qualified name of this. The name is calculated by concatenating the name
     * of the parent, "/", and name of this AKA the shortName. To create a named root pass in the name option key
     * to the Model Constructor.
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
    Property.prototype.getName = function (shortName) {
        if (shortName) {
            return this._name.substring(this._name.lastIndexOf("/") + 1);
        }
        return this._name;
    };

    /**
     * The given name of the property.
     * @return {[String]} The given name of the property.
     */
    Property.prototype.getShortName = function () {
            return this._name.substring(this._name.lastIndexOf("/") + 1);
    };


    /**
     * Called to set the value of a property. If the setValue is the same as the current value,
     * nothing will happen and no change events will be fired. If the value is different it must pass
     * the validator if there is one.  If it does pass the validator and the value is changed, all registered
     * listeners will be notified unless the suppressNotifications option indicates otherwise.
     *
     * @example
     * For more examples see:  <b>testPrimitiveSetGet</b>, <b>testComplexChangePropertyValue</b> and <b>testSuppressNotifications</b>
     *
     * @method setValue
     * @for Property
     *
     * @param  {[String, Boolean, Number, null, Date, Function, Object]} newValue The Value you want to assign to the Property.
     * @param  {[Boolean]} suppressNotifications? indicates if listeners should be notified of change.
     *
     * @return {[this]} this for method chaining.
     */
    Property.prototype.setValue = function (value, suppressNotifications) {
        var newValue = value;
        // Note: this disallows setting a property to undefined. Only when it's first created can it be undefined.
        if (newValue !== undefined && newValue !== this._myValue) {

            if (this.validateValue(newValue)) {
                var oldValue = this._myValue;

                this._myValue = newValue;

                if (!suppressNotifications) {
                    this.trigger(Model.Event.PROPERTY_CHANGE, oldValue);
                }
            }
        }
        return this;
    };

    /**
     * Registers a callback function with the change event of this.  When the callback is executed it
     * will have it's 'this' context bound to this (ie. the property listening to the event). The first argument
     * will be the property that triggered the event. The final argument be the oldValue before it
     * was changed.
     *
     * @example
     *     model.onChange(callback, {listenToChildren: true}); //listens to change events on entire model
     *     model.property1.onChange(callback) //listen to change on property1 only
     *     model.subModel.onChange(callback) //listen to change on subModel only. (ie. via model.subModel.setValue(..))
     * For more examples see:  <b>testOnChangeCallbackWhenSettingToSameValue</b> and <b>testBubbleUpEvents</b>
     *
     * @method  onChange
     *
     * @param {Function} callback The function to be called if the value of this changes. The callback function will be passed the following arguments (oldValue, newValue, propertyName)
     * @param {Boolean}   listenToChildren? Registers the callback with sub property changes as well.
     */
    Property.prototype.onChange = function (callback, listenToChildren) {
        if (!isFunction(callback)) {
            log('warn', "Incorrect Syntax: callback must be a function");
            return;
        }
        if (listenToChildren) {
            this._eventListeners.change.push(callback);
        } else {
            this._eventListeners.propertyChange.push(callback);
        }
        return this;
    };

    /**
     * Removes the property and its children if any from the Model. This will fire the 'destroy' event on this and
     * the 'childDestroyed' event on the parent.
     *
     * @method  destroy
     *
     * @param  {[Boolean]} suppressNotifications? indicates if listeners should be notified of destroy.
     * @return {Property}   The deleted Property.
     */
    Property.prototype.destroy = function (suppressNotifications) {
        delete this._parent[this.getShortName()];

        if (!suppressNotifications) {
            this.trigger(Model.Event.DESTROY); //equivalent since no event arg.
            this._parent.trigger(Model.Event.CHILD_DESTROYED, this);
        }
        return this;
    };

    Property.prototype.onDestroy = function (callback) {
        return this.on(Model.Event.DESTROY, callback);
    };

    Property.prototype.getRoot = function () {
        var ancestor = this._parent;
        while (ancestor._parent !== null) {
            ancestor = ancestor._parent;
        }
        return ancestor;
    };

    // is this really needed?
    Property.prototype.getParent = function () {
        return this._parent;
    };

    /**
     * Triggers the given event on this. Passing the optional argument.
     *
     * @method  trigger
     *
     * @param  {String} eventName The name of the event.
     * @param  {Any} ...eventArgs? Any number of additional parameters to pass to the registered event callback
     * @return {Property}           Returns this for Object chaining.
     */
    Property.prototype.trigger = function (eventName /*, ...eventArgs */) {
        //Should this restrict custom types
        var eventArgs = Array.prototype.slice.call(arguments, 1);
        eventProxy.fireEvent(eventName, this, eventArgs);
        return this;
    };

    /**
     * Registers the given callback with the given events on this. When the callback is executed it
     * will have it's 'this' context bound to this (ie. the property listening to the event). The first argument
     * will be the property that triggered the event. In most cases these are the same property,
     * unless the event is bubbling up the tree. The final argument is optional and varies depending on
     * event type.
     *
     * @method  on
     *
     * @param  {String} events     One or more space separated eventNames
     * @param  {Function} callback  The function to execute when the given event is triggered
     * @return {Property}          Returns this for Object chaining.
     */
    Property.prototype.on = function (events, callback) {
        if (!isFunction(callback)) {
            log('warn', "Incorrect Syntax: callback must be a function");
            return;
        }

        var eventNames = events.split(' ');
        eventNames.forEach(function (eventName) {
            if (!this._eventListeners[eventName]) {
                this._eventListeners[eventName] = [];
            }
            this._eventListeners[eventName].push(callback);
        }, this);

        return this;
    };

    /**
     * Removes all instances of the given callback on the given events on this.
     *
     * @method off
     *
     * @param  {String} events  One or more space separated eventNames
     * @param  {Function} callback? The function to remove. if not specified all callbacks are removed
     * @return {Property}         Returns this for Object chaining.
     */
    Property.prototype.off = function (events, callback) {
        if (typeof events !== 'string') {
            log('warn', "Incorrect Syntax: events must be a string of space separated eventNames");
            return;
        }
        var eventNames = events.split(' ');
        eventNames.forEach(function (eventName) {
            if (this._eventListeners[eventName]) {
                if (isFunction(callback)) {
                    this._eventListeners[eventName] = this._eventListeners[eventName].filter(function (element, index, array) {
                        return element !== callback;
                    });
                } else {
                   this._eventListeners[eventName] = [];
                }
            }
        }, this);

        return this;
    };

    /**
     * Retrieves the metadata associated with this. The metadata is persisted with the json when you
     * pass true to the toJSON method (eg. this.toJSON(true)). Likewise the metadata will be restored
     * when creating a model from the very same json. Note: the modeljs framework uses the metadata to
     * store attributes associated the properties that is uses. As a result the following keys have special
     * meaning. <b>[validator, Formatter, name, url, refreshRate, isJSONPurl, doNotPersist, doNotPersistValue, thin]</b>
     *
     * For example see: <b>testGetMetadataMethod</b>
     *
     * @method  getMetadata
     *
     * @return {Object} A map of metadata properties associated with this.
     */
    Property.prototype.getMetadata = function () {
        return this._metadata;
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
        return isFunction(this._metadata.validator);
    };

   /**
     * Determines if the given value will pass the validation function of this.
     *
     * @example
     * For examples see:  <b>testPropertyValidationFunction</b>
     *
     * @method  validateValue
     *
     * @param  {[String, Boolean, Number, null, Date, Function]} value A value to test against the validation function if it exists.
     * @return {Boolean}      The result of passing value against the validation function if it exists. True otherwise.
     */
    Property.prototype.validateValue = function (value) {

        // disallow values that are Model Property or PropertyArray objects
        if (value instanceof Property || Model.isArray(value)) {
            // this is misleading syntax because other property attributes are not copied like _listener and _parent
            // so prevent it and provide alternate. Maybe we could clone, but the suggested is basically a clone and more transparent.
            log('error', "Incorrect Syntax: use setValue([property].getValue()) instead");
            return false;
        } else if (isObject(value) || Array.isArray(value)) { // value is a primitive (non-object && non-Array). this must be as well.
            log('error', "Not Supported: Can't set a Property value to a model or Array. Delete the property and use createProperty");
            return false;
        }

        if (this.hasValidator()) {
            return this._metadata.validator(value);
        }
        return true;
    };


    function createArrayPrototype(isA, inherits) {
        var proto = Object.create(isA);
        for (var i in inherits) {
            if (inherits.hasOwnProperty(i)) {
                proto[i] = inherits[i];
            }
        }

        return proto;
    }

   /**
     * The modeljs Property Object that extends a javaScript Array so that Array function like push,
     * pop, reverse, etc... can be used while at the same time inherited Property methods. Be
     * aware instances will return false to native Array.isArray() function. THe alternative is
     * to use Model.isArray() or Array.isArray(instance.getValue()). The former is recommended.
     *
     * @example
     * For examples see: <b>testPropertyArray</b>,  and <b>testPropertyArrayLoading</b>
     *
     * @class ArrayProperty
     * @constructor
     * @extends Property
     *
     */
    function ArrayProperty(name, value, parent, metadata) {
        Property.call(this, name, value, parent, metadata);
        ObservableArray.call(this, this, value);
    }
    ArrayProperty.prototype = createArrayPrototype(ObservableArray.prototype, Property.prototype);

    /**
     * Called to set the value of a ArrayProperty. If the setValue is the same as the current value,
     * nothing will happen and no change events will be fired. If the value is different it must pass
     * the validator if there is one.  If it does pass the validator and the value is changed, all registered
     * listeners will be notified unless the suppressNotifications option indicates otherwise.
     *
     * @method  setValue
     * @for  ArrayProperty
     *
     * @param  {[Array]} newValue The Value you want to assign to this.
     * @param  {[Boolean]} suppressNotifications? indicates if listeners should be notified of change.
     *
     * @return {[this]} this for method chaining.
     */
    ArrayProperty.prototype.setValue = function (value, suppressNotifications) {
        var newValue = value,
            i = 0;
        // Note: this disallows setting a property to undefined. Only when it's first created can it be undefined.
        if (newValue !== undefined && newValue !== this._myValue) { //!== needs to be done another way.

            if (this.validateValue(newValue)) {
                var oldValue = this._myValue;
                this._myValue = value;
                if (this.length > newValue.length) { //remove excess iterating backwards because modifying the end.
                    for (i = this.length - 1; i >= newValue.length; i-=1) {
                        this.pop(); // will fire CHILD_CREATED event
                    }
                }
                for (i = 0; i < newValue.length; i++) {
                    if (this[i]) {
                        this[i].setValue(newValue[i], suppressNotifications);
                    } else {
                        this.push(newValue[i]); // will fire CHILD_CREATED event
                    }
                }
                // fix suppressNotifications. Should be in transaction. what if transaction already there?
                if (!suppressNotifications) {
                    this.trigger(Model.Event.PROPERTY_CHANGE, oldValue);
                }
            }
        }
        return this;
    };

    ArrayProperty.prototype.getValue = function () {
        var value = [],
            i = 0;
        for (i = 0; i < this.length; i++) {
            value[i] = this[i].getValue();
        }
        return value;
    };
    ArrayProperty.prototype.toJSON = function (includeMetaData) {
        var json = [],
            i = 0,
            value;

        if (this.getMetadata().doNotPersist){
            return undefined;
        } else if (this.getMetadata().doNotPersistValue){
            return [];
        } else {
            for (i = 0; i < this.length; i++) {
                value = this[i].toJSON(includeMetaData);
                if (value !== undefined) {
                    json.push(value);
                }
            }
            return json;
        }
    };

    // setValueAt(i, value); suppose to be alternative to a[i] = .. which bypasses events
    ArrayProperty.prototype.setValueAt = function (index, value, metadata) {
        // Not sure if function required. So not documented or tested yet.
        var currentProperty = this[index];
        if (currentProperty === undefined){
            this[index] = _createProperty(index, value, this, metadata || {});
            this.trigger(Model.Event.CHILD_CREATED, this[index]);
        } else  {
            if (currentProperty.validateValue(value)) {
                currentProperty.setValue(value);
                extend(currentProperty.getMetadata(), metadata);
            } else {
                currentProperty.destroy();
                this[index] = _createProperty(index, value, this, metadata || {});
                this.trigger(Model.Event.CHILD_CREATED, this[index]);
            }
        }
    };

  /**
     * Determines if the given value will pass the validation function of this.
     *
     * @example
     * For examples see:  <b>testPropertyValidationFunction</b>
     *
     * @method  validateValue
     *
     * @param  {[Array]} value A value to test against the validation function if it exists.
     * @return {Boolean}      The result of passing value against the validation function if it exists. True otherwise.
     */
    ArrayProperty.prototype.validateValue = function (value) {

        // disallow values that are Model Property or PropertyArray objects
        if (value instanceof Property || Model.isArray(value)) {
            // this is misleading syntax because other property attributes are not copied like _listener and _parent
            // so prevent it and provide alternate. Maybe we could clone, but the suggested is basically a clone and more transparent.
            log('error', "Incorrect Syntax: use setValue([ArrayProperty].getValue()) instead");
            return false;
        } else if (!Array.isArray(value)) { // newValue is an Array
            log('error', "Not Supported: Can not set a non-Array Property to an Array. Delete the property and use createProperty passing it the array");
            return false;
        }

        if (this.hasValidator()) {
            return this._metadata.validator(value);
        }
        return true;
    };

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
     * @param {Object} json?    The json object to be modeled.
     * @param {Object} metadata? May contain the following:
     *                         name - name of the Model, defaults to "root"
     *                         *plus any properties accepted by the createProperty method metadata argument or
     *                          additional data you want stored in the metadata.
     */
    function Model(json, metadata, parent) {
        var jsonModel = json || {},
            modelMetadata = metadata || {},
            modelName = modelMetadata.name !== undefined? modelMetadata.name : "root",
            modelParent = parent || null;

        if (modelMetadata.name) { // name is not part of the metadata.
            delete modelMetadata.name;
        }

        //A Model is in itself a Property so lets call our supers constructor
        Property.call(this, modelName, jsonModel, modelParent, modelMetadata);

        if (this.validateValue(jsonModel)) {

            for (var name in jsonModel) {
                if (name.match(Model.PROPERTY_METADATA_SERIALIZED_NAME_REGEX)) { // skip special meta data properties
                    continue;
                }

                var value = jsonModel[name];
                var propertyMetadata = jsonModel[name + Model.PROPERTY_METADATA_SERIALIZED_NAME_SUFFIX];

                if (!modelMetadata.thin) {
                    this.createProperty(name, value, propertyMetadata);
                }
            }
        }
    }
    Model.prototype = Object.create(Property.prototype);

    /**
     * Determines if the parameter passed in is an modeljs Array Property.
     *
     * @static
     * @method isArray
     *
     * @param  {Property}  property  Property to test whether or not it is an Array Property.
     * @return {Boolean}          true if the Property is an Array Property, false otherwise
     */
    Model.isArray = function (property) {
        return (property instanceof ArrayProperty);
    };

    Model.isProperty = function (property) {
        return Model.isArray(property) || ((property instanceof Property) && !(property instanceof Model));
    };

    Model.PROPERTY_METADATA_SERIALIZED_NAME_SUFFIX = "__modeljs__metadata";
    Model.PROPERTY_METADATA_SERIALIZED_NAME_REGEX = /__modeljs__metadata$/;

    /**
     * Gets the value associated with the Model. This will be a json Object.
     *
     * @method  getValue
     *
     * @return {Object} The json Object represented by the model
     */
    Model.prototype.getValue = function () {
        if (this._metadata.thin) {
            return this._myValue;
        }
        return this.toJSON();
    };

    /**
     * Called to set the value of a model. If the setValue is the same as the current value,
     * nothing will happen and no change events will be fired. If the value is different it must pass
     * the validator if there is one.  If it does pass the validator and the value is changed, all registered
     * listeners will be notified unless the suppressNotifications option indicates otherwise.
     *
     * @method  setValue
     * @for  Model
     *
     * @param  {[Object]} newValue The Value you want to assign to this.
     * @param  {[Boolean]} suppressNotifications? indicates if listeners should be notified of change.
     *
     * @return {[this]} this for method chaining.
     */
    Model.prototype.setValue = function (value, suppressNotifications) {
        var newValue = value;
        // Note: this disallows setting a property to undefined. Only when it's first created can it be undefined.
        if (newValue !== undefined && JSON.stringify(newValue) !== JSON.stringify(this.getValue())) {  //TODO  figure this out

            if (this.validateValue(newValue)) {
                var oldValue = this._myValue;
                this._myValue = newValue; //set Value
                //This model need to be set to the newValue
                var mergeSuccessful = this.merge(newValue, false, suppressNotifications);
                if (!mergeSuccessful) {
                    this._myValue = oldValue; //set Value if successful
                }
                // fix suppressNotification should go around Merge!
                if (mergeSuccessful && !suppressNotifications) {
                    this.trigger(Model.Event.PROPERTY_CHANGE, oldValue);
                }
            }
        }
        return this;
    };

       /**
     * Determines if the given value will pass the validation function of this.
     *
     * @example
     * For examples see:  <b>testPropertyValidationFunction</b>
     *
     * @method  validateValue
     * @for  Model
     *
     * @param  {[Object]} value A value to test against the validation function if it exists.
     * @return {Boolean}      The result of passing value against the validation function if it exists. True otherwise.
     */
    Model.prototype.validateValue = function (value) {

        // disallow values that are Model Property or PropertyArray objects
        if (value instanceof Property || Model.isArray(value)) {
            // this is misleading syntax because other property attributes are not copied like _listener and _parent
            // so prevent it and provide alternate. Maybe we could clone, but the suggested is basically a clone and more transparent.
            log('error', "Incorrect Syntax: use setValue([model].getValue()) instead");
            return false;
        } else if (!isObject(value)) {
            log('error', "Not Supported: Can't set the Model value to a non Model value. Delete the model and use createProperty to change it's type");
            return false;
        }

        if (this.hasValidator()) {
            return this._metadata.validator(value);
        }
        return true;
    };


    var MIN_MODEL_REFRESH_RATE = 100;
    function _createProperty (name, value, parent, metadata) {
        if (value instanceof Property || Model.isArray(value)) {
            log('error', "Unsupported Operation: Try passing the Model/Properties value instead");
            return;
        } else if (Array.isArray(value)) {
            return new ArrayProperty(name, value, parent, metadata);
        } else if (isObject(value)) {
            var modelMetadata = metadata || {};
            modelMetadata.name = name;
            var model = new Model(value, modelMetadata, parent);
            if (modelMetadata.url && modelMetadata.refreshRate) {
                if (modelMetadata.refreshRate === -1){
                    makeRemoteRequest(model);
                } else {
                    var interval = Math.max(MIN_MODEL_REFRESH_RATE, modelMetadata.refreshRate);
                    var intervalId = setInterval(makeRemoteRequest.bind(null, model), interval);
                    model.getMetadata().intervalId = intervalId;
                }
            }
            return model;
        } else {
            return new Property(name, value, parent, metadata);
        }
    }

    /**
     * Creates the property with the given name on this. This will fire the childCreated event on the parent. The
     * metadata can contain custom keys or any of the special keys below.
     *
     * @example
     *     var model = new Model();
     *     model.createProperty("number", 1) // a simple property (model.number)
     *     .createProperty("subModel", { // a property that is a subModel (model.subModel and model.subModel.str)
     *         str: "stringProperty"
     *     })
     *     .createProperty("positiveNumber", 2, { // a property with a positiveNumber validator and a custom attribute
     *         validator: function (value) {
     *             return value > 0;
     *         },
     *         customMetadata: "this Property is special"
     *     }),
     *     .createProperty ("remoteModel", {prop1: "defaultValue"}, { // a remote model populated via the twitter rest api.
     *         url: "http://search.twitter.com/search.json?q=tennis&callback=$jsonpCallback",
     *         doNotPersist: true,
     *         refreshRate: -1, // -1 means fetch once.
     *         isJSONPurl: true
     *     }); // Note the method chaining.
     *
     * For examples see: <b>testModelCreationUsingCreatePropertyMethod, testThinModel</b>
     *
     * @method  createProperty
     *
     * @param {String} name    Name of the property
     * @param {[String, Boolean, Number, null, Date, Function, Object]} value   Property value
     * @param {[Object]} metadata? A hash of metadata associated with the property. You can put any metadata you want. However the following keys have special meaning and are reserved for use by the framework.
     *                         <ul><li>
     *                             <b>validator</b> {Function} - a function to validate if the new value is valid before it is assigned.
     *                         </li><li>
     *                             <b>Formatter</b> {Function} - a function that takes this.getValue() as input and output the value you want returned by the getFormattedValue function. See the documentation of getFormattedValue for more details.
     *                         </li><li>
     *                             <b>url</b> {String} - the resource this model should use to get it's value. Resource must return json. *Must be used with refreshRate*
     *                         </li><li>
     *                             <b>refreshRate</b> {Number} - the interval used to query the url for changes. must be > 100 or -1. -1 indicates to only fetch value once. *Must be used with url*
     *                         </li><li>
     *                             <b>isJSONPurl</b> {Boolean} - if true will use JSONP to fetch the data. The url provided must have the string "$jsonpCallback" where the jsonp callback function should be inserted.
     *                         </li><li>
     *                             <b>doNotPersist</b> {Boolean} - property will not exist in the json object returned by the toJSON method.
     *                         </li><li>
     *                             <b>doNotPersistValue</b> {Boolean} - will clear the value of the property when toJSON is called. For Object and Array types the value will be and empty object/array. Else it will be undefined. *Note metadata can still be persisted.
     *                         </li><li>
     *                             <b>thin</b> {Boolean} - will create a model property representing this but not model any of it's children properties
     *                         </li></ul>
     *
     * @param  {[Boolean]} suppressNotifications? indicates if listeners should be notified of change.
     *
     * @return {Model}         Returns this for method chaining
     */
    Model.prototype.createProperty = function createProperty(name, value, metadata, suppressNotifications) {

        if (value instanceof Property || Model.isArray(value)) {
            log('error', "Unsupported Operation: Try passing the Model/Properties value instead");
            return this;
        } else if (this._metadata.thin) {
            log('error', "Unsupported Operation: Can not create a property on a Thin model.");
            return this;
        }

        this[name] = _createProperty(name, value, this, metadata);
        if (!suppressNotifications) {
            this.trigger(Model.Event.CHILD_CREATED, this[name]);
        }
        return this;
    };

    /**
     * Clones the Model rooted at this keeping all metadata that exist, but not keeping any event listeners.
     * The name of all properties are adjusted to reflect it's new root.
     *
     * @example
     *     var newModel = model.clone(); // clone root model
     *     var clonedSubModel = model.subModel.clone(); // clone subModel
     * For more examples: <b>testModelClone</b>
     *
     * @method  clone
     *
     * @return {Model}  Returns a new Model object rooted at this, keeping any metadata but no event listeners.
     */
    Model.prototype.clone = function () {
        var metadata = JSON.parse(JSON.stringify(this.getMetadata()));
        metadata.name = this.getShortName();
        return new Model(this.toJSON(true), metadata);
    };

    function mergeLoop(model, json, doModification, keepOldProperties, suppressNotifications) {

        for (var name in json) {
            if (!name.match(Model.PROPERTY_METADATA_SERIALIZED_NAME_REGEX)) {
                var value = json[name];
                if (model[name]) {
                    if (isObject(value)) { // right hand side is an object
                        if (model[name] instanceof Model) { // left is and Model. -> merging objects
                            if (!mergeLoop(model[name], value, doModification, keepOldProperties, suppressNotifications)) {
                                return false;
                            }
                        } else {
                            // Trying to assign a model to a property. This will fail.
                            return false;
                        }

                    } else { // right hand side is not an object.
                        if (Model.isProperty(model[name])) { // left is a Property -> merging properties
                            if (doModification) {
                                model[name].setValue(value, suppressNotifications);
                            }
                        } else {
                            // Trying to assign a property to a Model. This will fail.
                            return false;
                        }
                    }
                } else { //create new property
                    if (doModification) {
                        model.createProperty(name, value, {}, suppressNotifications);
                    }
                }
            }

            // delete properties that are not found in json
            if (!keepOldProperties && doModification) {
                for (var modelProp in model) {
                    if (!json[modelProp] && //property does exist in merge
                            model.hasOwnProperty(modelProp) &&
                            (model[modelProp] instanceof Property || Model.isArray(model[modelProp])) &&
                            modelProp !== '_parent') { // for ECMA backwards compatibility '_parent' must be filter since its non-enumerable
                        model[modelProp].destroy(suppressNotifications);
                    }
                }
            }
        }
        return true;
    }

    /**
     * Preforms the merge operation on this. The merge operation will add properties that exist in the merged object
     * but not in this, remove those that are not found in the merged object (unless keepOldProperties is set to true)
     * and will call setValue for those that exist in both. Note the operation will log an error to the console, return
     * false, and not modify the object if any of the setValue operation are not valid. Not valid set operations included
     * those that try to set a value from a property to a model and vise versa.
     *
     * @example
     * For an example see: <b>testModelMergeMethod</b>
     *
     * @method  merge
     *
     * @param  {[Object]} json              The json object to have merged.
     * @param  {[Boolean]} keepOldProperties? True if you want to keep properties that exist in this but not in the passed in json, Otherwise they will be deleted. Defaults to false.
     * @param  {[Boolean]} suppressNotifications? indicates if listeners should be notified of change.
     * @return {Boolean}                   Returns true if merge was successful, false otherwise.
     */
    Model.prototype.merge = function (json, keepOldProperties, suppressNotifications) {
        //will merge the properties in json with this. result will be the same as the Object extend.
        //if a property exists in the model but not in the json it will only be kept if keepOldProperties is true.
        if (this._metadata.thin) {
            this._myValue = json;
            return true;
        } else if (mergeLoop(this, json, false, keepOldProperties)) { // check if merge will be successful
            Model.startTransaction();
            mergeLoop(this, json, true, keepOldProperties, suppressNotifications);
            Model.endTransaction();
            return true;
        } else {
            log('error', "Merge operation Not Supported: An assignment was not valid. Model not modified");
            return false;
        }
    };


    /**
     * Retrieves the json representation of this. This json representation can be used in the Model Constructor
     * to recreate the same Model object. If you use includeMetaData validator metadata will be included.
     * Properties that have the doNotPersist flag in it's metadata will have it's value nullified. This means
     * properties will have the value set to 'undefined' while models will be set to an empty object ({}).
     *
     * @example
     * For an example see: <b>testSaveLoadWithMetaData</b> and <b>testDoNotPersist</b>
     *
     * @method  toJSON
     *
     * @param  {[Boolean]} includeMetaData? indicates if model meta data should be included in the returned JSON. Defaults to false.
     * @return {[Object]}                 The json representation of the Model.
     */
    Model.prototype.toJSON = function (includeMetaData) {
        var json = {};
        if (this._myValue === undefined || this.getMetadata().doNotPersist) {
            return undefined;
        } else if (this.getMetadata().doNotPersistValue){
            return {};
        } else if (this.getMetadata().thin) {
            return this.getValue();
        } else {
            for (var name in this) {
                if (this.hasOwnProperty(name) &&
                    (this[name] instanceof Property || Model.isArray(this[name])) &&
                    name !== '_parent') {
                    // for ECMA backwards compatibility '_parent' must be filter since its non-enumerable. and would cause infinite recursion
                    var property = this[name];
                    if (!property.getMetadata().doNotPersist) {
                        json[name] = property.toJSON(includeMetaData);
                        if (includeMetaData && !isEmptyObject(property.getMetadata())) {
                            json[name + Model.PROPERTY_METADATA_SERIALIZED_NAME_SUFFIX] = property.getMetadata();
                        }
                    }
                }
            }
            return json;
        }
    };

    /**
     * A global formatter used to calculate the formatted value of a Property. If defined the function
     * will be called when getFormattedValue gets called. The function should accept the value to be formatted
     * as the first argument and expect 'this' to be the Property. The formatter must be able to handle any
     * input type as a value.
     *
     * @example
     *     Model.Formatter = function (value) { //makes all strings uppercase
     *         if (typeof value === 'string') {
     *             return value.toUpperCase();
     *         }
     *         return value;
     *     }
     *
     * @for  Model
     * @property  Formatter
     * @static
     *
     * @type {Function} A format function whose first argument is the value to be formatted
     * @return {any}    The formatted result
     */
    Model.Formatter = undefined;

    /**
     * If logging is enabled any warning or incorrect uses of the api will result in output to the console
     * if it exists.
     *
     * @property isLoggingEnabled
     * @default false
     * @static
     * @type {Boolean} Indicates if Logging is enabled
     */
    Model.enableLogging = false;

    /**
     * Searches the given model for the property of the given name and returns it.
     *
     * @method find
     * @static
     *
     * @param  {[Property, Model, ArrayProperty]} model        The model to search.
     * @param  {[String]} propertyName The fully qualified name of the property. Equal to the getName() value.
     * @return {[Property, Model, ArrayProperty]}   The model object of the given name, null otherwise.
     */
    Model.find = function (model, propertyName) {
        if(!((model instanceof Property) || Model.isArray(model)) || typeof propertyName !== 'string') {
            return null;
        }

        var modelName = model.getName();
        var modelParts = modelName.substring(1).split('/');
        var propertyParts = propertyName.substring(1).split('/');
        var diff = "";

        if (modelParts[0] !== propertyParts[0]) {
            return null;  //not part of same model
        }

        var i = 0;
        while (modelParts[i] === propertyParts[i] && i < propertyParts.length) {
            i++;
        }

        var j = i;
        var commonDenominator = model;
        for ( j = i; j < modelParts.length; j++) { //traverses up to the common denominator
            commonDenominator = commonDenominator._parent;
        }

        var prop = commonDenominator;
        for (var k = i; k < propertyParts.length; k++) {
            prop = prop[propertyParts[k]];
            if (!prop) {
                return null;
            }
        }
        if (prop.getName() === propertyName){
            return prop;
        }
        return null;
    };

    /**
     * Connects two properties together. So that events fired on one are also fired on the other. The options
     * specifies the type of connection to create.
     *
     * @param  {[Property]} a       The source Property
     * @param  {[Property]} b       The destination Property
     * @param  {[Object]} options? A hash of options describing how to connect the two properties.
     *                             The following option are accepted:
     *                     <ul><li>
     *                         <b>eventBlackList</b> {Array} - A array of eventNames that <b>should not</b> be connected between the two Properties, all other event are connected.
     *                     </li><li>
     *                         <b>eventWhiteList</b> {Array} - A array of eventNames that <b>should</b> be connected between the two Properties, all other events not connected.
     *                     </li><li>
     *                         <b>includeChildred</b> {boolean} - Indicates if we should connect all the children of source Property as well. The default is false.
     *                     </li><li>
     *                         <b>mapFunction</b> {function} - A function that will map PropertyNames in 'a' to propertyNames in 'b' that should be connected.
     *                         If the function returns null, the property won't be connected to anything. *This option must be used in conjunction with includeChildren=true.
     *                         If not specified the default behavior is to map all properties via the getName function. Thus only properties with the same name are connected
     *                     </li>
     *                     </li><li>
     *                         <b>direction</b> {"oneWay"|"dual"} - Specifies how you would like to connect the two Properties. If not specified default is "dual" if not specified.
     *                     </li>
     *
     * @return {[Function]}         The disconnect function. When executed will remove the connection between the properties.
     */
    Model.connect = function connect (a, b, options) { //AKA join connect, disconnect.

        var propergateAtoB,
            propergateBtoA;
            options = options || {};

        /**
         * This function is registered on the ALL event to propagate its events to the
         * connected property. FYI 'this' is bound to the source linked property.
         *
         * @param  {Boolean} isAtoB   [description]
         * @param  {[type]}  property On any event the first argument is the property the event was triggered on.
         * @return {[type]}           [description]
         */
        function propergateEvent (isAtoB, property /*, ... other event callback arguments */) {
            var eventName = arguments[arguments.length-1]; //Since this is registered on the all event the last argument is the orginal Event name.
            if (eventName === Model.Event.CHILD_DESTROYED) { //we listen to he destroy action so no need to listen to CHILD_DESTROYED too
                return;
            }
            if(options && (options.eventBlackList || options.eventWhiteList)) {
                if (options.eventBlackList && options.eventBlackList.indexOf(eventName) !== -1) {
                    return;
                }
                if (options.eventWhiteList && options.eventWhiteList.indexOf(eventName) === -1) {
                    return;
                }
            }

            var linkedProperty = this;
            var newPropDisconnect;

            // deregister our reverse connect function and put it back later, so we don't have infinite loop.
            linkedProperty.off(Model.Event.ALL, isAtoB? propergateBtoA: propergateAtoB);
            if (eventName === Model.Event.PROPERTY_CHANGE) {
                linkedProperty.setValue(property.getValue());
            } else if (eventName === Model.Event.CHILD_CREATED) {
                var newProperty = arguments[2];
                if (Model.isArray(linkedProperty)) {
                    // newProperty.getShortName() == linkedProperty.length; <- do push when this is true
                    linkedProperty.push(newProperty.getValue());
                    newPropDisconnect = connect(newProperty, linkedProperty[newProperty.getShortName()]);
                } else {
                    linkedProperty.createProperty(newProperty.getShortName(), newProperty.getValue(), newProperty.getMetadata());
                    newPropDisconnect = connect(newProperty, linkedProperty[newProperty.getShortName()]);
                }
            } else if (eventName === Model.Event.DESTROY) {
                if (Model.isArray(linkedProperty._parent) &&
                    parseInt(linkedProperty.getShortName(), 10) === linkedProperty._parent.length - 1) {
                    linkedProperty._parent.pop();
                } else {
                    linkedProperty.destroy();
                }
            } else { //custom event
                linkedProperty.trigger(eventName, Array.prototype.slice.call(arguments, 1));
            }
            linkedProperty.on(Model.Event.ALL, isAtoB? propergateBtoA : propergateAtoB);

            return newPropDisconnect; // how do we disconnect this.
        }

        function disconnect(a, b, propergateAtoB, propergateBtoA) {
            if (propergateAtoB) {
                a.off(Model.Event.ALL, propergateAtoB);
            }
            if (propergateBtoA) {
                b.off(Model.Event.ALL, propergateBtoA);
            }
        }

        // one direction
        propergateAtoB = propergateEvent.bind(b, true);
        a.on(Model.Event.ALL, propergateAtoB);

        // other direction
        if (!options.direction || options.direction !== "oneWay") {
            propergateBtoA = propergateEvent.bind(a, false);
            b.on(Model.Event.ALL, propergateBtoA);
        }

        if (options.includeChildren && (a instanceof Model || Model.isArray(a))) { // go through children
            var disconnectFunctions  = [];
            for (var propName in a) {
                if (a.hasOwnProperty(propName) &&
                        (a[propName] instanceof Property || Model.isArray(a[propName])) &&
                        propName !== "_parent") {

                        var childLinkedPropertyName = options.mapFunction ? options.mapFunction(a[propName].getName()) : a[propName].getName();
                        var childLinkedProperty = Model.find(b, childLinkedPropertyName );
                        if (childLinkedProperty) {
                            disconnectFunctions.push(Model.connect(a[propName], childLinkedProperty, options));
                        }
                    }
            }
            return function disconnect(functionsToDisconnect) {
                for (var i = 0; i < functionsToDisconnect.length; i++) {
                    functionsToDisconnect[i]();
                }
            }.bind(null, disconnectFunctions);
        }

        return disconnect.bind(null, a,b, propergateAtoB, propergateBtoA);
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
     *     model.endTransaction(); //uses settings found in Model.TRANSACTION_OPTIONS
     *     model.endTransaction({   // override the Model.TRANSACTION_OPTIONS settings for this transaction
     *         fireOnlyMostRecentPropertyEvent: false,
     *         flattenCallbacks: true,
     *         flattenCallbacksByHash: true
     *     })
     * For more examples see: <b>testFlattenCallbacks</b>, <b>testFlattenCallbacksByHash</b>,
     *      <b>testModelEndTransactionWithOptions</b>
     *
     * @for     Model
     * @method  endTransaction
     * @static
     *
     * @param  {Object} options? A map of Model.TRANSACTION_OPTIONS options that you want overridden when clearing this transaction queue.
     */
    Model.endTransaction = function (options) {
        var originalTransactionOptions;

        if (options) { // if option override global setting keeping them so they can be restored later
            originalTransactionOptions = JSON.parse(JSON.stringify(Model.TRANSACTION_OPTIONS));
            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = !!options.fireOnlyMostRecentPropertyEvent;
            Model.TRANSACTION_OPTIONS.flattenCallbacks = !!options.flattenCallbacks;
            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = !!options.flattenCallbacksByHash;
            Model.TRANSACTION_OPTIONS.suppressAllEvents = !!options.suppressAllEvents;
        }

        eventProxy.endTransaction();

        if (options) { //restore global settings
            Model.TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent = originalTransactionOptions.fireOnlyMostRecentPropertyEvent;
            Model.TRANSACTION_OPTIONS.flattenCallbacks = originalTransactionOptions.flattenCallbacks;
            Model.TRANSACTION_OPTIONS.flattenCallbacksByHash = originalTransactionOptions.flattenCallbacksByHash;
            Model.TRANSACTION_OPTIONS.suppressAllEvents = !!options.suppressAllEvents;
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

    // does property change bubble a model change?
    // does model change include this or just it's children?
    // what about change?
    Model.Event = {
        /**
         * The PROPERTY_CHANGE event is triggered only when the value of the property has changed
         * via setValue. When triggered it will bubble up a MODEL_CHANGED event. Listen to this event
         * if you only want to be notified of direct changes to the property and not changes to any of
         * it's children. This is what the onChange(callback, false) does.
         * PROPERTY_CHANGE event callbacks will be called with the following arguments:
         *      <ul>
         *      <li>this = the property listening to the event</li>
         *      <li>arg[0] = the property in it's current state</li>
         *      <li>arg[1] = the old value.</li>
         *      </ul>
         * @property Event.PROPERTY_CHANGE
         * @static
         * @type {String}
         */
        PROPERTY_CHANGE: "propertyChange",
        /**
         * The MODEL_CHANGE event is triggered when the value of any of the property's
         * children have changed. This includes child properties being created or destroyed.
         * When triggered on a property it will bubble the event up it's model tree.
         * The callback will have the following arguments:
         *      <ul>
         *      <li>this = the property listening to the event. (or is registered with the callback)</li>
         *      <li>arg[0] = the property that triggered the modelChange</li>
         *      <li>arg[1] = the old value.</li>
         *      </ul>
         * @property Event.MODEL_CHANGE
         * @static
         */
        MODEL_CHANGE: "modelChange",
        /**
         * The CHANGE event is pseudo event equivalent to a PROPERTY_CHANGE and MODEL_CHANGE event.
         * It is the event used when registering a listener using the onChange(callback, true) method.
         * The callback will have the following arguments:
         *      <ul>
         *      <li>this = the property listening to the event</li>
         *      <li>arg[0] = the property in it's current state</li>
         *      <li>arg[1] = the old value.</li>
         *      </ul>
         * @property Event.CHANGE
         * @static
         * @type {String}
         */
        CHANGE: "change",
        /**
         * The DESTROY event is triggered when destroy() method called on a property. It than triggers
         * a CHILD_DESTROYED event on it's parent.
         * The callback will have the following arguments:
         *      <ul>
         *      <li>this = the destroyed property</li>
         *      <li>arg[0] = the destroyed property</li>
         *      <li>arg[1] = the old value.</li>
         *      </ul>
         * @property Event.DESTROY
         * @static
         * @type {String}
         */
        DESTROY: "destroy",
        /**
         * The CHILD_CREATED event is triggered when a new property is created. It's triggered on the
         * parent and propagates a MODEL_CHANGE event up the model tree.
         * The callback will have the following arguments:
         *      <ul>
         *      <li>this = the parent property</li>
         *      <li>arg[0] = the created property</li>
         *      <li>arg[1] = undefined</li>
         *      </ul>
         * @property Event.CHILD_CREATED
         * @static
         * @type {String}
         */
        CHILD_CREATED: "childCreated",
        /**
         * The CHILD_Destroyed event is triggered when a child property is destroyed. It triggered on the
         * parent and propergates a MODEL_CHANGE event up the model tree.
         * The callback will have the following arguments:
         *      <ul>
         *      <li>this = the parent property</li>
         *      <li>arg[0] = the destroyed property</li>
         *      <li>arg[1] = undefined</li>
         *      </ul>
         * @property Event.CHILD_DESTROYED
         * @static
         * @type {String}
         */
        CHILD_DESTROYED: "childDestroyed",
        /**
         * A special pseudo event named "all" that equivalent to listening to all 'real' events.
         * All events are considered 'real' except for the MODEL_CHANGE event which is a special
         * propagation event and the CHANGE event which is a pseudo event.
         * Triggering the ALL event does not fire all event, but fires an event named all which will
         * call all callback registered to the ALL event. The callback will have the following arguments:
         *      <ul>
         *      <li>this = the property listening to the event</li>
         *      <li>arg[0-..n-1] = the same arguments passed to the original event</li>
         *      <li>arg[n-1] = the original event name</li>
         *      </ul>
         * @property Event.ALL
         * @static
         * @type {String}
         */
        ALL: "all"
    };


    Model.TRANSACTION_OPTIONS = {
        /**
            Only fires the last event of a property during a transaction.
            @Example For an example see <b>testFireOnlyMostRecentPropertyEvent</b>
            @property TRANSACTION_OPTIONS.fireOnlyMostRecentPropertyEvent
            @default false
            @static
            @type {boolean}
        */
        fireOnlyMostRecentPropertyEvent: false,
        /**
            Will make sure a callback only gets called only once during a transaction. Even if registered with several properties.
            @Example For an example see <b>testFlattenCallbacks</b>
            @property TRANSACTION_OPTIONS.flattenCallbacks
            @default false
            @static
            @type {boolean}
         **/
        flattenCallbacks: false,
        /**
            Will make sure callbacks identified by .hash only gets called only once during a transaction. Even if registered with several properties.
            @Example For an example see <b>testFlattenCallbacksByHash</b>
            @property TRANSACTION_OPTIONS.flattenCallbacksByHash
            @default false
            @static
            @type {boolean}
        */
        flattenCallbacksByHash: false,
        /**
            Will guarantee that no event are fired during a transaction
            @Example For an example see <b>testSuppressAllEvents</b>
            @property TRANSACTION_OPTIONS.suppressAllEvents
            @default false
            @static
            @type {boolean
        */
        suppressAllEvents: false

    };
    Object.seal(Model.TRANSACTION_OPTIONS);

    var oldModel = globalNS.Model;
    /**
     * Release control of the global window.Model variable restoring it to its previous value
     *
     * @Example
     *     // window.Model is restore to previous value and localModel now holds the window.Model reference
     *     var localModel = window.Model.noConflict();
     * For an example see <b>testModelNoConflict</b>
     *
     * @for  Model
     * @method  noConflict
     * @static
     *
     * @return {[Model]} The window Model variable that was just released.
     */
    Model.noConflict = function () {
        globalNS.Model = oldModel;
        return this;
    };


   if (typeof define === "function" && define.amd) {
        define([], function () {
            return Model;
        });
    } else if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = Model;
        }
        exports.Model = Model;
    } else {
        /** @global */
        window["Model"] = Model;
    }

}(typeof window !== 'undefined' ? window : GLOBAL)); //window in the browser and GLOBAL in node