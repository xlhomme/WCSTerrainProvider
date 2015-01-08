WCSTerrainProvider
==================

This is a Terrain Provider for Cesium 
Elevation si request from a WCS 2.0.1 endpoint. 
This provider has been tested with a Geoserver
Response of the WCS is a geotiff which is parsed with  GeotiffParser.js
in order to obtain the heightmap.

In the withIndexedDB directory there is a version of the WCSTerrainProvider.js
which use IndexedDB (TileCacheService.js) to store heightmap.

-----------------------------------------------------------
WCSTerrainProvider in action  :

<img src="screen.jpg" alt="WCSTerrainProvider in action"  >