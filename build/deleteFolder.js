'use strict';

var Promise = require('bluebird');

function deleteFolder(folderEntry) {
	return new Promise(function (resolve, reject) {
		folderEntry.removeRecursively(resolve, reject);
	});
}

module.exports = deleteFolder;