import { Component, ViewChild, ElementRef, NgZone } from '@angular/core';
import { HttpHeaders, HttpClient } from '@angular/common/http';
import { NavController, Platform } from '@ionic/angular';
import { BackgroundMode } from '@ionic-native/background-mode/ngx';
import { BackgroundGeolocation, BackgroundGeolocationConfig, BackgroundGeolocationResponse, BackgroundGeolocationCurrentPositionConfig } from '@ionic-native/background-geolocation/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { Storage } from '@ionic/storage';

import { Subscription } from 'rxjs/Subscription';
import { filter } from 'rxjs/operators';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type':  'application/json',
    'Authorization': 'ABSDEFGHIJKLMNOPQRST'
  })
};

declare var google: any;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  @ViewChild('map') mapElement: ElementRef;
  map: any;
  marker: any;
  currentMapTrack = null;

  api_url: any = 'http://103.234.94.132/ci_franchise/test';

  interval = 1000;
  isTracking = false;
  trackedRoute = [];
  previousTracks = [];

  forePosSubscription: Subscription;
  backPosSubscription: Subscription;

  deviceID: any = Math.floor(Math.random() * 20) + 1;

  constructor(
    public navCtrl: NavController,
    private platform: Platform,
    private backgroundMode: BackgroundMode,
    private geolocation: Geolocation,
    private backgroundGeolocation: BackgroundGeolocation,
    private storage: Storage,
    public http: HttpClient
  ) {
    // Check if platform is ready or not
    this.platform.ready().then(() => {

      // Check if background mode enabled or not
      if ( !this.backgroundMode.isEnabled() ) {
        this.backgroundMode.enable();
      }

      // Create map
      this.createMap();

      // Locate current position of device
      this.locateMe();

      // load history
      this.loadHistoricRoutes();

      const config: BackgroundGeolocationConfig = {
        desiredAccuracy: 10,
        stationaryRadius: 20,
        distanceFilter: 30,
        debug: true, //  enable this hear sounds for background-geolocation life-cycle.
        stopOnTerminate: false, // enable this to clear background location settings when the app terminates
        notificationTitle: 'Background tracking',
        notificationText: 'enabled',
      };

      this.backgroundGeolocation.configure(config).then( (location: BackgroundGeolocationResponse)  => {
        console.log('Background location - Success: ', location);
      }).catch((error) => {
        console.log('Background location - Error: ', error);
      });
    });
  }

  /**
   * Create Map
   */
  createMap() {
    // Create map instance
    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      zoom: 8,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });
  }

  /**
   * Load current position
   */
  locateMe() {
    // Create geolocation
    this.geolocation.getCurrentPosition().then(data => {
      const latLng = new google.maps.LatLng(data.coords.latitude, data.coords.longitude);

      // Set latitude/longitude
      this.map.setCenter(latLng);

      // Set zoom level
      this.map.setZoom(18);

      // Set Marker
      this.marker = new google.maps.Marker({
        map: this.map,
        title: 'You are here!',
        position: latLng
      });

    }).catch((error) => {
      console.log('Error getting location', error);
    });
  }

  /**
   * Load Previous History Routes
   */
  loadHistoricRoutes() {
    this.storage.get('routes').then(data => {
      if (data) {
        this.previousTracks = data;
      }
    });
  }

  /**
   * Flush all the previous Routes
   */
  flushHistoricRoutes() {
    this.previousTracks = [];
    this.storage.remove('routes');
  }

  /**
   * Start Tracking
   */
  startTracking() {
    this.isTracking = true;
    this.trackedRoute = [];

    this.backgroundMode.isActive() === true ? this.trackBackGeoLocation() : this.trackForeGeoLocation();

    this.backgroundMode.on('activate').subscribe(() => {
      this.trackBackGeoLocation();
      this.stopTrackForeGeoLocation();
    });
    this.backgroundMode.on('deactivate').subscribe(() => {
      this.trackForeGeoLocation();
      this.stopTrackBackGeoLocation();
    });

    // // Background geolocation track
    // const config: BackgroundGeolocationConfig = {
    //   desiredAccuracy: 10,
    //   stationaryRadius: 20,
    //   distanceFilter: 30,
    //   debug: true, //  enable this hear sounds for background-geolocation life-cycle.
    //   stopOnTerminate: false, // enable this to clear background location settings when the app terminates
    //   notificationTitle: 'Background tracking',
    //   notificationText: 'enabled',
    // };

    // this.backgroundGeolocation.configure(config).then( (location: BackgroundGeolocationResponse)  => {
    //   console.log('Background location - Success: ', location);
    // }).catch((error) => {
    //   console.log('Background location - Error: ', error);
    // });

    // // Turn ON the background-geolocation system.
    // this.backgroundGeolocation.start();

    // // foreground watch positions
    // this.forePosSubscription = this.geolocation.watchPosition()
    // .pipe(
    //   filter((p) => p.coords !== undefined) // Filter Out Errors
    // )
    // .subscribe(data => {
    //   // Record/draw/send position
    //   this.recordInstances(data);
    // });
  }

  // foreground watch positions
  trackForeGeoLocation() {
    this.forePosSubscription = this.geolocation.watchPosition()
    .pipe(
      filter((p) => p.coords !== undefined) // Filter Out Errors
    )
    .subscribe(data => {
      console.log('foregroundGeolocation start', data);
      // Record/draw/send position
      this.recordInstances(data);
    });
  }

  // Background geolocation track
  trackBackGeoLocation() {
    // Turn ON the background-geolocation system.
    this.backgroundGeolocation.start();
    setTimeout(() => {
      this.backgroundGeolocation.getCurrentLocation().then( (location) => {
        console.log('backgroundGeolocation start', location);

        // Send lat/lng to our server
        this.sendPathToServer({
          device_id: this.deviceID,
          lat: location.latitude,
          lng: location.longitude
        });

        // push position to tracked route
        this.trackedRoute.push({
          lat: location.latitude,
          lng: location.longitude
        });

        // Draw route on map
        this.reDrawPath(this.trackedRoute);
      });
    }, 10000);
  }

  // finish foreground tracking
  stopTrackForeGeoLocation() {
    this.forePosSubscription.unsubscribe();
  }

  // finish backgound tracking
  stopTrackBackGeoLocation() {
    this.backgroundGeolocation.finish();
  }

  /**
   * Record/Instances
   */
  recordInstances(data: any) {
    setTimeout(() => {
      // Send lat/lng to our server
      this.sendPathToServer({
        device_id: this.deviceID,
        lat: data.coords.latitude,
        lng: data.coords.longitude
      });

      // push position to tracked route
      this.trackedRoute.push({
        lat: data.coords.latitude,
        lng: data.coords.longitude
      });

      // Draw route on map
      this.reDrawPath(this.trackedRoute);
    }, 10000);
  }

  /**
   * Stop Tracking
   */
  stopTracking() {
    const newRoute = {
      finished: new Date().getTime(),
      path: this.trackedRoute
    };

    this.previousTracks.push(newRoute);
    this.storage.set('routes', this.previousTracks);

    // finish foreground tracking
    this.forePosSubscription.unsubscribe();

    // finish backgound tracking
    this.backgroundGeolocation.finish();

    this.isTracking = false;
    this.currentMapTrack.setMap(null);
  }

  /**
   * Draw/Re-draw path on Map
   */
  reDrawPath(path: any) {
    if (this.currentMapTrack) {
      this.currentMapTrack.setMap(null);
    }

    if (path.length > 1) {
      this.currentMapTrack = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#ff00ff',
        strokeOpacity: 1.0,
        strokeWeight: 3
      });
      this.currentMapTrack.setMap(this.map);
    }
  }

  /**
   * Show a history route
   * @param route route
   */
  showHistoryRoute(route: any) {
    this.reDrawPath(route);
  }

  /**
   * POST: add a new data to the server
   * @param data lat/long
   */
  sendPathToServer (data: any) {
    return this.http.post(this.api_url, data, httpOptions)
      .subscribe(res => {
        console.log(res);
      });
  }
}
