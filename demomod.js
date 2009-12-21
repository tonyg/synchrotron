$(document).ready(main);

function main() {
    ObjectMemory.saveImageAs("testIndex.html");
    $("body").append($((new Showdown.converter()).makeHtml("Hello, *world*!")));
};
