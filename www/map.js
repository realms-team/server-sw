// LINK LIMITS
var GOOD_LINK_LIMIT     = -70;
var MEDIUM_LINK_LIMIT   = -80;
var BAD_LINK_LIMIT      = -90;

// LINK COLOR
var GOOD_LINK_COLOR     = "#00ff00"     // green
var MEDIUM_LINK_COLOR   = "#ffff00"     // orange
var BAD_LINK_COLOR      = "#ffff00"     // red

// Global variables
var map;
var MOTES = [];         // a list of [mac, Marker]
var LINKS = [];         // a list of [Polyline, rssi]
var timeout;

//------------------ Init functions ------------------------------------------//

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: -33.114274, lng: -68.480041},
        zoom: 20
    });
    map.setMapTypeId(google.maps.MapTypeId.SATELLITE);

    $('#timepicker').timepicker();
    $( "#datepicker" ).datepicker();
}

function load_data(utcTime, loop){
    clearLinks();

    if (utcTime == null)
        utcTime = new Date().toISOString();

    // MOTE CREATE
    var solType     = "SOL_TYPE_DUST_EVENTMOTECREATE";
    var encType     = encodeURIComponent(solType);
    var encTime     = encodeURIComponent(utcTime);
    $.getJSON("jsonp/" + encType + "/time/" + encTime, create_mote);

    // LINKS CREATE
    solType         = "SOL_TYPE_DUST_NOTIF_HRNEIGHBORS";
    encType         = encodeURIComponent(solType);
    $.getJSON("jsonp/" + encType + "/time/" + encTime, create_links);

    if (loop != 0)
        timeout = setTimeout(load_data, 30000);
    else
        clearTimeout(timeout)
}

//------------------ Main functions ------------------------------------------//

function create_mote(data){
    for (var i=0; i < data.length; i++) {
        // populate table
        MOTES[data[i].value.moteId] = [data[i].value.macAddress, null]
    }
}

function create_links(data){
    for (var i=0; i < data.length; i++) {
        udpateMote(data[i].mac, data[i].value.latitude,data[i].value.longitude);
    }
    for (var i=0; i < data.length; i++) {
        for (var j=0; j<data[i].value.neighbors.length; j++){
            var neighbor = data[i].value.neighbors[j];
            if (neighbor.neighborId in MOTES){
                var crd1 = getLocationFromMac(data[i].mac);
                var crd2 = getLocationFromId(neighbor.neighborId)
                if (crd1 != null && crd2 != null){
                    var lineCoordinates = [
                        crd1,
                        crd2
                    ];
                    var link = getLink(crd1, crd2);

                    // update link if already exists and new rssi is worst
                    if (link != null){
                        if (neighbor.rssi < link[1]){
                            var color = getLinkColor(neighbor.rssi);
                            link[1] = neighbor.rssi;
                            link[0].setMap(null);
                            link[0] = createPolyline(lineCoordinates,color);
                        }
                    } // create link if it does not already exists
                    else {
                        var color = getLinkColor(neighbor.rssi);
                        var l = createPolyline(lineCoordinates,color);
                        LINKS.push([l, neighbor.rssi]);
                    }
                }
            }
        }
    }
}

function setDate(){
    var date = $("#datepicker").val();
    var time = $("#timepicker").val();
    var utcTime = new Date(date + " " + time).toISOString();
    noLoop = 0;
    load_data(utcTime, noLoop);
}

//------------------ Helpers ------------------------------------------------//

function clearLinks(){
    // remove links
    for (var i=0; i<LINKS.length; i++) {
        if (i in LINKS){
            LINKS[i][0].setMap(null);
        }
    }
    LINKS = [];
    LINKS.length = 0;
}

function getLinkColor(rssi){
    if (rssi>GOOD_LINK_LIMIT)
        return GOOD_LINK_COLOR;
    else if ( rssi >= MEDIUM_LINK_LIMIT && rssi <= GOOD_LINK_LIMIT)
        return MEDIUM_LINK_COLOR;
    else
        return BAD_LINK_COLOR;
}

function udpateMote(mac, lat, lng){
    var moteId = null;
    for (var i=0; i<MOTES.length; i++) {
        if (i in MOTES){
            if (MOTES[i][0] == mac){
                if (MOTES[i][1] == null){
                    MOTES[i][1] = createMarker(lat, lng, mac);
                } else {
                    // TODO UPDATE MARKER
                }
            }
        }
    }
}

function createMarker(lat, lng, content){
    // create Markers
    var myLatLng = new google.maps.LatLng(lat, lng)
    var marker = new google.maps.Marker({
        position: myLatLng,
        map: map,
    });
    // add popup listener
    infoBox(map, marker, content);
    return marker;
}

function createPolyline(lineCoordinates,color){
    var tripPath = new google.maps.Polyline({
          path: lineCoordinates,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 1.0,
          strokeWeight: 2
    });
    tripPath.setMap(map);
    return tripPath
}

function getLink(LatLng1, LatLng2){
    for (i=0; i<LINKS.length; i++) {
        link = LINKS[i][0];
        var coord1 = "("+link.getPath().getAt(0).lat()+", "+link.getPath().getAt(0).lng()+")"
        var coord2 = "("+link.getPath().getAt(1).lat()+", "+link.getPath().getAt(1).lng()+")"
        if ( ((LatLng1.toString() == coord1) && (LatLng2.toString() == coord2)) ||
             ((LatLng2.toString() == coord1) && (LatLng1.toString() == coord2))
           ){
            return LINKS[i]
        }
    }
    return null
}

function markerExists(LatLng){
    for (i in MOTES) {
        if (MOTES[i][0].getPosition().toString() == LatLng.toString())
          return 1;
    }
    return 0;
}

function getLocationFromId(moteId){
    if (MOTES[moteId][1] != null)
        return MOTES[moteId][1].position;
    else
        return null
}

function getLocationFromMac(mac){
    for( i=0; i<MOTES.length; i++ ) {
        if (i in MOTES && MOTES[i][0] == mac){
            return MOTES[i][1].position;
        }
    }
    console.log("MAC not found:" + mac)
}

/*Function that shows a window with the content or info
 about the marker (sensor location)*/

function infoBox(map, marker, content) {
    var infoWindow = new google.maps.InfoWindow();
    // Attaching a click event to the current marker
    google.maps.event.addListener(marker, "click", function(e) {
        infoWindow.setContent(content);
        infoWindow.open(map, marker);
    });
}

