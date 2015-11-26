(function ($, OC) {
'use strict';

var colors = [ 'red', 'green', 'cyan', 'purple','Lime', 'yellow', 'black',
               'orange', 'blue', 'brown', 'Chartreuse','Crimson',
               'DeepPink', 'Gold'];
var lastColorUsed = -1;
var gpxpod = {
    map: {},
    markers: [],
    markersPopupTxt: {},
    markerLayer: null,
    // layers currently displayed, indexed by track name
    gpxlayers: {},
    mode: 'overview',
    subfolder: '',
    // layer of current elevation chart
    elevationLayer: null,
    // track concerned by elevation
    elevationTrack: null,
    minimapControl: null,
    searchControl: null,
    tablesortCol: [2,1],
    currentHoverLayer : null,
    currentAjax : null,
    // as tracks are retrieved by ajax, there's a lapse between mousein event
    // on table rows and track overview display, if mouseout was triggered
    // during this lapse, track was displayed anyway. i solve it by keeping
    // this prop up to date and drawing ajax result just if its value is true
    insideTr: false
};

/*
 * markers are stored as list of values in this format :
 *
 * m[0] : lat,
 * m[1] : lon,
 * m[2] : name,
 * m[3] : total_distance,
 * m[4] : total_duration,
 * m[5] : date_begin,
 * m[6] : date_end,
 * m[7] : pos_elevation,
 * m[8] : neg_elevation,
 * m[9] : min_elevation,
 * m[10] : max_elevation,
 * m[11] : max_speed,
 * m[12] : avg_speed
 * m[13] : moving_time
 * m[14] : stopped_time
 * m[15] : moving_avg_speed
 * m[16] : north
 * m[17] : south
 * m[18] : east
 * m[19] : west
 *
 */

var LAT = 0;
var LON = 1;
var NAME = 2;
var TOTAL_DISTANCE = 3;
var TOTAL_DURATION = 4;
var DATE_BEGIN = 5;
var DATE_END = 6;
var POSITIVE_ELEVATION_GAIN = 7;
var NEGATIVE_ELEVATION_GAIN = 8;
var MIN_ELEVATION = 9;
var MAX_ELEVATION = 10;
var MAX_SPEED = 11;
var AVERAGE_SPEED = 12;
var MOVING_TIME = 13;
var STOPPED_TIME = 14;
var MOVING_AVERAGE_SPEED = 15;
var NORTH = 16;
var SOUTH = 17;
var EAST = 18;
var WEST = 19;

function load()
{
    load_map();
}

function load_map() {
  var layer = getUrlParameter('layer');
  console.log('layer '+layer);
  var default_layer = 'OpenStreetMap France';
  if (typeof layer !== 'undefined'){
      default_layer = decodeURI(layer);
  }

  // get url from key and layer type
  function geopUrl (key, layer, format)
  { return 'http://wxs.ign.fr/'+ key + '/wmts?LAYER=' + layer
      +'&EXCEPTIONS=text/xml&FORMAT='+(format?format:'image/jpeg')
          +'&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal'
          +'&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}' ;
  }
  // change it if you deploy GPXPOD
  var API_KEY = 'ljthe66m795pr2v2g8p7faxt';
  var ign = new L.tileLayer ( geopUrl(API_KEY,'GEOGRAPHICALGRIDSYSTEMS.MAPS'),
          { attribution:'&copy; <a href="http://www.ign.fr/">IGN-France</a>',
              maxZoom:18
          });

  var osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var osmAttribution = 'Map data &copy; 2013 <a href="http://openstreetmap'+
                       '.org">OpenStreetMap</a> contributors';
  var osm = new L.TileLayer(osmUrl, {maxZoom: 18, attribution: osmAttribution});

  var osmfrUrl = 'http://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
  var osmfr = new L.TileLayer(osmfrUrl,
              {maxZoom: 20, attribution: osmAttribution});
  var osmfr2 = new L.TileLayer(osmfrUrl,
               {minZoom: 0, maxZoom: 13, attribution: osmAttribution});

  var openmapsurferUrl = 'http://openmapsurfer.uni-hd.de/tiles/roads/'+
                         'x={x}&y={y}&z={z}';
  var openmapsurferAttribution = 'Imagery from <a href="http://giscience.uni'+
  '-hd.de/">GIScience Research Group @ University of Heidelberg</a> &mdash; '+
  'Map data &copy; <a href="http://www.openstreetmap.org/copyright">'+
  'OpenStreetMap</a>';
  var openmapsurfer = new L.TileLayer(openmapsurferUrl,
                      {maxZoom: 18, attribution: openmapsurferAttribution});

  var transportUrl = 'http://a.tile2.opencyclemap.org/transport/{z}/{x}/{y}.'+
                     'png';
  var transport = new L.TileLayer(transportUrl,
                  {maxZoom: 18, attribution: osmAttribution});

  var pisteUrl = 'http://tiles.openpistemap.org/nocontours/{z}/{x}/{y}.png';
  var piste = new L.TileLayer(pisteUrl,
              {maxZoom: 18, attribution: osmAttribution});

  var hikebikeUrl = 'http://toolserver.org/tiles/hikebike/{z}/{x}/{y}.png';
  var hikebike = new L.TileLayer(hikebikeUrl,
                 {maxZoom: 18, attribution: osmAttribution});

  var osmCycleUrl = 'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png';
  var osmCycleAttrib = '&copy; <a href="http://www.opencyclemap.org">'+
  'OpenCycleMap</a>, &copy; <a href="http://www.openstreetmap.org/copyright">'+
  'OpenStreetMap</a>';
  var osmCycle = new L.TileLayer(osmCycleUrl,
                 {maxZoom: 18, attribution: osmCycleAttrib});

  var darkUrl = 'http://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
  var darkAttrib = '&copy; Map tiles by CartoDB, under CC BY 3.0. Data by'+
                   ' OpenStreetMap, under ODbL.';
  var dark = new L.TileLayer(darkUrl, {maxZoom: 18, attribution: darkAttrib});

  var esriTopoUrl = 'http://server.arcgisonline.com/ArcGIS/rest/services/World'+
                    '_Topo_Map/MapServer/tile/{z}/{y}/{x}';
  var esriTopoAttrib = 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, '+
  'TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ord'+
  'nance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User'+
  ' Community';
  var esriTopo = new L.TileLayer(esriTopoUrl,
                 {maxZoom: 18, attribution: esriTopoAttrib});

  var esriAerialUrl = 'http://server.arcgisonline.com/ArcGIS/rest/services'+
                      '/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var esriAerialAttrib = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, '+
  'USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the'+
  ' GIS User Community';
  var esriAerial = new L.TileLayer(esriAerialUrl,
                   {maxZoom: 18, attribution: esriAerialAttrib});

  var tonerUrl = 'http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.jpg';
  var stamenAttribution = '<a href="http://leafletjs.com" title="A JS library'+
  ' for interactive maps">Leaflet</a> | © Map tiles by <a href="http://stamen'+
  '.com">Stamen Design</a>, under <a href="http://creativecommons.org/license'+
  's/by/3.0">CC BY 3.0</a>, Data by <a href="http://openstreetmap.org">OpenSt'+
  'reetMap</a>, under <a href="http://creativecommons.org/licenses/by-sa/3.0"'+
  '>CC BY SA</a>.';
  var toner = new L.TileLayer(tonerUrl,
              {maxZoom: 18, attribution: stamenAttribution});

  var watercolorUrl = 'http://{s}.tile.stamen.com/watercolor/{z}/{x}/{y}.jpg';
  var watercolor = new L.TileLayer(watercolorUrl,
                   {maxZoom: 18, attribution: stamenAttribution});

  var routeUrl = 'http://{s}.tile.openstreetmap.fr/route500/{z}/{x}/{y}.png';
  var routeAttrib = '&copy, Tiles © <a href="http://www.openstreetmap.fr">O'+
  'penStreetMap France</a>';
  var route = new L.TileLayer(routeUrl,
              {minZoom: 1, maxZoom: 20, attribution: routeAttrib});

  var baseLayers = {
        'OpenStreetMap': osm,
        'OpenCycleMap': osmCycle,
        'IGN France': ign,
        'OpenMapSurfer Roads': openmapsurfer,
        'Hike & bike': hikebike,
        'OSM Transport': transport,
        'ESRI Aerial': esriAerial,
        'ESRI Topo with relief': esriTopo,
        'Dark' : dark,
        'Toner' : toner,
        'Watercolor' : watercolor,
        'OpenStreetMap France': osmfr
  };
  var baseOverlays = {
      'OsmFr Route500': route,
      'OpenPisteMap Relief':
        L.tileLayer('http://tiles2.openpistemap.org/landshaded/{z}/{x}/{y}.png',
                    {
                    attribution: '&copy, Tiles © <a href="http://www.o'+
                    'penstreetmap.fr">OpenStreetMap France</a>',
                    minZoom: 1,
                    maxZoom: 15
                    }
        ),
      'OpenPisteMap pistes' : piste
  };

  //var layerlist = [osm,osmCycle,ign,openmapsurfer,hikebike,transport,
  //esriAerial,esriTopo,dark,toner,watercolor,osmfr];
  var layerlist = [];

  gpxpod.map = new L.Map('map', {zoomControl: true, layers: layerlist})
  .setActiveArea('activeArea');

  L.control.scale({metric: true, imperial: true, position:'topleft'})
  .addTo(gpxpod.map);

  L.control.mousePosition().addTo(gpxpod.map);
  gpxpod.searchControl = L.Control.geocoder({position:'topleft'});
  gpxpod.searchControl.addTo(gpxpod.map);
  gpxpod.locateControl = L.control.locate({follow:true});
  gpxpod.locateControl.addTo(gpxpod.map);
  L.control.sidebar('sidebar').addTo(gpxpod.map);

  gpxpod.map.setView(new L.LatLng(27, 5), 3);

  gpxpod.map.addLayer(baseLayers[default_layer]);

  gpxpod.activeLayers = L.control.activeLayers(baseLayers, baseOverlays);
  gpxpod.activeLayers.addTo(gpxpod.map);

  gpxpod.minimapControl = new L.Control.MiniMap(
          osmfr2,
          { toggleDisplay: true, position:'bottomleft' }
  ).addTo(gpxpod.map);
  gpxpod.minimapControl._toggleDisplayButtonClicked();

  //gpxpod.map.on('contextmenu',rightClick);
  //gpxpod.map.on('popupclose',function() {});
  //gpxpod.map.on('viewreset',updateTrackListFromBounds);
  //gpxpod.map.on('dragend',updateTrackListFromBounds);
  gpxpod.map.on('moveend',updateTrackListFromBounds);
  gpxpod.map.on('zoomend',updateTrackListFromBounds);
  gpxpod.map.on('baselayerchange',updateTrackListFromBounds);
}

//function rightClick(e) {
//    //new L.popup()
//    //    .setLatLng(e.latlng)
//    //    .setContent(preparepopup(e.latlng.lat,e.latlng.lng))
//    //    .openOn(gpxpod.map);
//}

function removeMarkers(){
    if (gpxpod.markerLayer !== null){
        gpxpod.map.removeLayer(gpxpod.markerLayer);
        delete gpxpod.markerLayer;
        gpxpod.markerLayer = null;
    }
}

// add markers respecting the filtering rules
function addMarkers(){
    var markerclu = L.markerClusterGroup({ chunkedLoading: true });
    var a, title, marker;
    for (var i = 0; i < gpxpod.markers.length; i++) {
        a = gpxpod.markers[i];
        if (filter(a)){
            title = a[NAME];
            marker = L.marker(L.latLng(a[LAT], a[LON]), { title: title });
            marker.bindPopup(
                gpxpod.markersPopupTxt[title].popup,
                {autoPan:true}
            );
            gpxpod.markersPopupTxt[title].marker = marker;
            markerclu.addLayer(marker);
        }
    }

    gpxpod.map.addLayer(markerclu);
    //gpxpod.map.setView(new L.LatLng(47, 3), 2);

    gpxpod.markerLayer = markerclu;

    //markers.on('clusterclick', function (a) {
    //   var bounds = a.layer.getConvexHull();
    //   updateTrackListFromBounds(bounds);
    //});
}

// return true if the marker respects all filters
function filter(m){
    var mdate = new Date(m[DATE_END].split(' ')[0]);
    var mdist = m[TOTAL_DISTANCE];
    var mceg = m[POSITIVE_ELEVATION_GAIN];
    var datemin = $('#datemin').val();
    var datemax = $('#datemax').val();
    var distmin = $('#distmin').val();
    var distmax = $('#distmax').val();
    var cegmin = $('#cegmin').val();
    var cegmax = $('#cegmax').val();

    if (datemin !== ''){
        var ddatemin = new Date(datemin);
        if (mdate < ddatemin){
            return false;
        }
    }
    if (datemax !== ''){
        var ddatemax = new Date(datemax);
        if (ddatemax < mdate){
            return false;
        }
    }
    if (distmin !== ''){
        if (mdist < distmin){
            return false;
        }
    }
    if (distmax !== ''){
        if (distmax < mdist){
            return false;
        }
    }
    if (cegmin !== ''){
        if (mceg < cegmin){
            return false;
        }
    }
    if (cegmax !== ''){
        if (cegmax < mceg){
            return false;
        }
    }

    return true;
}

function clearFiltersValues(){
    $('#datemin').val('');
    $('#datemax').val('');
    $('#distmin').val('');
    $('#distmax').val('');
    $('#cegmin').val('');
    $('#cegmax').val('');
}

function updateTrackListFromBounds(e){

    var m;
    var table_rows = '';
    var mapBounds = gpxpod.map.getBounds();
    var activeLayerName = gpxpod.activeLayers.getActiveBaseLayer().name;
    var url = OC.generateUrl('/apps/files/ajax/download.php');
    for (var i = 0; i < gpxpod.markers.length; i++) {
        m = gpxpod.markers[i];
        if (filter(m)){
            if (mapBounds.contains(new L.LatLng(m[LAT], m[LON]))){
                if (gpxpod.gpxlayers.hasOwnProperty(m[NAME])){
                    table_rows = table_rows+'<tr><td style="background-color:'+
                    gpxpod.gpxlayers[m[NAME]].color+'"><input type="checkbox"';
                    table_rows = table_rows+' checked="checked" ';
                }
                else{
                    table_rows = table_rows+'<tr><td><input type="checkbox"';
                }
                table_rows = table_rows+' class="drawtrack" id="'+
                             escapeHTML(m[NAME])+'"></td>\n';
                table_rows = table_rows+
                             '<td class="trackname"><div class="trackcol">';
                //table_rows = table_rows + "<a href='getGpxFile.php?subfolder=
                //"+gpxpod.subfolder+"&track="+m[NAME]+"' target='_blank' 
                //class='tracklink'>"+m[NAME]+"</a>\n";
                table_rows = table_rows + '<a href="'+url+'?dir='+
                gpxpod.subfolder+'&files='+escapeHTML(m[NAME])+'" class="tracklink">'+
                escapeHTML(m[NAME])+'</a>\n';

                table_rows = table_rows +' <a class="permalink" '+
                'title="permalink" target="_blank" href="?subfolder='+
                gpxpod.subfolder+'&track='+escapeHTML(m[NAME])+'&layer='+
                activeLayerName+'">[p]</a></div></td>\n';

                table_rows = table_rows + '<td>'+
                             escapeHTML(m[DATE_END]).split(' ')[0]+'</td>\n';
                table_rows = table_rows +
                '<td>'+(m[TOTAL_DISTANCE]/1000).toFixed(2)+'</td>\n';

                table_rows = table_rows +
                '<td><div class="durationcol">'+
                escapeHTML(m[TOTAL_DURATION])+'</div></td>\n';

                table_rows = table_rows +
                '<td>'+escapeHTML(m[POSITIVE_ELEVATION_GAIN])+'</td>\n';
                table_rows = table_rows + '</tr>\n';
            }
        }
    }

    if (table_rows === ''){
        var table = 'None';
        $('#gpxlist').html(table);
    }
    else{
        var table = '<table id="gpxtable" class="tablesorter">\n<thead>';
        table = table + '<tr>';
        table = table + '<th>draw</th>\n';
        table = table + '<th>track</th>\n';
        table = table + '<th>date</th>\n';
        table = table + '<th>dist<br/>ance<br/>(km)</th>\n';
        table = table + '<th>duration</th>\n';
        table = table + '<th>cumulative<br/>elevation<br/>gain (m)</th>\n';
        table = table + '</tr></thead><tbody>\n';
        table = table + table_rows;
        table = table + '</tbody></table>';
        $('#gpxlist').html(table);
        $('#gpxtable').tablesorter({
            widthFixed: false,
            sortList: [gpxpod.tablesortCol],
            dateFormat: 'yyyy-mm-dd',
            headers: {
                2: {sorter: 'shortDate', string: 'min'},
                3: {sorter: 'digit', string: 'min'},
                4: {sorter: 'time'},
                5: {sorter: 'digit', string: 'min'},
            }
        });
    }
}

/*
 * display markers if the checkbox is checked
 */
function redraw()
{
    // remove markers if they are present
    removeMarkers();
    if ($('#displayclusters').is(':checked')){
        addMarkers();
    }
    return;

}

function addColoredTrackDraw(geojson, withElevation){
    deleteOnHover();

    var color = 'red';

    var json = $.parseJSON(geojson);
    var tid = json.id;

    if (withElevation){
        removeElevation();
        if (gpxpod.gpxlayers.hasOwnProperty(tid)){
            console.log('remove '+tid);
            removeTrackDraw(tid);
        }

        var el = L.control.elevation(
                {position:'bottomright',
                    height:100,
                    width:700,
                    margins: {
                        top: 10,
                        right: 80,
                        bottom: 30,
                        left: 50
                    },
                    theme: 'steelblue-theme'}
        );
        el.addTo(gpxpod.map);
        gpxpod.elevationLayer = el;
        gpxpod.elevationTrack = tid;
    }

    if (! gpxpod.gpxlayers.hasOwnProperty(tid)){
        gpxpod.gpxlayers[tid] = {color: color};
        gpxpod.gpxlayers[tid]['layer'] = new L.geoJson(json,{
            style: function (feature) {
                return {
                    color: getColor(feature.properties,json.properties),
                    opacity: 0.9
                };
            },
            pointToLayer: function (feature, latlng) {
                return L.marker(
                        latlng,
                        {
                            icon: L.divIcon({
                                    iconSize:L.point(4,4),
                                    html:'<div style="color:blue"><b>'+
                                         feature.id+'</b></div>'
                                  })
                        }
                );
            },
            onEachFeature: function (feature, layer) {
                if (feature.geometry.type === 'LineString'){
                    var title = json.id;
                    var popupTxt = '<h3 style="text-align:center;">Track : '+
                    '<a href="getGpxFile.php?subfolder='+gpxpod.subfolder+
                    '&track='+title+'" class="getGpx"  target="_blank">'+
                    title+'</a>'+feature.id+'</h3><hr/>';

                    popupTxt = popupTxt+'<a href="" track="'+title+'" class="'+
                    'displayelevation" >View elevation profile</a><br/>';

                    popupTxt = popupTxt+'<a href="?subfolder='+
                    gpxpod.subfolder+'&track='+title+'">Permalink</a>';

                    popupTxt = popupTxt+'<ul>';
                    popupTxt = popupTxt+'<li>Speed : '+
                               feature.properties.speed+' km/h</li>';
                    popupTxt = popupTxt+'<li>Slope : '+
                               feature.properties.slope+'</li>';
                    popupTxt = popupTxt+'<li>Elevation : '+
                               feature.properties.elevation+' m</li>';
                    popupTxt = popupTxt+'</ul>';
                    layer.bindPopup(popupTxt,{autoPan:true});
                    if (withElevation){
                        console.log('lp')
                        el.addData(feature, layer)
                    }
                }
                else if (feature.geometry.type === 'Point'){
                    layer.bindPopup(feature.id);
                }
            }
        });
        gpxpod.gpxlayers[tid].layer.addTo(gpxpod.map);
        gpxpod.map.fitBounds(gpxpod.gpxlayers[tid].layer.getBounds());
        updateTrackListFromBounds();
    }
}

function getColor(fp, jp){
    if ($('#colorcriteria').val() === 'speed'){
        var speed_delta = jp['speedMax'] - jp['speedMin'];
        var pc = (fp['speed'] - jp['speedMin']) / speed_delta * 100;
    }
    else if ($('#colorcriteria').val() === 'slope'){
        var slope_delta = jp['slopeMax'] - jp['slopeMin'];
        var pc = ((fp['slope']*100)+20)/40*100
    }
    else if ($('#colorcriteria').val() === 'elevation'){
        var elevation_delta = jp['elevationMax'] - jp['elevationMin'];
        var pc = (fp['elevation'] - jp['elevationMin']) / elevation_delta * 100;
    }
    var r = 2*pc;
    var g = 2*(100-pc);
    var b = 0;
    // nice idea to go over 100
    var rgb = 'rgb('+r+'%,'+g+'%,'+b+'%)';
    return rgb;
}

function addTrackDraw(geojson, withElevation){
    deleteOnHover();

    // choose color
    var color;
    color=colors[++lastColorUsed % colors.length];

    var json = $.parseJSON(geojson);
    var tid = json.id;

    if (withElevation){
        removeElevation();
        if (gpxpod.gpxlayers.hasOwnProperty(tid)){
            // get track color to draw it again with this one
            $('input.drawtrack:checked').each(function(){
                if ($(this).attr('id') === tid){
                    color = $(this).parent().css('background-color');
                }
            });
            lastColorUsed--;
            console.log('remove '+tid);
            removeTrackDraw(tid);
        }

        var el = L.control.elevation({
            position:'bottomright',
            height:100,
            width:700,
            margins: {
                top: 10,
                right: 80,
                bottom: 30,
                left: 50
            },
            theme: 'steelblue-theme'
        });
        el.addTo(gpxpod.map);
        gpxpod.elevationLayer = el;
        gpxpod.elevationTrack = tid;
    }

    if (! gpxpod.gpxlayers.hasOwnProperty(tid)){
        gpxpod.gpxlayers[tid] = {color: color};
        gpxpod.gpxlayers[tid]['layer'] = new L.geoJson(json,{
            style: {color: color},
            pointToLayer: function (feature, latlng) {
                return L.marker(
                        latlng,
                        {
                            icon: L.divIcon({
                                iconSize:L.point(4,4),
                                html:'<div style="color:blue"><b>'+
                                    feature.id+'</b></div>'
                            })
                        }
                        );
            },
            onEachFeature: function (feature, layer) {
                if (feature.geometry.type === 'LineString'){
                    layer.bindPopup(
                            gpxpod.markersPopupTxt[feature.id].popup,
                            {autoPan:true}
                    );
                    if (withElevation){
                        el.addData(feature, layer)
                    }
                }
                else if (feature.geometry.type === 'Point'){
                    layer.bindPopup(feature.id);
                }
            }
        });
        gpxpod.gpxlayers[tid].layer.addTo(gpxpod.map);
        if ($('#autozoomcheck').is(':checked')){
            gpxpod.map.fitBounds(gpxpod.gpxlayers[tid].layer.getBounds());
        }
        updateTrackListFromBounds();
        if ($('#openpopupcheck').is(':checked')){
            // open popup on the marker position,
            // works better than opening marker popup
            // because the clusters avoid popup opening when marker is
            // not visible because it's grouped
            var pop = L.popup();
            pop.setContent(gpxpod.markersPopupTxt[tid].popup);
            pop.setLatLng(gpxpod.markersPopupTxt[tid].marker.getLatLng());
            pop.openOn(gpxpod.map);
        }
    }
}

function removeTrackDraw(tid){
    if (gpxpod.gpxlayers.hasOwnProperty(tid)){
        gpxpod.map.removeLayer(gpxpod.gpxlayers[tid].layer);
        delete gpxpod.gpxlayers[tid].layer;
        delete gpxpod.gpxlayers[tid].color;
        delete gpxpod.gpxlayers[tid];
        updateTrackListFromBounds();
        if (gpxpod.elevationTrack === tid){
            removeElevation();
        }
    }
}

function genPopupTxt(){
    var url = OC.generateUrl('/apps/files/ajax/download.php');
    for (var i = 0; i < gpxpod.markers.length; i++) {
        var a = gpxpod.markers[i];
        var title = escapeHTML(a[NAME]);
        //popupTxt = "<h3 style='text-align:center;'>Track : <a href='
        //getGpxFile.php?subfolder="+gpxpod.subfolder+"&track="+title+
        //"' class='getGpx'  target='_blank'>"+title+"</a></h3><hr/>";
        var popupTxt = '<h3 style="text-align:center;">Track : <a href="'+
        url+'?dir='+gpxpod.subfolder+'&files='+a[NAME]+
        '" class="getGpx" >'+title+'</a></h3><hr/>';

        popupTxt = popupTxt + '<a href="" track="'+title+
        '" class="displayelevation" >View elevation profile</a><br/>';

        popupTxt = popupTxt + '<a href="?subfolder='+gpxpod.subfolder+
                   '&track='+title+'">Permalink</a>';
        popupTxt = popupTxt +'<ul>';
        if (a[TOTAL_DISTANCE] !== null){
            if (a[TOTAL_DISTANCE] > 1000){
                popupTxt = popupTxt +'<li><b>Distance</b> : '+
                           (a[TOTAL_DISTANCE]/1000).toFixed(2)+' km</li>';
            }
            else{
                popupTxt = popupTxt +'<li><b>Distance</b> : '+
                           a[TOTAL_DISTANCE].toFixed(2)+' m</li>';
            }
        }
        else{
            popupTxt = popupTxt +'<li>Distance : NA</li>';
        }
        popupTxt = popupTxt +'<li>Duration : '+a[TOTAL_DURATION]+'</li>';
        popupTxt = popupTxt +'<li><b>Moving time</b> : '+a[MOVING_TIME]+
                   '</li>';
        popupTxt = popupTxt +'<li>Pause time : '+a[STOPPED_TIME]+'</li>';
        popupTxt = popupTxt +'<li>Begin : '+a[DATE_BEGIN]+'</li>';
        popupTxt = popupTxt +'<li>End : '+a[DATE_END]+'</li>';
        popupTxt = popupTxt +'<li><b>Cumulative elevation gain</b> : '+
                   a[POSITIVE_ELEVATION_GAIN]+' m</li>';
        popupTxt = popupTxt +'<li>Cumulative elevation loss : '+
                   a[NEGATIVE_ELEVATION_GAIN]+' m</li>';
        popupTxt = popupTxt +'<li>Minimum elevation : '+
                   a[MIN_ELEVATION]+' m</li>';
        popupTxt = popupTxt +'<li>Maximum elevation : '+
                   a[MAX_ELEVATION]+' m</li>';
        if (a[MAX_SPEED] !== null){
            popupTxt = popupTxt +'<li><b>Max speed</b> : '+
                       a[MAX_SPEED].toFixed(2)+' km/h</li>';
        }
        else{
            popupTxt = popupTxt +'<li>Max speed : NA</li>';
        }
        if (a[AVERAGE_SPEED] !== null){
            popupTxt = popupTxt +'<li>Average speed : '+
                       a[AVERAGE_SPEED].toFixed(2)+' km/h</li>';
        }
        else{
            popupTxt = popupTxt +'<li>Average speed : NA</li>';
        }
        if (a[MOVING_AVERAGE_SPEED] !== null){
            popupTxt = popupTxt +'<li><b>Moving average speed</b> : '+
                       a[MOVING_AVERAGE_SPEED].toFixed(2)+' km/h</li>';
        }
        else{
            popupTxt = popupTxt +'<li>Moving average speed : NA</li>';
        }
        popupTxt = popupTxt + '</ul>';

        gpxpod.markersPopupTxt[title] = {};
        gpxpod.markersPopupTxt[title].popup = popupTxt;
    }
}

function removeElevation(){
    // clean other elevation
    if (gpxpod.elevationLayer !== null){
        gpxpod.map.removeControl(gpxpod.elevationLayer);
        delete gpxpod.elevationLayer;
        gpxpod.elevationLayer = null;
        delete gpxpod.elevationTrack;
        gpxpod.elevationTrack = null;
    }
}

function compareSelectedTracks(){
    // build url list
    var params = [];
    var i = 1;
    var param = 'subfolder='+gpxpod.subfolder;
    params.push(param);
    $('#gpxtable tbody input[type=checkbox]:checked').each(function(){
        var aa = $(this).parent().parent().find('td.trackname a.tracklink');
        //var trackpageurl = aa.attr('href');
        var trackname = aa.text();
        //var param = 'gpx'+i+'='+
        //            encodeURIComponent(location.protocol + '//' + location.host+trackpageurl);
        //var param = 'gpx'+i+'='+trackname;
        //params.push(param);
        params.push('name'+i+'='+trackname);
        i++;
    });

    // go to new gpxcomp tab
    var win = window.open(
            gpxpod.gpxcompRootUrl+'?'+params.join('&'), '_blank'
    );
    if(win){
        //Browser has allowed it to be opened
        win.focus();
    }else{
        //Broswer has blocked it
        alert('Allow popups for this site in order to open comparison'+
               ' tab/window.');
    }
}

function checkKey(e){
    e = e || window.event;
    var kc = e.keyCode;
    console.log(kc);

    if (kc === 0 || kc === 176 || kc === 192){
        e.preventDefault();
        gpxpod.searchControl._toggle();
    }
    if (kc === 161 || kc === 223){
        e.preventDefault();
        gpxpod.minimapControl._toggleDisplayButtonClicked();
    }
    if (kc === 60 || kc === 220){
        e.preventDefault();
        $('#sidebar').toggleClass('collapsed');
    }
}

function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) 
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === sParam) 
        {
            return sParameterName[1];
        }
    }
}

function displayOnHover(tr){
    if (gpxpod.currentAjax !== null){
        gpxpod.currentAjax.abort();
        hideLoadingAnimation();
    }
    if (!tr.find('.drawtrack').is(':checked')){
        var tid = tr.find('.drawtrack').attr('id');
        //gpxpod.currentAjax = $.ajax({url:
        //"getGeoJson.php?subfolder="+gpxpod.subfolder+"&track="+tid}).done(
        //        function(msg){addHoverTrackDraw(msg)});
        var req = {
            folder : gpxpod.subfolder,
            title : tid,
        }
        var url = OC.generateUrl('/apps/gpxpod/getgeo');
        showLoadingAnimation();
        gpxpod.currentAjax = $.post(url, req).done(function (response) {
            addHoverTrackDraw(response.track);
            hideLoadingAnimation();
        });

    }
}

function addHoverTrackDraw(geojson){
    deleteOnHover();

    if (gpxpod.insideTr){
        var json = $.parseJSON(geojson);
        var tid = json.id;

        gpxpod.currentHoverLayer = new L.geoJson(json,{
            style: {color: 'blue', opacity: 0.7},
            pointToLayer: function (feature, latlng) {
                return L.marker(
                        latlng,
                        {
                            icon: L.divIcon(
                                {
                                    iconSize:L.point(4,4),
                                    html:'<div style="color:blue"><b>'+
                                         feature.id+'</b></div>'
                                }
                                )
                        });
            },
        });
        gpxpod.currentHoverLayer.addTo(gpxpod.map);
    }
}

function deleteOnHover(){
    if (gpxpod.currentHoverLayer !== null){
        gpxpod.map.removeLayer(gpxpod.currentHoverLayer);
    }
}

function showLoadingAnimation(){
    //$('#loading').show('scale',{},200);
    //$('#loading').fadeIn(150);
    $('#loading').show();
}

function hideLoadingAnimation(){
    //$('#loading').hide('scale',{},200);
    //$('#loading').fadeOut(150);
    $('#loading').hide();
}

$(document).ready(function(){
    load();
    var markerstxt = $('#markers').text();
    if (markerstxt !== null && markerstxt !== ''){
        gpxpod.markers = $.parseJSON(markerstxt).markers;
        gpxpod.subfolder = $('#subfolder').text();
        gpxpod.rootUrl = $('#rooturl').text();
        gpxpod.gpxcompRootUrl = $('#gpxcomprooturl').text();
        genPopupTxt();

        redraw();
        updateTrackListFromBounds();
    }
    else{
        console.log('no marker');
    }
    $('body').on('change','.drawtrack', function() {
        var tid = $(this).attr('id');
        if ($(this).is(':checked')){
            if (gpxpod.currentAjax !== null){
                gpxpod.currentAjax.abort();
                hideLoadingAnimation();
            }
            if ($('#colorcriteria').val() !== 'none'){
                //gpxpod.currentAjax = $.ajax({url: 
                //"getColoredGeoJson.php?subfolder="+gpxpod.subfolder+
                //"&track="+tid}).done(
                //        function(msg){addColoredTrackDraw(msg, false)});
                var req = {
                    folder : gpxpod.subfolder,
                    title : tid,
                }
                var url = OC.generateUrl('/apps/gpxpod/getgeocol');
                showLoadingAnimation();
                $.post(url, req).done(function (response) {
                    addColoredTrackDraw(response.track, false);
                    hideLoadingAnimation();
                });
            }
            else{
                //gpxpod.currentAjax = $.ajax({url: 
                //"getGeoJson.php?subfolder="+gpxpod.subfolder+
                //"&track="+tid}).done(
                //        function(msg){addTrackDraw(msg, false)});
                var req = {
                    folder : gpxpod.subfolder,
                    title : tid,
                }
                var url = OC.generateUrl('/apps/gpxpod/getgeo');
                showLoadingAnimation();
                $.post(url, req).done(function (response) {
                    addTrackDraw(response.track, false);
                    hideLoadingAnimation();
                });
            }
        }
        else{
            removeTrackDraw(tid);
        }
    });
    $('body').on('mouseenter','#gpxtable tbody tr', function() {
        displayOnHover($(this));
        if ($('#transparentcheck').is(':checked')){
            $('#sidebar').addClass('transparent');
        }
        gpxpod.insideTr = true;
    });
    $('body').on('mouseleave','#gpxtable tbody tr', function() {
        $('#sidebar').removeClass('transparent');
        deleteOnHover();
        gpxpod.insideTr = false;
    });
    // keeping table sort order
    $('body').on('sortEnd','#gpxtable', function(sorter) {
        gpxpod.tablesortCol = sorter.target.config.sortList[0];
    });
    $('body').on('change','#displayclusters', function() {
        redraw();
    });
    $('body').on('click','#comparebutton', function(e) {
        compareSelectedTracks();
    });
    $('body').on('click','#removeelevation', function(e) {
        removeElevation();
    });
    $('body').on('click','.displayelevation', function(e) {
        e.preventDefault();
        var track = $(this).attr('track');
        if (gpxpod.currentAjax !== null){
            gpxpod.currentAjax.abort();
            hideLoadingAnimation();
        }
        //gpxpod.currentAjax = $.ajax({url: "getGeoJson.php?subfolder
        //="+gpxpod.subfolder+"&track="+track}).done(
        //            function(msg){addTrackDraw(msg, true)});
        var req = {
            folder : gpxpod.subfolder,
            title : track,
        }
        var url = OC.generateUrl('/apps/gpxpod/getgeo');
        showLoadingAnimation();
        gpxpod.currentAjax = $.post(url, req).done(function (response) {
            addTrackDraw(response.track, true);
            hideLoadingAnimation();
        });
    });
    document.onkeydown = checkKey;

    // handle url parameters (permalink to track)
    var track = getUrlParameter('track');
    console.log('track '+track);
    if (typeof track !== 'undefined'){
        //$.ajax({url: "getGeoJson.php?subfolder="+gpxpod.subfolder+
        //"&track="+decodeURI(track)}).done(
        //        function(msg){addTrackDraw(msg, true)});
        var req = {
            folder : gpxpod.subfolder,
            title : decodeURI(track),
        }
        var url = OC.generateUrl('/apps/gpxpod/getgeo');
        showLoadingAnimation();
        gpxpod.currentAjax = $.post(url, req).done(function (response) {
            addTrackDraw(response.track, true);
            hideLoadingAnimation();
        });
    }

    // fields in main tab
    //$('#subfolderselect').selectmenu();
    $('#saveForm').button({
        icons: {primary: 'ui-icon-image'}
    });
    $('#removeelevation').button({
        icons: {primary: 'ui-icon-cancel'}
    });
    $('#comparebutton').button({
        icons: {primary: 'ui-icon-newwin'}
    });

    // fields in filters sidebar tab
    $('#datemin').datepicker({
        showAnim: 'slideDown',
        dateFormat: 'yy-mm-dd',
        changeMonth: true,
        changeYear: true
    });
    $('#datemax').datepicker({
        showAnim: 'slideDown',
        dateFormat: 'yy-mm-dd',
        changeMonth: true,
        changeYear: true
    });
    $('#distmin').spinner({
        min: 0,
        step:500,
    })
    $('#distmax').spinner({
        min: 0,
        step:500,
    })
    $('#cegmin').spinner({
        min: 0,
        step:100,
    })
    $('#cegmax').spinner({
        min: 0,
        step:100,
    })
    $('#clearfilter').button({
        icons: {primary: 'ui-icon-trash'}
    }).click(function(e){
        e.preventDefault();
        clearFiltersValues();
        redraw();
        updateTrackListFromBounds();

    });
    $('#applyfilter').button({
        icons: {primary: 'ui-icon-check'}
    }).click(function(e){
        e.preventDefault();
        redraw();
        updateTrackListFromBounds();
    });
});

})(jQuery, OC);
