function addStyle(styleString) {
    const style = document.createElement('style');
    style.textContent = styleString;
    document.head.append(style);
}

function customUrlRedex(match, url) {
    let pattern = match.replaceAll("/", "\\/");
    pattern = pattern.replaceAll(".", "\\.");
    pattern = pattern.replaceAll("*", ".*");
    pattern = pattern.replace(/[+?^${}()|]/g, '\\$&');

    return new RegExp(pattern).test(url);
}

module.exports = {
    addStyle,
    customUrlRedex
}