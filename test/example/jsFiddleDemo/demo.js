// This is your model
var model = new Model({
    name: "Name goes here"
});

// This is your controller logic.
function changeAction() {
    model.name.setValue($("#textInput").val());
}

model.name.onChange(function(property, oldValue) {
    $("#data").text(property.getValue());
});
