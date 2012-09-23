/**
 * To run these tests in node execute the following command when in th modeljs directory:
 *     node ./test/modeljsNodeTests.js
 */

var ModelTests = require("./ModelTests.js");

function test (testName, testFn) {
    "use strict";
    testFn.call(ModelTests);
}

console.log("Begin Tests");

    test("testPrimitiveSaveLoad", ModelTests.testPrimitiveSaveLoad);
    test("testObjectsSaveLoad", ModelTests.testObjectsSaveLoad);
    test("testComplexSaveLoad", ModelTests.testComplexSaveLoad);
    test("testPrimitiveSetGet", ModelTests.testPrimitiveSetGet);
    test("testGetNameMethod", ModelTests.testGetNameMethod);
    test("testOnChangeCallbackWhenSettingToSameValue", ModelTests.testOnChangeCallbackWhenSettingToSameValue);
    test("testModelCreationUsingCreatePropertyMethod", ModelTests.testModelCreationUsingCreatePropertyMethod);
    test("testPropertyDestroyMethod", ModelTests.testPropertyDestroyMethod);
    test("testModelMergeMethod", ModelTests.testModelMergeMethod);
    test("testComplexChangePropertyValue", ModelTests.testComplexChangePropertyValue);
    test("testSuppressNotifications", ModelTests.testSuppressNotifications);
    test("testPropertyValidation", ModelTests.testPropertyValidation);
    test("testSaveLoadWithMetaData", ModelTests.testSaveLoadWithMetaData);
    test("testModelTransactions", ModelTests.testModelTransactions);
    test("testBubbleUpEvents", ModelTests.testBubbleUpEvents);
    test("testModelClone", ModelTests.testModelClone);
    test("testGetFormattedValue", ModelTests.testGetFormattedValue);
    test("testFireOnlyMostRecentPropertyEvent", ModelTests.testFireOnlyMostRecentPropertyEvent);
    test("testFlattenCallbacks", ModelTests.testFlattenCallbacks);
    test("testFlattenCallbacksByHash", ModelTests.testFlattenCallbacksByHash);
    test("testSuppressAllEvents", ModelTests.testSuppressAllEvents);
    test("testModelEndTransactionWithOptions", ModelTests.testModelEndTransactionWithOptions);
    //test("testModelNoConflict", ModelTests.testModelNoConflict);
    test("testInvalidInitialValue", ModelTests.testInvalidInitialValue);
    test("testGetMetadataMethod", ModelTests.testGetMetadataMethod);
    test("testCustomEvent", ModelTests.testCustomEvent);
    test("testChildCreatedEvent", ModelTests.testChildCreatedEvent);
    test("testDoNotPresist", ModelTests.testDoNotPresist);
    test("testPropertyArray", ModelTests.testPropertyArray);
    test("ModelFind", ModelTests.testModelFind);
    //asyncTest("remoteModel", ModelTests.testRemoteModel);
    //test("modlejsTutorial", ModelTests.modlejsTutorial);

console.log("End Tests");
