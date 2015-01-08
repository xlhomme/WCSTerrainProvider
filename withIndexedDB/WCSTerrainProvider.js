"use strict";

(function () {
   
	var OGCHelper = {};
 
    OGCHelper.WCSParser = {};
    /**
     * static array where CRS availables for OGCHelper are defined
     */
    OGCHelper.CRS = [{
        name: "CRS:84",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: false,
        tilingScheme: Cesium.GeographicTilingScheme,
        supportedCRS: "urn:ogc:def:crs:OGC:2:84"
    }, {
        name: "EPSG:4326",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: true,
        tilingScheme: Cesium.GeographicTilingScheme,
        SupportedCRS: "urn:ogc:def:crs:EPSG::4326"
    }, {
        name: "EPSG:3857",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: false,
        tilingScheme: Cesium.WebMercatorTilingScheme,
        SupportedCRS: "urn:ogc:def:crs:EPSG::3857"
    }, {
        name: "OSGEO:41001",
        ellipsoid: Cesium.Ellipsoid.WGS84,
        firstAxeIsLatitude: false,
        tilingScheme: Cesium.WebMercatorTilingScheme,
        SupportedCRS: "urn:ogc:def:crs:EPSG::3857"
    }];

    
    OGCHelper.WCSParser.generate = function (description) {
        var resultat;
        description = Cesium.defaultValue(description,
            Cesium.defaultValue.EMPTY_OBJECT);
        if (Cesium.defined(description.url)) {
            var urlofServer = description.url;
            var index = urlofServer.lastIndexOf("?");
            if (index > -1) {
                urlofServer = urlofServer.substring(0, index);
            }
            // get version of wcs
            if (!Cesium.defined(description.layerName)) {
                throw new Cesium.DeveloperError(
                    'description.layerName is required.');
            }
          

            var urlDescribeCoverage = urlofServer
                + '?SERVICE=WCS&VERSION=2.0.1&REQUEST=DescribeCoverage&CoverageId=' + description.layerName ;


            if (Cesium.defined(description.proxy)) {
                urlDescribeCoverage = description.proxy.getURL(urlDescribeCoverage);
            }

            resultat = Cesium.when(Cesium.loadXML(urlDescribeCoverage),
                function (xml) {
                    return OGCHelper.WCSParser.getDescribeCoverage(xml, description);
                });


        } else if (Cesium.defined(description.xml)) {
            resultat = OGCHelper.WCSParser.getDescribeCoverage(description.xml, description);
        } else {
            throw new Cesium.DeveloperError(
                'either description.url or description.xml are required.');
        }
        return resultat;
    };


    function convertToFloat(tab) {
        for (var j = 0; j < tab.length; j++) {
            var b = parseFloat(tab[j]);
            if (!isNaN(b))
                tab[j] = b;
        }
        return tab;
    }

    function invertTab(tab) {
        var b= tab[1];
        tab[1]=tab[0];
        tab[0]=b;
        return tab;
    }

  
    OGCHelper.WCSParser.getDescribeCoverage = function (coverage, description) {

        var resultat = {};

        if (!Cesium.defined(description.layerName)) {
            throw new Cesium.DeveloperError(
                'description.layerName is required.');
        }

        var layerName = description.layerName;
        resultat.minLevel = Cesium.defaultValue(description.minLevel, undefined);
        resultat.maxLevel = Cesium.defaultValue(description.maxLevel, undefined);
      
        resultat.heightMapWidth = Cesium.defaultValue(description.heightMapWidth, 65);
        resultat.heightMapHeight = Cesium.defaultValue(description.heightMapHeight, resultat.heightMapWidth);

        // Check CoverageId == LayerName
		var CoverageId = coverage.querySelector("wcs\\:CoverageId, CoverageId").textContent;
       
		var lowerCorner = convertToFloat(coverage.querySelector('wcs\\:lowerCorner, lowerCorner').textContent.split(' '));
	    var upperCorner = convertToFloat(coverage.querySelector('wcs\\:upperCorner, upperCorner').textContent.split(' '));

		
		 var envelope = coverage.querySelector('gml\\:Envelope, Envelope');
		 var axisLabels = envelope.getAttribute('axisLabels');
		 
		if (axisLabels=='Lat Long')
        {
            upperCorner = invertTab(upperCorner);
            lowerCorner = invertTab(lowerCorner);
        }

		var low = convertToFloat(coverage.querySelector('gml\\:low, low').textContent.split(' '));
		var high = convertToFloat(coverage.querySelector('gml\\:high, high').textContent.split(' '));

      
		// Get the native CRS of the coverage return somethine like that : http://www.opengis.net/def/crs/EPSG/0/4326   
        var aSrsName = envelope.getAttribute('srsName');
		var aSrsNameCode = aSrsName.split('/');
		var epsgCode= parseInt(aSrsNameCode);
		if (isNaN(epsgCode))
			epsgCode = 4326;
			
		var projstring = 'EPSG:' + epsgCode;
        var getCRS = OGCHelper.CRS.filter(function (elt) {
            return elt.name === projstring;
        });
        if (getCRS.length > 0)
            resultat.tilingScheme = new getCRS[0].tilingScheme({
                ellipsoid: getCRS[0].ellipsoid
            });
        else
            resultat.tilingScheme = undefined;
        
        resultat.pixelSize = [(upperCorner[0] - lowerCorner[0]) / (high[0] - low[0]),(upperCorner[1] - lowerCorner[1]) / (high[1] - low[1])];

        resultat.levelZeroMaximumGeometricError = Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(resultat.tilingScheme._ellipsoid, 
																														 Math.min(resultat.heightMapWidth, resultat.heightMapHeight), 
																														 resultat.tilingScheme.getNumberOfXTilesAtLevel(0));

        resultat.waterMask = false;

        resultat.ready = true;


        var bbox = {
            'WKID': epsgCode,
            'EPSG': projstring,
            'coord': [[lowerCorner[0], upperCorner[1]], [lowerCorner[0], lowerCorner[1]], [upperCorner[0], lowerCorner[1]], [upperCorner[0], upperCorner[1]]],
            'ulidx': 0,
            'llidx': 1,
            'lridx': 2,
            'uridx': 3
        };
        resultat.bbox = bbox;

		
        resultat.getTileDataAvailable = function (x, y, level) {
            if (level <= resultat.maxLevel  && resultat.isInTile(x, y, level))
                return true;
            return false;
        };
        
        // Define the URL for GetCoverage
        var urlofServer = description.url;
        var index = urlofServer.lastIndexOf("?");
        if (index > -1) {
            urlofServer = urlofServer.substring(0, index);
        }
       


        var mntBbox = "&SUBSET=Long,EPSG:4326({west},{east})&SUBSET=Lat,EPSG:4326({south},{north})";
       // var scaling = "&ScaleAxesByFactor=Lat({scaleX}),Long({scaleY})";
		var scaling = "&SCALESIZE=http://www.opengis.net/def/axis/OGC/1/i(" + resultat.heightMapWidth + "),http://www.opengis.net/def/axis/OGC/1/j("+ resultat.heightMapHeight +")";
		
		
        var urlGetCoverage = urlofServer
            + '?SERVICE=WCS&VERSION=2.0.1&FORMAT=image/geotiff&REQUEST=GetCoverage&CoverageId=' + description.layerName + mntBbox + scaling;


        if (Cesium.defined(description.proxy)) {
            urlGetCoverage = description.proxy.getURL(urlGetCoverage);
        }
        resultat.urlGetCoverage = urlGetCoverage;


        // Is the X,Y,Level define a tile that is contains in our bbox
        resultat.isTileInside = function (x, y, level, provider) {
            var inside = true;
            var bbox = resultat.bbox;
            var rect = provider.tilingScheme.tileXYToNativeRectangle(x, y, level);

            if (bbox.coord[bbox.ulidx][0] >= rect.east  || bbox.coord[bbox.lridx][0] <= rect.west ||
                bbox.coord[bbox.lridx][1] >= rect.north || bbox.coord[bbox.ulidx][1] <= rect.south) {
                inside = false;
            }
            return inside;
        };
		  // Is the X,Y,Level define a tile that contains or ovelaps our bbox
		 resultat.isInTile = function (x, y, level) {
            var inside = false;
            var bbox = resultat.bbox;
            var rect = resultat.tilingScheme.tileXYToNativeRectangle(x, y, level);
			// One point of the bbox is in the tile
            if ((bbox.coord[bbox.ulidx][0] >= rect.west && bbox.coord[bbox.ulidx][0] <= rect.east  &&
				bbox.coord[bbox.ulidx][1] >= rect.south && bbox.coord[bbox.ulidx][1] <= rect.north)	||	
                (bbox.coord[bbox.uridx][0] >= rect.west && bbox.coord[bbox.uridx][0] <= rect.east  &&
				bbox.coord[bbox.uridx][1] >= rect.south && bbox.coord[bbox.uridx][1] <= rect.north)	||	
                (bbox.coord[bbox.llidx][0] >= rect.west && bbox.coord[bbox.llidx][0] <= rect.east  &&
				bbox.coord[bbox.llidx][1] >= rect.south && bbox.coord[bbox.llidx][1] <= rect.north)	||	
                (bbox.coord[bbox.lridx][0] >= rect.west && bbox.coord[bbox.lridx][0] <= rect.east  &&
				bbox.coord[bbox.lridx][1] >= rect.south && bbox.coord[bbox.lridx][1] <= rect.north) ||
			// or the tile is in the bbox
				(bbox.coord[bbox.ulidx][0] < rect.east  && bbox.coord[bbox.lridx][0] > rect.west &&
                bbox.coord[bbox.lridx][1] < rect.north && bbox.coord[bbox.ulidx][1] > rect.south)
				) {
                inside = true;
            }
            return inside;

        };

        return resultat;
    };

 

    /**
     * A {@link TerrainProvider} that produces geometry by tessellating height
     * maps retrieved from a geoserver terrain server.
     *
     * @alias WCSTerrainProvider
     * @constructor
     *
     * @param {String}
     *            description.url The URL of the geoserver terrain server.
     * @param {String}
     *            description.layerName The layers to include, separated by
     *            commas.
     * @param {Proxy}
     *            [description.proxy] A proxy to use for requests. This object
     *            is expected to have a getURL function which returns the
     *            proxied URL, if needed.
     * @param {Credit|String}
     *            [description.credit] A credit for the data source, which is
     *            displayed on the canvas.
     * @param {Number}
     *            [description.heightMapWidth] width and height of the tiles
     * @param {String}
     *            [description.service] type of service to use (WMS, TMS or WMTS)
     * @param {String}
     *            [description.xml] the xml after requesting "getCapabilities".
     * @see TerrainProvider
     */
    var WCSTerrainProvider = function WCSTerrainProvider(description) {
        if (!Cesium.defined(description)) {
            throw new Cesium.DeveloperError('description is required.');
        }
        var errorEvent = new Cesium.Event();

        this._eventHelper = new Cesium.EventHelper();
       

        var credit = description.credit;
        if (typeof credit === 'string') {
            credit = new Cesium.Credit(credit);
        }
	
		this.tileCacheService = new TileCacheService('WCSTiles');
		this.tileCacheService.createDB(); 
		
		this.lastTile = undefined;
        this.ready = false;
		this.DefaultProvider = new Cesium.EllipsoidTerrainProvider();
		

        Cesium.defineProperties(this, {
            errorEvent: {
                get: function () {
                    return errorEvent;
                }
            },
            credit: {
                get: function () {
                    return credit;
                }
            },
            hasVertexNormals: {
                get: function () {
                    return false;
                }
            }
          
        });
		description =   Cesium.defaultValue(description, Cesium.defaultValue.EMPTY_OBJECT);
        var promise =  OGCHelper.WCSParser.generate(description); 
        TerrainParser(promise, this);
    };

    WCSTerrainProvider.TiledError = function () {
        console.log("TiledError");
    };

    /**
     *
     * arrayBuffer:    the Geotiff
     * size:        number defining the height and width of the tile (can be a int or an object with two attributs: height and width)
	 * x: 
	 * y:
	 * level:
	 * tilingSc: tilingScheme
     */
    WCSTerrainProvider.GeotiffToHeightmapTerrainData = function (arrayBuffer, size, x,y ,level,tilingSc) {
        if (typeof(size) == "number") {
            size = {width: size, height: size};
        }

        var parser = new GeotiffParser();
        parser.parseHeader(arrayBuffer);
        var width = parser.imageWidth;
        var height = parser.imageLength;
       
        //console.log("Level " , level , "w" ,size.width, "h" , size.height);

        var index=0;
        var heightBuffer = new Float32Array(size.height * size.width);
      
        // Convert pixelValue to heightBuffer 
		//--------------------------------------
        // We need to return a Heighmap of size 65x65
        // The requested Tile from WCS should be cloth but not 65x65 
        // We need to work in Native coordinate then get the pixel from the Parser.

        // Here we need to check if the tilingScheme.CRS is the same of the Image 
        // If no we need to convert 
        // But It will to slow the processus then we should assume tilingScheme has been set 
        // with the CRS of the image 

		if (size.height != height || size.width != width)
		{
			var rect = tilingSc.tileXYToNativeRectangle(x, y, level);
			var xSpacing = (rect.east - rect.west) / size.width;
			var ySpacing = (rect.north - rect.south) / size.height;

			for (var j=0;j<size.height;j++)
				for (var i=0;i<size.width;i++) {
					// Transform i,j of the Heighmap into res[1], res[2] of the downloaded image
					// if downloaded image is the same zize of heightBuffer this convertion wouldn't be done
				   
					var lon = rect.west  + xSpacing * i;
					var lat = rect.north - ySpacing * j;
					var res = parser.PCSToImage(lon, lat);
					if (res[0] == 1) {
						var pixelValue = parser.getPixelValueOnDemand(res[1], res[2]);
						 heightBuffer[index] = pixelValue[0];
					
					}
					else
					{
						heightBuffer[index] = 0.0;
					}				
					index++;               
				}
		}
		else
		{
			 for (var j=0;j<size.height;j++)
				for (var i=0;i<size.width;i++) {
					var pixelValue = parser.getPixelValueOnDemand(i, j);
					heightBuffer[index] = pixelValue[0];
					index++;               
				}
		}

        return heightBuffer;
    };
	
	  /**
     *
     * arrayBuffer:    the Geotiff
     * size:        number defining the height and width of the tile (can be a int or an object with two attributs: height and width)
     * childrenMask: Number defining the childrenMask
     *
     */
    WCSTerrainProvider.HeightmapTerrainData = function (heightBuffer, size, childrenMask) {
      	 if (typeof(size) == "number") {
            size = {width: size, height: size};
        }

       if (!Cesium.defined(heightBuffer)) {
            throw new Cesium.DeveloperError("no good size");
        }
        var optionsHeihtmapTerrainData = {
            buffer: heightBuffer,
            width: size.width,
            height: size.height,
            childTileMask: childrenMask
        };
       
	    return new Cesium.HeightmapTerrainData(optionsHeihtmapTerrainData);
    };
	
   
    function TerrainParser(promise, provider) {
	
        Cesium.when(promise, function (resultat) {
             if (Cesium.defined(resultat) && (resultat.ready)) {
             
                if (Cesium.defined(resultat.urlGetCoverage)) {
                    resultat.getHeightmapTerrainDataFromWCS = function (x, y, level) {
                        var retour;
                        if (!isNaN(x + y + level)) {
							
							var urlGetCoverage = templateToURL(resultat.urlGetCoverage, x, y, level, provider);
									
							var hasChildren = 0;
							if (level < resultat.maxLevel) {
									// no need to test for all child --> we are in the case of isTileInside
										hasChildren |=1;
										hasChildren |=2;
										hasChildren |=4;
										hasChildren |=8;
							}
											
							// If the requested tile is the same as the last then return it
							if (provider.lastTile!=undefined &&
								provider.lastTile.x == x &&
								provider.lastTile.y == y &&
								provider.lastTile.level == level)
								{
									//console.log("get  Last Tile ",x, y, level);
									return provider.lastTile.value;
								}
								
							// If the requested tile is in the TileCacheService then return it
							// Otherwise use WCS Get Coverage to request the tile  
							var tileDataPromise=  provider.tileCacheService.getTileData(x,y,level);
							 if (Cesium.defined(tileDataPromise)) {
								    retour = Cesium.when(tileDataPromise, function (tileData) {
									//console.log("Yes got Heightmap from IndexedDB");
									var  myHeightmapTerrainData = WCSTerrainProvider.HeightmapTerrainData(tileData.data,
											{
												width:  resultat.heightMapWidth,
												height: resultat.heightMapHeight
											}, hasChildren);
									provider.lastTile = {'x': x, 'y': y, 'level': level, 'value': myHeightmapTerrainData};
												
									return myHeightmapTerrainData;
                                }).otherwise(function (evt) {
									//console.log("failure " , evt);
									
									// If the requested tile is in return by WCS then create the HeightmapTerrainData and store ist with TileCacheService
									// Otherwise return the DefaultProvider tile
									//console.log("getHeightmapTerrainDataFromWCS",x, y, level);
									var promiseGetCoverage = Cesium.loadWithXhr({ url: urlGetCoverage, responseType: 'arraybuffer' });
									if (Cesium.defined(promiseGetCoverage)) {
											var  retour2 = Cesium.when(promiseGetCoverage, function (image) {
											var  myHeightmapBuffer = WCSTerrainProvider.GeotiffToHeightmapTerrainData(image,
												{
													width:  resultat.heightMapWidth,
													height: resultat.heightMapHeight
												}, x, y,level,provider.tilingScheme);
											provider.tileCacheService.addTile(x,y,level,myHeightmapBuffer);
											var  myHeightmapTerrainData = WCSTerrainProvider.HeightmapTerrainData(myHeightmapBuffer,
												{
													width:  resultat.heightMapWidth,
													height: resultat.heightMapHeight
												}, hasChildren);
												provider.lastTile = {'x': x, 'y': y, 'level': level, 'value': myHeightmapTerrainData};
												
											
											return myHeightmapTerrainData;
										}).otherwise(function () {
										   return provider.DefaultProvider.requestTileGeometry(x, y, level);									 
										});
									}
									return retour2; 
									// return undefined; 
									
									//return provider.DefaultProvider.requestTileGeometry(x, y, level);
														 
                                });
							
							}
							
							
									
                                 		
                            
                        }
                        return retour;
                    };
                }

              

                provider.getLevelMaximumGeometricError = function (level) {
                    return resultat.levelZeroMaximumGeometricError / (1 << level);
                };

                provider.requestTileGeometry = function (x, y, level) {
                    var retour;
					
                    if (Cesium.defined(resultat.getHeightmapTerrainDataFromWCS) &&
                        level >= resultat.minLevel &&
                        level <= resultat.maxLevel &&
                        resultat.isTileInside(x, y, level, provider) == true) {
                      
						//console.log("Terrain Get Tile " ,x, y, level);
                        retour = resultat.getHeightmapTerrainDataFromWCS(x, y, level);

                    }
                    else {
						//console.log("Ellipsoid Get Tile " ,x, y, level);
                        retour = provider.DefaultProvider.requestTileGeometry(x, y, level);
                    }
                    return retour;
                }

                Cesium.defineProperties(provider, {
                    tilingScheme: {
                        get: function () {
                            return resultat.tilingScheme;
                        }
                    },
                    ready: {
                        get: function () {
                            return resultat.ready;
                        }
                    },
                    pixelSize: {
                        get: function () {
                            return resultat.pixelSize;
                        }
                    },
                    hasWaterMask: {
                        get: function () {
                            return resultat.waterMask;
                        }
                    },
                    heightMapHeight: {

                        get: function () {
                            return resultat.heightMapHeight;
                        }
                    },
                    heightMapWidth: {
                        get: function () {
                             return resultat.heightMapWidth;
                        }
                    },
                    getTileDataAvailable: {
                        get: function () {
                            return resultat.getTileDataAvailable;
                        }
                    },
                    minLevel: {
                        get: function () {
                            return resultat.minLevel;
                        }
                    },
                    maxLevel: {
                        get: function () {
                            return resultat.maxLevel;
                        }
                    }

                });

				if (resultat.minLevel == undefined || resultat.maxLevel == undefined)
				{
					// Test pour savoir dans quelle tuile se trouve mon WCS
					var bbox = resultat.bbox;
					var pgeo = new Cesium.Cartographic(
						Cesium.Math.toRadians(bbox.coord[bbox.ulidx][0]),
						Cesium.Math.toRadians(bbox.coord[bbox.ulidx][1]), 
						 0);
					resultat.minLevel = 30;
					resultat.maxLevel = 0;

					for (var j = 0 ; j < 30 ; j++)
					{
						// var tile = provider.tilingScheme.positionToTileXY(pgeo,j);
						//var rect = provider.tilingScheme.tileXYToNativeRectangle(tile.x, tile.y, j);
						var rect = provider.tilingScheme.tileXYToNativeRectangle(0, 0, j);
						var xSpacing = (rect.east - rect.west) / (provider.heightMapWidth - 1);
						var ySpacing = (rect.north - rect.south) / (provider.heightMapHeight - 1);
						var scalingX = provider.pixelSize[0] / xSpacing
						var scalingY = provider.pixelSize[1] / ySpacing;
					   // console.log("Show Tile of my UL DTM Level " + j, tile.x, tile.y, scalingX, scalingY);
						console.log(" DTM Level " + j, 0, 0, scalingX, scalingY);
					  
						if (scalingX < 10 && scalingX > 1 / 10 && Math.abs(scalingY) < 10 && Math.abs(scalingY) > 1 / 10)
						 {
							if (j < resultat.minLevel) resultat.minLevel = j;
							if (j > resultat.maxLevel) resultat.maxLevel = j;
								
						}
					}
					console.log("Show DTM Between evel ", resultat.minLevel, resultat.maxLevel);
				}
            }
        });
    }

    function templateToURL(urlParam, x, y, level, provider) {
        var rect = provider.tilingScheme.tileXYToNativeRectangle(x, y, level);
        var xSpacing = (rect.east - rect.west) / (provider.heightMapWidth - 1);
        var ySpacing = (rect.north - rect.south) / (provider.heightMapHeight - 1);
       
        rect.west -= xSpacing * 0.5;
        rect.east += xSpacing * 0.5;
        rect.south -= ySpacing * 0.5;
        rect.north += ySpacing * 0.5;
       /* var scalingX = provider.pixelSize[0] / xSpacing
        var scalingY = provider.pixelSize[1] / ySpacing;
		.replace("{scaleX}", scalingX).replace("{scaleY}", scalingY)*/
 
        return urlParam.replace("{south}", rect.south).replace("{north}", rect.north).replace("{west}", rect.west).replace("{east}", rect.east);
      }

  /*
  
  if (level < resultat.maxLevel) {
                                var childLevel = level + 1;

                                hasChildren |= resultat.isTileInside(2 * x, 2 * y, childLevel, provider) ? 1 : 0;
                                hasChildren |= resultat.isTileInside(2 * x + 1, 2 * y, childLevel, provider) ? 2 : 0;
                                hasChildren |= resultat.isTileInside(2 * x, 2 * y + 1, childLevel, provider) ? 4 : 0;
                                hasChildren |= resultat.isTileInside(2 * x + 1, 2 * y + 1, childLevel, provider) ? 8 : 0;

                            }
							*/

    Cesium.WCSTerrainProvider = WCSTerrainProvider;
})();