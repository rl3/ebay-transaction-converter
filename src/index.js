"use strict";

const reTypeField = /Typ/;
const reBruttoField = /Transaktionsbetrag/;
const reFeeField = /Gebühr|Verkaufsprovision/;

const feeTypeName = "Andere Gebühr";

const parseString = require("fast-csv").parseString;
const writeToString = require("fast-csv").writeToString;

const downloadTable = (table, filename) =>
    writeToString(table, { delimiter: ";" }).then((data) => {
        const element = document.createElement("a");
        element.setAttribute(
            "href",
            "data:text/csv;charset=utf-8, " + encodeURIComponent(data)
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
            if (row.length > 5) {
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
            delimiter: ";",
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

const initCsvConverter = (input) => {
    input.addEventListener("change", function () {
        if (this.files) {
            let promise = Promise.resolve();
            for (const file of this.files) {
                promise = promise
                    .then(() => setOverlay(file.name))
                    .then(() =>
                        file.text().then((data) =>
                            getParsecsvdata(data)
                                .then((table) => reformatTable(table))
                                .then((outTable) =>
                                    downloadTable(outTable, file.name)
                                )
                        )
                    );
            }
            promise.then(() => setOverlay());
        }
    });
};

window.addEventListener("load", () => {
    const input = document.getElementById("file-selector");
    initCsvConverter(input);
});
