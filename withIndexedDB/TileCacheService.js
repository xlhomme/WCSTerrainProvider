
"use strict";

function TileCacheService(objectStoreName) {
	 this.database = null;
	 this.objectStoreName = objectStoreName;
}


/* TileCacheService */ 
TileCacheService.prototype = {


		/* createDB : create the scheme of the database  */
		createDB: function () {
		
			// In the following line, you should include the prefixes of implementations you want to test.
			window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
			// DON'T use "var indexedDB = ..." if you're not in a function.
			// Moreover, you may need references to some window.IDB* objects:
			window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
			window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
			if (!window.indexedDB) {
				window.alert("Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.");
			}
			
			var request = window.indexedDB.open('TileCacheService', 1);
			var that = this; 
			request.onsuccess = function (evt) {						
					that.database  = evt.target.result;
				};
			request.onerror = function (evt) {
					console.log("IndexedDB--> onerror ");
				};	
			 request.onupgradeneeded = function (evt) {
				    var thisDB = evt.target.result;
					if (!thisDB.objectStoreNames.contains('WCSTiles')) {
						var store = thisDB.createObjectStore('WCSTiles', { keyPath: 'id' });
						store.createIndex("tile", ["level", "row", "column"], { unique: true });
					}

					if (!thisDB.objectStoreNames.contains('ImageTiles')) {
						var store = thisDB.createObjectStore('ImageTiles', { keyPath: 'id' });
						store.createIndex("tile", ["level", "row", "column"], { unique: true });
					}					

			};
		},
				
		/* info on available storage */
		info: function () {
			// Request storage usage and capacity left
			window.webkitStorageInfo.queryUsageAndQuota(window.TEMPORARY, //the type can be either TEMPORARY or PERSISTENT
			function(used, remaining) {
			  console.log("Used quota: " + used + ", remaining quota: " + remaining);
			}, function(e) {
			  console.log('Error', e); 
			} );
		},
				
				
		/* isReady when objectStore has been created  */
		isReady: function () {
			if (!this.database)
				return false ; 
			
			return this.database.objectStoreNames.contains(this.objectStoreName);
		},
	
		/* get the requested tile */
		getTileData: function (column ,row,level) {

			var deferred = Cesium.when.defer();
			if (!this.database) {
					console.log("getTileData no database",this.database);
					deferred.reject("no IndexedDB");				
			}	
			else {
			
				var transaction = this.database.transaction(this.objectStoreName);
				var tileIndex = transaction.objectStore(this.objectStoreName).index("tile");
				
				var requestGet = tileIndex.get([level, row, column]);
				requestGet.onsuccess = function (evt) {
					var tile = null;
					if (evt.target.result) {
						tile = { data: evt.target.result.tileData };
						deferred.resolve(tile);
					}
					else {
						deferred.reject("no tile");
					}
				
				}
					
				requestGet.onerror = function (evt) {
					deferred.reject("no tile get failed");										
				}
			}

            return deferred.promise;
				
			   
		},

		
		
		addTile:function (x, y, level, data) {
				if (this.database) {
					var transaction = this.database.transaction(this.objectStoreName, "readwrite");
					try {
								// the transaction could abort because of a QuotaExceededError error
							var guid =  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});
							transaction.objectStore(this.objectStoreName).add({ id: guid,  level: level, row: y, column: x, tileData: data });
						//	console.log("addTile ");
						}
						catch (ex) {
							console.log(ex);
						}
					
				}
				else 
					console.log("addTile no database");
				
		}

      
};
