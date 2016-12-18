'use strict';

var createFoldersInPath = require('./createFoldersInPath');

function downloadFiles(contentUrl, filesToDownload, destinationFolderName, options) {
	var downloadPromises = [];
	filesToDownload.forEach(function (fileToDownload) {
		downloadPromises.push(downloadFile(contentUrl, fileToDownload, destinationFolderName, options));
	});
	return Promise.all(downloadPromises);
}

function downloadFile(contentUrl, fileToDownload, destinationFolderName, options) {
	return createFoldersInPath(destinationFolderName + '/' + fileToDownload, { endsInFile: true }).then(function () {
		return new Promise(function (resolve, reject) {
			var fileTransfer = new FileTransfer();
			var uri = encodeURI(contentUrl + fileToDownload);
			var destinationPath = encodeURI(cordova.file.dataDirectory + destinationFolderName + '/' + fileToDownload);
			var shouldTrustAllHosts = false;

			fileTransfer.download(uri, destinationPath, resolve, function (error) {
				return reject(new Error('cordova-code-swap: ' + JSON.stringify(error)));
			}, shouldTrustAllHosts, options);
		});
	});
}

module.exports = downloadFiles;