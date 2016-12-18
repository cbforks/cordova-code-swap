'use strict';

var downloadFiles = require('./downloadFiles');
var copyFolder = require('./copyFolder');
var createFoldersInPath = require('./createFoldersInPath');
var copyFiles = require('./copyFiles');

function fetchFiles(ccs, _ref, versionInfo, options) {
	var filesToCopy = _ref.filesToCopy,
	    filesToDownload = _ref.filesToDownload;

	var contentUrl = versionInfo.content_url;
	var srcFolderName = ccs.version;
	var destinationFolderName = versionInfo.release;
	var dataDir = cordova.file.dataDirectory;
	var applicationDir = cordova.file.applicationDirectory;

	return createFoldersInPath(destinationFolderName).then(function () {
		return copyFiles(dataDir, filesToCopy.map(function (file) {
			return srcFolderName + '/' + file;
		}), dataDir, destinationFolderName);
	}).catch(function () {
		return downloadFiles(contentUrl, filesToCopy, destinationFolderName, options);
	}).then(function () {
		return downloadFiles(contentUrl, filesToDownload, destinationFolderName, options);
	}).then(function () {
		return copyFiles(applicationDir, ['www/cordova.js', 'www/cordova_plugins.js'], dataDir, destinationFolderName);
	}).then(function () {
		return copyFolder(applicationDir, 'www/cordova-js-src/', dataDir, destinationFolderName);
	}).then(function () {
		return copyFolder(applicationDir, 'www/plugins/', dataDir, destinationFolderName);
	});
}

module.exports = fetchFiles;