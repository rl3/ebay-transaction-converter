"use strict";

const reTypeField = /Typ/;
const reBruttoField = /Transaktionsbetrag/;
const reFeeField = /Gebühr|Verkaufsprovision/;

const feeTypeName = "Andere Gebühr";

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

const reformatTable = (table) => {
    const outTable = [];
    const fieldsMap = new Map();
    let typeField = 0;
    let bruttoField = 0;
    let feeFields = [];
    for (const row of table) {
        outTable.push(row);
        if (!fieldsMap.size) {
            if (
                row.filter((col) => col).length > 5 &&
                !String(row[0]).startsWith("--")
            ) {
                row.forEach((col, i) => {
                    fieldsMap.set(i, col);
                    if (reTypeField.test(col)) typeField = i;
                    if (reBruttoField.test(col)) bruttoField = i;
                    if (reFeeField.test(col)) feeFields.push(i);
                });
            }
            continue;
        }
        const feeSum = feeFields.reduce(
            (fee, index) =>
                fee + (parseFloat(row[index].replace(/\,/, ".")) || 0),
            0
        );
        if (feeSum) {
            const newRow = [...row];
            newRow[typeField] = feeTypeName;
            newRow[bruttoField] = String(feeSum).replace(/\./, ",");
            feeFields.forEach((index) => (newRow[index] = "--"));
            outTable.push(newRow);
        }
    }
    return outTable;
};

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
                    .then(() => setOverlay(file.name))
                    .then(() => readFile(file))
                    .then((data) => getParsecsvdata(data))
                    .then((table) => reformatTable(table))
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
