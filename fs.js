function random_hex_string(n) {
    var digits = "0123456789abcdef";
    var result = "";
    for (var i = 0; i < n; i++) {
	result = result + digits[Math.floor(Math.random() * 16)];
    }
    return result;
}

function random_uuid() {
    return [random_hex_string(8),
	    random_hex_string(4),
	    "4" + random_hex_string(3),
	    ((Math.floor(Math.random() * 256) & ~64) | 128).toString(16) + random_hex_string(2),
	    random_hex_string(12)].join("-");
}

/*
Content:
 - blob
 - tree
 - commit
*/
