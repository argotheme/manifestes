'use strict';

angular.module('manifest.mapcontroller', ['underscore','config'])
////////////////////////////////////////////////////////////////////////
.controller('MapController', [
  '$scope',
  '$http',
  '$timeout',
  '_',
  'settings',
  function ($scope, $http, $timeout, _, settings) {

    ///////////////////////////////////////////////////////////////
    var updateMapStyles = function() {
      $scope.state.mapStyles = _.map($scope.meta.mapcredits, function(e) {
        var act = e.active ? "block" : "none";
        var css = 
          ".markdiv-"+e.color+" {background: #"+e.color+";} " +
          ".src-"+e.slug+" { display: "+act+"; }";
        return css;
      }).join(" ");
    };

    ///////////////////////////////////////////////////////////////
    $scope.toggleMapLegend = function(c) {
      //console.log("Toggling:",c);

      var isFull = _.findIndex($scope.meta.mapcredits, {active: false})==-1;
      if(isFull) _.each($scope.meta.mapcredits, function(e) {
        e.active = false;
      });
      
      if(c) c.active = !c.active;

      var isEmpty = _.findIndex($scope.meta.mapcredits, {active: true})==-1;
      if(isEmpty || !c) _.each($scope.meta.mapcredits, function(e) {
        e.active = true;
      });

      updateMapStyles();
    };

    $scope.initMap = function() {

      console.log("initing map !");

      var osm = L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      });
      var cycle = L.tileLayer('http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.opencyclemap.org/copyright">OpenCycleMap</a> contributors - &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      });
      var terrain = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS'
      });
      var tileLayers = {
        "OSM": osm,
        "Cycle": cycle,
        //"Terrain": terrain
      };

      if(!settings.dev)
        L.Icon.Default.imagePath = "build/images";

      var map = L.map('leaflet', {
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        center: [47, 2.5],
        zoom: 6,
        minZoom: 5,
        maxZoom: 15,
        locateButton: true,
        layers: [osm]
      });

      L.control.zoom({
        position: 'topleft', //'bottomleft'
      }).addTo(map);

      L.control.locate({
        position: 'topleft', //'bottomleft',
        icon: 'fa fa-street-view',
        showPopup: false,
      }).addTo(map);

      var layers = new L.LayerGroup().addTo(map);

      ///////////////////////////////////////////////////////////////
      // business to add a point
      var addMarker = function(m) {
        var credit = $scope.meta.mapcreditsOf['misc'];
        if($scope.meta.mapcreditsOf.hasOwnProperty(m.source))
          credit = $scope.meta.mapcreditsOf[m.source];
          

        // MakiMarkers !
        var icon = 'circle';
        //var color = "#"+credit.color || "#000";
        var size = [9,9];
        // icons use maki-markers: https://www.mapbox.com/maki/
        if(/region/.test(m.scale)) {
          size = [10,10];
          //icon = "land-use";
        }
        if(/city/.test(m.scale)) {
          //size = [12,12];
          //icon = "circle-stroked";
        }
        if(/zone/.test(m.scale)) {
          //size = [10,10];
          //icon = "circle-stroked";
        }
        if(/human/.test(m.tags)) {
          //size = "s";
          //icon = "heart";
        }
        if(/list/.test(m.tags)) {
          size = [14,14];
        }


        //var customPopup = "<div ng-include ng-init=\"data=leafmarkers['"+m.source+"']['mark_"+k+"'];\" src=\"'partials/marker.html'\"></div>";
        var customPopup = "<div class='details'>"+
          "<h3>"+m.name+"</h3>";
        if(m.address)
          customPopup += "<div class='address'>"+m.address+"</div>";
        if(m.description)
          customPopup += "<div class='descr'>"+m.description+"</div>";
        if(m.web) {
          customPopup += "<div class='web'>"+replaceURLWithHTMLLinks(m.web)+"</div>";
        }
        if(m.contact)
          customPopup += "<div class='contact'>"+m.contact+"</div>";
        customPopup += "</div>";

        var customOptions = {
          'maxWidth': '500',
          'className' : 'custom'
        }
        m.credit = credit;
        m.lat = parseFloat(m.lat);
        m.lng = parseFloat(m.lng);
        if(m.lat && m.lng) {

          // store total count to display counts within legend
          credit.count += 1;

          var css =
            "markdiv"+
            " markdiv-"+credit.color;
          if(m.source)
            css += " src-"+m.source;
          if(m.tags)
            css += " t-"+m.tags.replace(/ /g," t-");
            
          var theM = L.marker([m.lat, m.lng], {
            title: m.name,
            raw: _.pick(m,['description','address','credit']),
            icon: new L.DivIcon({
              iconSize: size,
              className: css 
            })
            /*icon: L.MakiMarkers.icon({
              icon: icon,
              color: color,
              size: size,
              className: css
            })*/
          })
          .bindPopup(customPopup,customOptions)
          .addTo(layers);
        } else {
          if($scope.settings.verbose)
            console.log("!! no lat/lng for:",m);
        }
      };
      
      ///////////////////////////////////////////////////////////////
      var fetch_local = function(callb) {
        $http.get(settings.datapath+'/map.csv')
          .success(function(data) {
            //console.log("got csv data:",data);
            //$scope.data = data;
            var ms = new CSV(data, {header:true, cast:false}).parse();
            
            $scope.points = ms;
            
            _.each(ms, function(m,k) {

              // if(!layers[m.source]) {
              //   layers[m.source] = new L.LayerGroup().addTo(overlays);
              // }

              addMarker(m);
              
            });
            callb();
          })
          .error(function(err) {
            console.log(err);
          });
      };

      ///////////////////////////////////////////////////////////////
      var fetch_geojson = function(callb) {
        var toFetch = _.filter($scope.meta.mapcredits, {type: "geojson"});
        _.each(toFetch, function(dat) {
          $http.get(settings.datapath+'/'+dat.geojson)
          //$http.get(dat.geojson)
            .success(function(geoj) {
              //console.log(dat.slug,geoj);
              _.each(geoj.features, function(m) {

                // default
                var name = totext(m.properties.title);
                var description = m.properties.description;
                var web =  "";

                if(dat.slug=='reporterre') {
                  name = name.replace(/Il y a \d* jours./,"");
                  web = dat.url +"/"+ m.properties.title.match(/href:\'([^\']*)\'/)[1];
                }
                if(dat.slug=='bastamag') {
                  web = m.properties.title.match(/<a href=\'([^\']*)\'/)[1];
                }
                if(dat.slug=='passerelle') {
                  web = dat.url +"/"+ m.properties.title.match(/<a href=\"([^\"]*)\"/)[1];
                }
                if(dat.slug=='ecoles') {
                  name = m.properties.Name;
                }

                addMarker({
                  source: dat.slug,
                  name: name,
                  description: description,
                  web: web,
                  lat: m.geometry.coordinates[1],
                  lng: m.geometry.coordinates[0]
                });
              });
            })
            .error(function(err) {
              console.log(err);
            });
        });
        // well.. not really async here :)
        callb();
      };

      ///////////////////////////////////////////////////////////////
      var fetch_agedefaire = function(callb) {
        var agedefaire = _.findWhere($scope.meta.mapcredits, {type: "xml"});
        $http.get(settings.datapath+'/'+agedefaire.xml)
        //$http.get(agedefaire.xml)
          .success(function(xml) {
            var json = xmlToJSON.parseString(xml, {
              childrenAsArray: false
            });
            //console.log("Age de:",json);
            _.each(json.markers.marker, function(m) {
              addMarker({
                source: "agedefaire",
                name: m._attr.name._value,
                description: "Point de vente de L'âge de faire",
                address: m._attr.address._value,
                lat: m._attr.lat._value,
                lng: m._attr.lng._value
              });
            });
            callb();
          })
          .error(function(err) {
            console.log(err);
          });
      };

      ///////////////////////////////////////////////////////////////
      var fetch_ffdn = function(callb) {
        var ffdn = _.findWhere($scope.meta.mapcredits, {slug: "ffdn"});
        $http.get(settings.datapath+'/'+ffdn.json)
          .success(function(json) {
            _.each(json, function(m) {
              if(m.coordinates)
                addMarker({
                  source: "ffdn",
                  name: m.shortname || " ", // warning not to crash the leaflet-search !
                  description: m.popup,
                  lat: m.coordinates.latitude,
                  lng: m.coordinates.longitude
                });
            });
            callb();
          })
          .error(function(err) {
            console.log(err);
          });
      };

      ///////////////////////////////////////////////////////////////
      var fetch_circuitscourts = function(callb) {
        var cc = _.findWhere($scope.meta.mapcredits, {slug: "circuitscourts"});
        if(!cc.hide)
        $http.get(settings.datapath+'/'+cc.json)
          .success(function(json) {
            _.each(json, function(m) {
              addMarker({
                source: "circuitscourts",
                name: m.nom || " ", // warning not to crash the leaflet-search !
                description: m.comm,
                address: m.loc,
                web: m.web,
                lat: m.lat,
                lng: m.lng
              });
            });
            callb();
          })
          .error(function(err) {
            console.log(err);
          });
        else
          callb();
      };

      ///////////////////////////////////////////////////////////////
      var fetch_demosphere = function(callb) {
        var demos = _.findWhere($scope.meta.mapcredits, {slug: "demosphere"});
        _.each(demos.json, function(u) {
          $http.get(u + "/event-list-json", { params: {
            //startTime: 1456182001,
            //endTime: 1456763106,
            place__latitude: true,
            place__longitude: true,
            place__zoom: true,
            topics: true,
            url: true
            //random=0.40452415758106963
          }}).success(function(json) {
              console.log("Demosph:",json);
              _.each(json.events, function(e) {
                addMarker({
                  source: "demosphere",
                  name: e.time,
                  description: e.title,
                  address: e.place_city_name,
                  web: u+e.url,
                  lat: e.place__latitude,
                  lng: e.place__longitude
                });
              });
              callb();
            })
            .error(function(err) {
              console.log(err);
            });
        });
      };


      ///////////////////////////////////////////////////////////////
      // now DO things (do it async please !)
      fetch_local(function() {
        fetch_geojson(function() {
          fetch_agedefaire(function() {
            fetch_ffdn(function() {
              fetch_circuitscourts(function() {


                var layerControl = L.control.layers(null, tileLayers, {position: 'topleft'});
                layerControl.addTo(map);
                //console.log("overlays !!",layers);
                L.control.search({
                  layer: layers,
                  initial: false,
                  zoom: 9,
                  //container: "searchinputformap",
                  // formatData: function(json) { // to also search within descriptions ?
                  //   var jsonret = {};
                  //   for(i in json) {
                  //     console.log(json[i]);
                  //     jsonret["gan"] = L.latLng( json[i][ propLoc[0] ], json[i][ propLoc[1] ] );
                  //   }
                  //   return {yo:"trop"};
                  // },
                  callTip: function(text, val) {
                    var d = val.layer.options.raw;
                    var sou = '<span class="markdiv-'+d.credit.color+' source">'+d.credit.slug+'</span> ';
                    var add = d.address ? ' <span class="address">'+totext(d.address)+'</span>' : "";
                    var des = d.description ? ' <span class="description">'+totext(d.description)+'</span>' : "";
                    return '<div>'+sou+text+add+des+'</div>';
                  }
                }).addTo(map);
                
                updateMapStyles();

                // when ready, remove loading
                //$timeout(function(){ $scope.state.loading = false; });
                //$scope.state.mapstatus = "DONE";


              });
            });
          });
        });
      });
    };

    $scope.initMap();

  }
]);