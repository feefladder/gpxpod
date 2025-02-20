<template>
	<div class="map-wrapper"
		:class="{ withTopLeftButton }">
		<a href="https://www.maptiler.com" class="watermark">
			<img src="https://api.maptiler.com/resources/logo.svg"
				alt="MapTiler logo">
		</a>
		<div id="gpxpod-map" ref="mapContainer" />
		<div v-if="map"
			class="map-content">
			<VMarker v-if="positionMarkerEnabled && positionMarkerLngLat"
				:map="map"
				:lng-lat="positionMarkerLngLat" />
			<!-- some stuff go away when changing the style -->
			<div v-if="mapLoaded">
				<TrackSingleColor v-if="hoveredTrack"
					:track="hoveredTrack"
					:map="map"
					:line-width="parseFloat(settings.line_width)"
					:border-color="lineBorderColor"
					:border="settings.line_border === '1'"
					:settings="settings" />
				<PolygonFill v-if="hoveredDirectoryLatLngs"
					layer-id="hover-dir-polygon"
					:lng-lats-list="hoveredDirectoryLatLngs"
					:map="map" />
				<ComparisonTrack v-for="g in comparisonGeojsons"
					:key="g.id"
					:geojson="g"
					:comparison-criteria="comparisonCriteria"
					:map="map"
					:settings="settings" />
				<div v-for="t in tracksToDraw"
					:key="t.id">
					<TrackSingleColor v-if="!t.colorExtensionCriteria && t.colorCriteria === COLOR_CRITERIAS.none.id"
						:track="t"
						:map="map"
						:line-width="parseFloat(settings.line_width)"
						:border-color="lineBorderColor"
						:border="settings.line_border === '1'"
						:opacity="parseFloat(settings.line_opacity)"
						:settings="settings" />
					<TrackGradientColorPointsPerSegment v-else
						:track="t"
						:map="map"
						:color-criteria="t.colorCriteria"
						:color-extension-criteria="t.colorExtensionCriteria"
						:color-extension-criteria-type="t.colorExtensionCriteriaType"
						:line-width="parseFloat(settings.line_width)"
						:border-color="lineBorderColor"
						:border="settings.line_border === '1'"
						:opacity="parseFloat(settings.line_opacity)"
						:settings="settings" />
				</div>
				<MarkerCluster v-if="settings.show_marker_cluster === '1'"
					:map="map"
					:tracks="clusterTracks"
					:circle-border-color="lineBorderColor"
					:settings="settings"
					@track-marker-hover-in="$emit('track-marker-hover-in', $event)"
					@track-marker-hover-out="$emit('track-marker-hover-out', $event)" />
				<PictureCluster v-if="settings.show_picture_cluster === '1'"
					:map="map"
					:pictures="clusterPictures"
					:circle-border-color="lineBorderColor"
					@picture-hover-in="$emit('picture-hover-in', $event)"
					@picture-hover-out="$emit('picture-marker-hover-out', $event)" />
			</div>
		</div>
	</div>
</template>

<script>
import maplibregl, {
	Map, Popup, TerrainControl, FullscreenControl,
	NavigationControl, ScaleControl, GeolocateControl,
} from 'maplibre-gl'
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import '@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css'

import { subscribe, unsubscribe } from '@nextcloud/event-bus'
import moment from '@nextcloud/moment'
import { imagePath } from '@nextcloud/router'

import {
	getRasterTileServers,
	getVectorStyles,
	getExtraTileServers,
} from '../../tileServers.js'
import { kmphToSpeed, metersToElevation, minPerKmToPace, formatExtensionKey, formatExtensionValue } from '../../utils.js'
import { mapImages, mapVectorImages } from '../../mapUtils.js'
import { MousePositionControl, TileControl } from '../../mapControls.js'
import { maplibreForwardGeocode } from '../../nominatimGeocoder.js'

import VMarker from './VMarker.vue'
import TrackSingleColor from './TrackSingleColor.vue'
import MarkerCluster from './MarkerCluster.vue'
import PictureCluster from './PictureCluster.vue'
import TrackGradientColorPointsPerSegment from './TrackGradientColorPointsPerSegment.vue'
import PolygonFill from './PolygonFill.vue'
import ComparisonTrack from '../comparison/ComparisonTrack.vue'

import { COLOR_CRITERIAS } from '../../constants.js'
const DEFAULT_MAP_MAX_ZOOM = 22

export default {
	name: 'MaplibreMap',

	components: {
		ComparisonTrack,
		TrackGradientColorPointsPerSegment,
		PictureCluster,
		PolygonFill,
		TrackSingleColor,
		MarkerCluster,
		VMarker,
	},

	props: {
		settings: {
			type: Object,
			default: () => ({}),
		},
		showMousePositionControl: {
			type: Boolean,
			default: false,
		},
		tracksToDraw: {
			type: Array,
			default: () => [],
		},
		hoveredTrack: {
			type: Object,
			default: null,
		},
		hoveredDirectoryBounds: {
			type: Object,
			default: null,
		},
		clusterTracks: {
			type: Array,
			default: () => [],
		},
		clusterPictures: {
			type: Array,
			default: () => [],
		},
		unit: {
			type: String,
			default: 'metric',
		},
		comparisonGeojsons: {
			type: Array,
			default: () => [],
		},
		comparisonCriteria: {
			type: String,
			default: '',
		},
		withTopLeftButton: {
			type: Boolean,
			default: false,
		},
	},

	data() {
		return {
			map: null,
			styles: {},
			mapLoaded: false,
			COLOR_CRITERIAS,
			mousePositionControl: null,
			scaleControl: null,
			terrainControl: null,
			persistentPopups: [],
			nonPersistentPopup: null,
			positionMarkerEnabled: false,
			positionMarkerLngLat: null,
		}
	},

	computed: {
		lineBorderColor() {
			// for testing reactivity in <Tracks*> because layers are actually re-rendered when the map style changes
			// return this.showMousePositionControl
			return ['dark', 'satellite'].includes(this.settings.mapStyle)
				? 'white'
				: 'black'
		},
		hoveredDirectoryLatLngs() {
			if (this.hoveredDirectoryBounds === null) {
				return null
			}
			const b = this.hoveredDirectoryBounds
			return [
				[[b.west, b.north], [b.east, b.north], [b.east, b.south], [b.west, b.south]],
			]
		},
	},

	watch: {
		showMousePositionControl(newValue) {
			if (newValue) {
				this.map.addControl(this.mousePositionControl, 'bottom-left')
			} else {
				this.map.removeControl(this.mousePositionControl)
			}
		},
		unit(newValue) {
			this.scaleControl?.setUnit(newValue)
		},
	},

	mounted() {
		this.initMap()
	},

	destroyed() {
		this.map.remove()
		unsubscribe('resize-map', this.resizeMap)
		unsubscribe('nav-toggled', this.onNavToggled)
		unsubscribe('sidebar-toggled', this.onNavToggled)
		unsubscribe('zoom-on-bounds', this.onZoomOnBounds)
		unsubscribe('chart-point-hover', this.onChartPointHover)
		unsubscribe('chart-mouseout', this.clearChartPopups)
		unsubscribe('chart-mouseenter', this.showPositionMarker)
	},

	methods: {
		initMap() {
			const apiKey = this.settings.maptiler_api_key
			// tile servers and styles
			this.styles = {
				...getVectorStyles(apiKey),
				...getRasterTileServers(apiKey),
				...getExtraTileServers(this.settings.extra_tile_servers, apiKey),
			}
			const restoredStyleKey = Object.keys(this.styles).includes(this.settings.mapStyle) ? this.settings.mapStyle : 'streets'
			const restoredStyleObj = this.styles[restoredStyleKey]

			// values that are saved in private page
			const centerLngLat = (this.settings.centerLat !== undefined && this.settings.centerLng !== undefined)
				? [parseFloat(this.settings.centerLng), parseFloat(this.settings.centerLat)]
				: [0, 0]
			const mapOptions = {
				container: 'gpxpod-map',
				style: restoredStyleObj.uri ? restoredStyleObj.uri : restoredStyleObj,
				center: centerLngLat,
				zoom: this.settings.zoom ?? 1,
				pitch: this.settings.pitch ?? 0,
				bearing: this.settings.bearing ?? 0,
				maxPitch: 75,
				maxZoom: restoredStyleObj.maxzoom ? (restoredStyleObj.maxzoom - 0.01) : DEFAULT_MAP_MAX_ZOOM,
			}
			this.map = new Map(mapOptions)
			// this is set when loading public pages
			if (this.settings.initialBounds) {
				const nsew = this.settings.initialBounds
				this.map.fitBounds([[nsew.west, nsew.north], [nsew.east, nsew.south]], {
					padding: 50,
					maxZoom: 18,
					animate: false,
				})
			}
			const navigationControl = new NavigationControl({ visualizePitch: true })
			this.scaleControl = new ScaleControl({ unit: this.unit })

			// search
			this.map.addControl(
				new MaplibreGeocoder({ forwardGeocode: maplibreForwardGeocode }, {
					maplibregl,
					placeholder: t('gpxpod', 'Search a location'),
					minLength: 4,
					debounceSearch: 400,
					popup: true,
					showResultsWhileTyping: true,
				}),
				'top-left'
			)

			const geolocateControl = new GeolocateControl({
				trackUserLocation: true,
				positionOptions: {
					enableHighAccuracy: true,
					timeout: 10000,
				},
			})
			this.map.addControl(navigationControl, 'bottom-right')
			this.map.addControl(this.scaleControl, 'top-left')
			this.map.addControl(geolocateControl, 'top-left')

			// mouse position
			this.mousePositionControl = new MousePositionControl()
			if (this.showMousePositionControl) {
				this.map.addControl(this.mousePositionControl, 'bottom-left')
			}

			// custom tile control
			const tileControl = new TileControl({ styles: this.styles, selectedKey: restoredStyleKey })
			tileControl.on('changeStyle', (key) => {
				this.$emit('map-state-change', { mapStyle: key })
				const mapStyleObj = this.styles[key]
				this.map.setMaxZoom(mapStyleObj.maxzoom ? (mapStyleObj.maxzoom - 0.01) : DEFAULT_MAP_MAX_ZOOM)

				// if we change the tile/style provider => redraw layers
				this.reRenderLayersAndTerrain()
			})
			this.map.addControl(tileControl, 'top-right')

			const fullscreenControl = new FullscreenControl()
			this.map.addControl(fullscreenControl, 'top-right')

			// terrain
			this.terrainControl = new TerrainControl({
				source: 'terrain',
				exaggeration: this.settings.terrainExaggeration,
			})
			this.map.addControl(this.terrainControl, 'top-right')
			this.terrainControl._terrainButton.addEventListener('click', (e) => {
				this.onTerrainControlClick()
			})

			this.handleMapEvents()

			this.map.on('load', () => {
				this.loadImages()

				const bounds = this.map.getBounds()
				this.$emit('map-bounds-change', {
					north: bounds.getNorth(),
					east: bounds.getEast(),
					south: bounds.getSouth(),
					west: bounds.getWest(),
				})
				this.addTerrainSource()
				if (this.settings.use_terrain === '1') {
					this.terrainControl._toggleTerrain()
				}
			})

			subscribe('resize-map', this.resizeMap)
			subscribe('nav-toggled', this.onNavToggled)
			subscribe('sidebar-toggled', this.onNavToggled)
			subscribe('zoom-on-bounds', this.onZoomOnBounds)
			subscribe('chart-point-hover', this.onChartPointHover)
			subscribe('chart-mouseout', this.clearChartPopups)
			subscribe('chart-mouseenter', this.showPositionMarker)
			this.resizeMap()
		},
		loadImages() {
			// this is needed when switching between vector and raster tile servers, the image is sometimes not removed
			for (const imgKey in mapImages) {
				if (this.map.hasImage(imgKey)) {
					this.map.removeImage(imgKey)
				}
			}
			for (const imgKey in mapVectorImages) {
				if (this.map.hasImage(imgKey)) {
					this.map.removeImage(imgKey)
				}
			}
			const loadImagePromises = Object.keys(mapImages).map((k) => {
				return this.loadImage(k)
			})
			loadImagePromises.push(...Object.keys(mapVectorImages).map((k) => {
				return this.loadVectorImage(k)
			}))
			Promise.allSettled(loadImagePromises)
				.then((promises) => {
					// tracks are waiting for that to load
					this.mapLoaded = true
					promises.forEach(p => {
						if (p.status === 'rejected') {
							console.error(p.reason?.message)
						}
					})
				})
		},
		loadImage(imgKey) {
			return new Promise((resolve, reject) => {
				this.map.loadImage(
					imagePath('gpxpod', mapImages[imgKey]),
					(error, image) => {
						if (error) {
							console.error(error)
						} else {
							try {
								this.map.addImage(imgKey, image)
							} catch (e) {
							}
						}
						resolve()
					}
				)
			})
		},
		loadVectorImage(imgKey) {
			return new Promise((resolve, reject) => {
				const svgIcon = new Image(41, 41)
				svgIcon.onload = () => {
					this.map.addImage(imgKey, svgIcon)
					resolve()
				}
				svgIcon.onerror = () => {
					reject(new Error('Failed to load ' + imgKey))
				}
				svgIcon.src = imagePath('gpxpod', mapVectorImages[imgKey])
			})
		},
		reRenderLayersAndTerrain() {
			// re render the layers
			this.mapLoaded = false
			setTimeout(() => {
				this.$nextTick(() => {
					this.loadImages()
				})
			}, 500)

			setTimeout(() => {
				this.$nextTick(() => {
					this.addTerrainSource()
					if (this.settings.use_terrain === '1') {
						this.terrainControl._toggleTerrain()
					}
				})
			}, 500)
		},
		addTerrainSource() {
			const apiKey = this.settings.maptiler_api_key
			if (this.map.getSource('terrain')) {
				this.map.removeSource('terrain')
			}
			this.map.addSource('terrain', {
				type: 'raster-dem',
				url: 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=' + apiKey,
			})
		},
		onTerrainControlClick() {
			const enabled = this.terrainControl._terrainButton.classList.contains('maplibregl-ctrl-terrain-enabled')
			this.$emit('save-options', { use_terrain: enabled ? '1' : '0' })
		},
		handleMapEvents() {
			this.map.on('moveend', () => {
				const { lng, lat } = this.map.getCenter()
				this.$emit('map-state-change', {
					centerLng: lng,
					centerLat: lat,
					zoom: this.map.getZoom(),
					pitch: this.map.getPitch(),
					bearing: this.map.getBearing(),
				})
				const bounds = this.map.getBounds()
				this.$emit('map-bounds-change', {
					north: bounds.getNorth(),
					east: bounds.getEast(),
					south: bounds.getSouth(),
					west: bounds.getWest(),
				})
			})
		},
		// it might be a bug in maplibre: when navigation sidebar is toggled, the map fails to resize
		// and an empty area appears on the right
		// this fixes it
		resizeMap() {
			setTimeout(() => {
				this.$nextTick(() => {
					this.map.resize()
					window.dispatchEvent(new Event('resize'))
				})
			}, 300)
		},
		onNavToggled() {
			this.resizeMap()
			this.clearChartPopups({ keepPersistent: false })
		},
		onZoomOnBounds(nsew) {
			if (this.map) {
				this.map.fitBounds([[nsew.west, nsew.north], [nsew.east, nsew.south]], {
					padding: 50,
					maxZoom: 18,
				})
			}
		},
		onChartPointHover({ point, persist }) {
			// center on hovered point
			if (this.settings.follow_chart_hover === '1') {
				this.map.setCenter([point[0], point[1]])
				// flyTo movement is still ongoing when showing non-persistent popups so they disapear...
				// this.map.flyTo({ center: [lng, lat] })
			}

			// if this is a hover (and not a click) and we don't wanna show popups: show a marker
			if (!persist && this.settings.chart_hover_show_detailed_popup !== '1') {
				this.positionMarkerLngLat = [point[0], point[1]]
			} else {
				this.addPopup(point, persist)
			}
		},
		addPopup(point, persist) {
			if (this.nonPersistentPopup) {
				this.nonPersistentPopup.remove()
			}
			const containerClass = persist ? 'class="with-button"' : ''
			const extraPointInfo = point[point.length - 1]
			const dataHtml = (point[3] === null && point[2] === null)
				? t('gpxpod', 'No data')
				: (point[3] !== null ? ('<strong>' + t('gpxpod', 'Date') + '</strong>: ' + moment.unix(point[3]).format('YYYY-MM-DD HH:mm:ss (Z)') + '<br>') : '')
				+ (point[2] !== null ? ('<strong>' + t('gpxpod', 'Altitude') + '</strong>: ' + metersToElevation(point[2], this.settings.distance_unit) + '<br>') : '')
				+ (extraPointInfo.speed ? ('<strong>' + t('gpxpod', 'Speed') + '</strong>: ' + kmphToSpeed(extraPointInfo.speed, this.settings.distance_unit) + '<br>') : '')
				+ (extraPointInfo.pace ? ('<strong>' + t('gpxpod', 'Pace') + '</strong>: ' + minPerKmToPace(extraPointInfo.pace, this.settings.distance_unit) + '<br>') : '')
				+ (extraPointInfo.extension
					? ('<strong>' + formatExtensionKey(extraPointInfo.extension.key) + '</strong>: '
						+ formatExtensionValue(extraPointInfo.extension.key, extraPointInfo.extension.value, this.settings.distance_unit))
					: '')
			const html = '<div ' + containerClass + ' style="border-color: ' + extraPointInfo.color + ';">'
				+ dataHtml
				+ '</div>'
			const popup = new Popup({
				closeButton: persist,
				closeOnClick: !persist,
				closeOnMove: !persist,
			})
				.setLngLat([point[0], point[1]])
				.setHTML(html)
				.addTo(this.map)
			if (persist) {
				this.persistentPopups.push(popup)
			} else {
				this.nonPersistentPopup = popup
			}
		},
		clearChartPopups({ keepPersistent }) {
			if (this.nonPersistentPopup) {
				this.nonPersistentPopup.remove()
			}
			if (!keepPersistent) {
				this.persistentPopups.forEach(p => {
					p.remove()
				})
				this.persistentPopups = []
			}
			this.positionMarkerEnabled = false
			this.positionMarkerLngLat = null
		},
		showPositionMarker() {
			this.positionMarkerEnabled = true
		},
	},
}
</script>

<style scoped lang="scss">
@import '~maplibre-gl/dist/maplibre-gl.css';

.map-wrapper {
	position: relative;
	width: 100%;
	height: 100%;
	//height: calc(100vh - 77px); /* calculate height of the screen minus the heading */

	#gpxpod-map {
		width: 100%;
		height: 100%;
	}

	.watermark {
		position: absolute;
		left: 10px;
		bottom: 18px;
		z-index: 999;
	}
}
</style>
