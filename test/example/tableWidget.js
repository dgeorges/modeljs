/**
 * This is a example of how to use modeljs to build a widget.
 * @param {[json, Model]} model The model representing the Table widet can be a json object or a a model
 */
var TableWidget = function TableWidget(model) {
    var tableModel = model instanceof Model ? model : new Model(model);
    var header = $("<thead/>");
    var body = $("<tbody>");
    var widget = $("<table/>").addClass("modeljs-table").append(header, body);

    function rowChangedEvent(property, oldValue) {
        var columnIndex = property.getName(true),
            rowIndex = this.getName(true),
            row = body.children()[rowIndex];

        if (Model.isArray(property)) {
            property.forEach(function (column, index) {
                $(row.children[index]).text(column.getFormattedValue());
            });
        } else {
            $(row.children[columnIndex]).text(property.getFormattedValue());
        }
    }

    function createHeader(headers) {
        var h = $("<tr/>");
        headers.forEach( function(key) {
            h.append($("<th/>").text(key));
        });

        header.append(h);
    }

    function createRow(row) {
        var $row = $("<tr/>");

        row.forEach(function (tdValue) {
            $row.append($("<td/>").text(tdValue.getFormattedValue()));
        });

        //$row.append($("<td/>").text(row.column1.getFormattedValue()));
        //$row.append($("<td/>").text(row.column2.getFormattedValue()));

        body.append($row);
        row.onChange(rowChangedEvent, true);
    }

    function deleteRow(index) {
        $(body.children()[index]).remove();
    }

    (function createTable() {
        createHeader(tableModel.header.getValue());
        tableModel.data.forEach( function(row) {
            createRow(row);
        });
    }());

    /** listen to changes to model to modify the table */

    tableModel.header.on("modelChange childCreated childDestroyed", function (property, arg) {
        header.empty();
        createHeader(this.getValue());
    });

    tableModel.data.on("childCreated", function (data, newProperty) {
        createRow(newProperty);
    });

    tableModel.data.on("childDestroyed", function (data, deleted) {
        //delete in reverse order, so as not to mess up indexes
        // handle if single or multiple elements are deleted at once
        deleteRow(deleted.getShortName());
    });

    /* widet getters */
    this.getWidget = function() {
        return widget;
    };
    this.getModel = function () {
        return tableModel;
    };

};
