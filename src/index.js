"use strict";

const reTypeField = /Typ/;
const reBruttoField = /Transaktionsbetrag/;
const reFeeField = /Gebühr|Verkaufsprovision/;
const reClearField = /Bestellnummer/;

const enableOptionsSelect = true;

const defaultFeeTypeName = "Andere Gebühr";

const messageTimeout = 5000;

const parseString = require("fast-csv").parseString;
const writeToString = require("fast-csv").writeToString;
const jschardet = require("jschardet");

const showMessage = (message, className) => {
    const box = document.createElement("div");
    box.className = className;
    box.textContent = message;
    document.getElementById("messages").appendChild(box);
    setTimeout(() => box.remove(), messageTimeout);
};

const error = (message) => {
    showMessage(message, "error");
    console.error(message);
};
const info = (message) => showMessage(message, "info");

const downloadTable = (table, filename) =>
    writeToString(table, {
        delimiter: ";",
        writeBOM: true,
        quoteColumns: true,
    }).then((data) => {
        // add Windows BOM
        // data = "\ufeff" + data.replace(/^\ufeff/, "");
        const element = document.createElement("a");
        element.setAttribute(
            "href",
            "data:text/csv;charset=utf-8," + encodeURIComponent(data)
        );
        element.setAttribute("download", filename);
        document.body.appendChild(element);
        element.click();
        element.remove();
    });

const reformatTable = (options) => {
    const table = options.table;
    const outTable = options.skipRows ? table.splice(0, options.skipRows) : [];
    for (const row of table) {
        outTable.push(row);
        const feeSum = options.feeFields.reduce(
            (fee, index) =>
                fee + (parseFloat(row[index].replace(/\,/, ".")) || 0),
            0
        );
        if (feeSum) {
            const newRow = [...row];
            newRow[options.typeField] = options.feeTypeName;
            newRow[options.bruttoField] = String(feeSum).replace(/\./, ",");
            options.feeFields.forEach((index) => (newRow[index] = "--"));
            options.clearFields.forEach((index) => (newRow[index] = ""));
            outTable.push(newRow);
        }
    }
    return outTable;
};

const showOptionsDialog = (defaultOptions, resolve, reject) => {
    const options = { ...defaultOptions };
    const table = options.table;

    const setFields = () => {
        const availableFields = table[options.skipRows] || [];
        inputFeeFields.innerHTML =
            inputBruttoField.innerHTML =
            inputTypeField.innerHTML =
                "";
        const feeFields = new Set(options.feeFields);
        const clearFields = new Set(options.clearFields);
        availableFields.forEach((name, i) => {
            {
                const option = document.createElement("option");
                option.innerText = name;
                option.value = i;
                if (feeFields.has(i)) option.selected = true;
                inputFeeFields.appendChild(option);
            }
            {
                const option = document.createElement("option");
                option.innerText = name;
                option.value = i;
                if (clearFields.has(i)) option.selected = true;
                inputClearFields.appendChild(option);
            }
            {
                const option = document.createElement("option");
                option.innerText = name;
                option.value = i;
                if (options.bruttoField === i) option.selected = true;
                inputBruttoField.appendChild(option);
            }
            {
                const option = document.createElement("option");
                option.innerText = name;
                option.value = i;
                if (options.typeField === i) option.selected = true;
                inputTypeField.appendChild(option);
            }
        });
        inputFeeFields.size = Math.min(availableFields.length, 10);
    };

    const outerDiv = document.createElement("div");
    outerDiv.className = "options-input";
    const div = document.createElement("div");
    div.className = "inner-options-input";
    outerDiv.appendChild(div);

    // title
    {
        const title = document.createElement("h1");
        title.innerText = options.fileName;
        div.appendChild(title);
    }

    const _table = document.createElement("table");
    div.appendChild(_table);
    const addRow = (description, field) => {
        const row = document.createElement("tr");
        {
            const col = document.createElement("td");
            col.className = "description";
            col.appendChild(document.createTextNode(description));
            row.appendChild(col);
        }
        {
            const col = document.createElement("td");
            col.className = "field";
            col.appendChild(field);
            row.appendChild(col);
        }
        _table.appendChild(row);
    };

    // skipRows
    const inputSkip = document.createElement("input");
    inputSkip.type = "number";
    inputSkip.className = "spin";
    inputSkip.value = options.skipRows;
    inputSkip.min = 0;
    inputSkip.max = table.length;
    inputSkip.addEventListener("change", () => {
        options.skipRows = inputSkip.value | 0;
        setFields();
    });
    addRow("Zu überspringende Zeilen:", inputSkip);

    // fee fields
    const inputFeeFields = document.createElement("select");
    inputFeeFields.multiple = true;
    inputFeeFields.addEventListener("change", () => {
        options.feeFields = Array.from(inputFeeFields.selectedOptions).map(
            (option) => option.value
        );
    });
    addRow("Gebührenfelder:", inputFeeFields);

    // fee fields
    const inputClearFields = document.createElement("select");
    inputClearFields.multiple = true;
    inputClearFields.addEventListener("change", () => {
        options.clearFields = Array.from(inputClearFields.selectedOptions).map(
            (option) => option.value
        );
    });
    addRow("zu löschende Felder:", inputClearFields);

    // brutto field
    const inputBruttoField = document.createElement("select");
    inputBruttoField.addEventListener("change", () => {
        options.bruttoField = (
            inputBruttoField.options[inputBruttoField.selectedIndex] || {}
        ).value;
    });
    addRow("Brutto-Feld:", inputBruttoField);

    // type field
    const inputTypeField = document.createElement("select");
    inputTypeField.addEventListener("change", () => {
        options.typeField = (
            inputTypeField.options[inputTypeField.selectedIndex] || {}
        ).value;
    });
    addRow("Buchungstyp-Feld:", inputTypeField);

    setFields();

    const inputFeeTypeName = document.createElement("input");
    inputFeeTypeName.type = "text";
    inputFeeTypeName.value = options.feeTypeName;
    inputFeeTypeName.addEventListener("change", () => {
        options.feeTypeName = inputFeeTypeName.value;
    });
    addRow("Buchungstyp-Text für Gebühren:", inputFeeTypeName);

    // Buttons
    {
        const subDiv = document.createElement("div");
        subDiv.className = "right";
        {
            const button = document.createElement("button");
            button.innerText = "Konvertieren";
            button.addEventListener("click", () => {
                outerDiv.remove();
                resolve(options);
            });
            subDiv.appendChild(button);
        }
        {
            const button = document.createElement("button");
            button.innerText = "Abbrechen";
            button.addEventListener("click", () => {
                outerDiv.remove();
                reject("Abbruch");
            });
            subDiv.appendChild(button);
        }
        {
            const button = document.createElement("button");
            button.innerText = "Zurücksetzen";
            button.addEventListener("click", () => {
                outerDiv.remove();
                showOptionsDialog(defaultOptions, resolve, reject);
            });
            subDiv.appendChild(button);
        }
        div.appendChild(subDiv);
    }
    document.body.appendChild(outerDiv);
};

const getOptions = (table, fileName) =>
    new Promise((resolve, reject) => {
        const options = {
            table,
            fileName,
            skipRows: 0,
            typeField: undefined,
            bruttoField: undefined,
            clearFields: [],
            feeFields: [],
            clearFields: [],
            feeTypeName: defaultFeeTypeName,
        };
        for (const row of table) {
            if (
                row.filter((col) => col).length <= 5 ||
                String(row[0]).startsWith("--")
            ) {
                options.skipRows++;
                continue;
            }
            row.forEach((col, i) => {
                if (reTypeField.test(col)) options.typeField = i;
                if (reBruttoField.test(col)) options.bruttoField = i;
                if (reClearField.test(col)) options.clearFields.push(i);
                if (reFeeField.test(col)) options.feeFields.push(i);
            });
            break;
        }
        return enableOptionsSelect
            ? showOptionsDialog(options, resolve, reject)
            : resolve(options);
    });

const getParsecsvdata = (data) =>
    new Promise((resolve) => {
        const table = [];
        parseString(data, {
            delimiter: /\t/.test(data) ? "\t" : ";",
        })
            .on("data", (row) => table.push(row))
            .on("end", (rowCount) => resolve(table));
    });

const setOverlay = (filename) => {
    const overlay = document.getElementById("overlay");
    if (!overlay) return;
    overlay.style.display = filename ? "block" : "none";
    overlay.querySelector(".filename").textContent = filename;
};

const decodeFile = (file, encoding) =>
    new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            const decoder = new TextDecoder(encoding);
            const decoded = decoder.decode(content);
            resolve(decoded);
        };
        reader.readAsArrayBuffer(file);
    });

const readFile = (file) =>
    new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            const encoding = jschardet.detect(content);
            resolve(encoding.encoding);
        };
        reader.readAsBinaryString(file);
    }).then((encoding) => decodeFile(file, encoding));

const initCsvConverter = (input) => {
    input.addEventListener("change", function () {
        if (this.files) {
            let promise = Promise.resolve();
            for (const file of this.files) {
                promise = promise
                    .then(() =>
                        enableOptionsSelect ? undefined : setOverlay(file.name)
                    )
                    .then(() => readFile(file))
                    .then((data) => getParsecsvdata(data))
                    .then((table) => getOptions(table, file.name))
                    .then(reformatTable)
                    .then((outTable) => downloadTable(outTable, file.name))
                    .then(() => info(file.name + " erfolgreich konvertiert."))
                    .catch((err) => error(err));
            }
            promise.then(() => setOverlay());
        }
    });
};

window.addEventListener("load", () => {
    initCsvConverter(document.getElementById("file-selector"));
});
