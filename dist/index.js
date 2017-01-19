'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var request = require('./request');
var Promise = require('bluebird');
var fetchFiles = require('./fetchFiles');
var getCopyAndDownloadList = require('./getCopyAndDownloadList');
var compareWithCurrentVersion = require('./compareWithCurrentVersion');
var parseResponseToObject = require('./parseResponseToObject');
var urlJoin = require('url-join');
var updateCCSConfig = require('./updateCCSConfig');
var getContentUrl = require('./getContentUrl');
var defaultOptions = require('./defaultOptions');
var negotiateStartReloadService = require('./negotiateStartReloadService');
var initialized = false;
var ccs = JSON.parse(localStorage.ccs || JSON.stringify({}));
var _instanceOptions;
var isLookingForUpdates = false;
var isDownloading = false;
var isInstalling = false;

/**
 * PUBLIC
 * Initialize the CCS instance
 * @param {Object} instanceOptions - Options to use for the instance.
 * @return {Promise}
 */
function initialize() {
	var instanceOptions = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

	return new Promise(function (resolve) {
		if (!initialized) {
			_instanceOptions = _extends({}, defaultOptions.instance, instanceOptions);
			initialized = true;
			negotiateStartReloadService(_instanceOptions.debug, lookForUpdates);
		}

		if (ccs.entryPoint) {
			if (_instanceOptions.iframe) {
				resolve(ccs.entryPoint);
			} else if (ccs.entryPoint !== window.location.href) {
				window.location.href = ccs.entryPoint;
			} else {
				resolve();
			}
		} else {
			resolve();
		}
	});
}

/**
 * PUBLIC
 * Looks for updates on the server
 * @param  {String} url    	- Url to the update server
 * @param  {Object} options - Options to use when communicating with the server.
 * @return {Promise}		- Resolves with download function, rejects with error.
 */
function lookForUpdates(url) {
	var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

	if (!initialized) {
		return Promise.reject(new Error('cordova-code-swap: .initialize() needs to be run before looking for updates. It should be the first thing to be run in the application.'));
	}

	if (isLookingForUpdates) {
		return Promise.reject(new Error('cordova-code-swap: .lookForUpdates is already running.'));
	}

	options = _extends({}, defaultOptions.update, options);
	var updateDeclaration = urlJoin(url, 'chcp.json');
	isLookingForUpdates = true;

	return request.get(updateDeclaration, { headers: options.headers }).then(parseResponseToObject).then(function (updateInfo) {
		return compareWithCurrentVersion(ccs, updateInfo);
	}).then(function (updateInfo) {
		updateInfo.content_url = getContentUrl(url, updateInfo);
		var downloadFunction = _download.bind(null, updateInfo, options);
		downloadFunction.updateInfo = updateInfo;
		isLookingForUpdates = false;
		return downloadFunction;
	}).catch(function (err) {
		isLookingForUpdates = false;
		throw err;
	});
}

/**
 * Get the update - this function is returned in the resolved promise of lookForUpdates
 * @param  {Object} updateInfo	- The info received from the server
 * @param  {Object} options     - Options to use when communicating with the server.
 * @return {Promise}			- Resolves with install function, rejects with error
 */
function _download(updateInfo, options) {
	if (isDownloading) {
		throw new Error('cordova-code-swap: A download is already in progress.');
	}

	// make a local copy of updateInfo so it can be mutated
	var updateInfoClone = _extends({}, updateInfo);
	isDownloading = true;

	var contentUrl = updateInfoClone.content_url;
	var manifestUrl = urlJoin(contentUrl, 'chcp.manifest');
	return request.get(manifestUrl, { headers: options.headers }).then(parseResponseToObject).then(function (serverManifest) {
		updateInfoClone.manifest = serverManifest;
		return getCopyAndDownloadList(ccs.manifest, serverManifest);
	}).then(function (fetchList) {
		return fetchFiles(ccs, fetchList, updateInfoClone, options, _instanceOptions);
	}).then(function () {
		ccs.pendingInstallation = {};
		ccs.pendingInstallation.updateInfo = updateInfoClone;
		ccs.pendingInstallation.options = options;
		localStorage.ccs = JSON.stringify(ccs);

		isDownloading = false;
		return _install.bind(null, updateInfoClone, options);
	}).catch(function (err) {
		ccs.pendingInstallation = false;
		isDownloading = false;
		localStorage.ccs = JSON.stringify(ccs);
		throw err;
	});
}

/**
 * Install the update - this function is returned in the resolved promise of _download
 * @param  {Object} updateInfo 	- The info received from the server
 * @param  {Object} options    	- Name of the entry point when redirecting to this update
 * @return {Promise}
 */
function _install(updateInfo, options) {
	if (isInstalling) {
		Promise.reject('cordova-code-swap: An installation is already in progress');
	}
	var deleteBackups = require('./deleteBackups');
	isInstalling = true;

	// create new config with settings needed to load the newly installed version
	ccs = updateCCSConfig(ccs, updateInfo, options, _instanceOptions);

	// find obsolete backups
	var sortedBackups = ccs.backups.sort(function (b1, b2) {
		return b1.timestamp || 0 < b2.timestamp || 0;
	});
	var backupsToDelete = sortedBackups.slice(_instanceOptions.backupCount, sortedBackups.length);

	// update the current the backup list
	ccs.backups = sortedBackups.slice(0, _instanceOptions.backupCount);

	return Promise.resolve().then(function () {
		return _instanceOptions.debug.preserveBreakpoints ? null : deleteBackups(backupsToDelete);
	}).then(function () {
		localStorage.ccs = JSON.stringify(ccs);
	}).then(function () {
		isInstalling = false;
	}, function (err) {
		isInstalling = false;throw err;
	}).then(function () {
		return _instanceOptions.debug.preserveBreakpoints && !_instanceOptions.iframe ? new Promise(function () {
			return window.location.reload();
		}) : initialize();
	});
}

/**
 * PUBLIC
 * Install a previously downloaded update that has not been installed. See documentation.
 * @return {Promise}
 */
function install() {
	if (ccs.pendingInstallation) {
		return _install(ccs.pendingInstallation.updateInfo, ccs.pendingInstallation.options);
	} else {
		return Promise.reject(new Error('cordova-code-swap: Tried to install update, but no updates have been previously downloaded.'));
	}
}

module.exports = { initialize: initialize, lookForUpdates: lookForUpdates, install: install };