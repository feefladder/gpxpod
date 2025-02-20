<template>
	<NcAppNavigationItem
		:name="decodedTrackName"
		:title="track.trackpath"
		:class="{ trackItem: true, selectedTrack: track.isEnabled }"
		:loading="track.loading"
		:editable="false"
		:force-menu="true"
		:force-display-actions="true"
		:menu-open="menuOpen"
		@update:menuOpen="onUpdateMenuOpen"
		@mouseenter.native="onHoverIn"
		@mouseleave.native="onHoverOut"
		@contextmenu.native.stop.prevent="menuOpen = true"
		@click="onClick">
		<div v-if="track.isEnabled"
			slot="icon"
			class="trackItemDot">
			<NcColorPicker
				class="app-navigation-entry-bullet-wrapper trackColorPicker"
				:value="track.color"
				@input="updateColor">
				<ColoredDot
					ref="colorDot"
					class="color-dot"
					:color="dotColor"
					:size="24" />
			</NcColorPicker>
		</div>
		<!-- weird behaviour when using <template #actions> -->
		<template slot="actions">
			<template v-if="!criteriaActionsOpen">
				<NcActionButton
					:close-after-click="true"
					@click="onDetailsClick">
					<template #icon>
						<InformationOutlineIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Details') }}
				</NcActionButton>
				<NcActionButton v-if="!isPublicPage"
					:close-after-click="true"
					@click="onShareClick">
					<template #icon>
						<ShareVariantIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Share') }}
				</NcActionButton>
				<NcActionButton
					:close-after-click="true"
					@click="onZoomClick">
					<template #icon>
						<MagnifyExpandIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Zoom to bounds') }}
				</NcActionButton>
				<NcActionLink
					:close-after-click="true"
					:href="downloadLink"
					target="_blank">
					<template #icon>
						<DownloadIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Download') }}
				</NcActionLink>
				<NcActionButton
					:close-after-click="true"
					@click="onMenuColorClick">
					<template #icon>
						<PaletteIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Change color') }}
				</NcActionButton>
				<NcActionButton
					:close-after-click="false"
					@click="criteriaActionsOpen = true">
					<template #icon>
						<BrushIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Change color criteria') }}
				</NcActionButton>
				<NcActionButton v-if="!isPublicPage"
					:close-after-click="true"
					@click="onCorrectElevationClick">
					<template #icon>
						<ChartAreasplineVariantIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Correct elevations') }}
				</NcActionButton>
				<NcActionButton v-if="!isPublicPage"
					:close-after-click="true"
					@click="onDeleteTrackClick">
					<template #icon>
						<DeleteIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Delete this file') }}
				</NcActionButton>
			</template>
			<template v-else>
				<NcActionButton :close-after-click="false"
					@click="criteriaActionsOpen = false">
					<template #icon>
						<ChevronLeftIcon :size="20" />
					</template>
					{{ t('gpxpod', 'Back') }}
				</NcActionButton>
				<NcActionRadio v-for="(c, ckey) in COLOR_CRITERIAS"
					:key="ckey"
					name="criteria"
					:checked="track.colorExtensionCriteria === '' && track.colorCriteria === c.id"
					@change="onCriteriaChange(c.id)">
					{{ c.label }}
				</NcActionRadio>
				<NcActionRadio v-for="ext in track.extensions?.trackpoint"
					:key="'extension-trackpoint-' + ext"
					name="criteria"
					:checked="track.colorExtensionCriteriaType === 'trackpoint' && track.colorExtensionCriteria === ext"
					@change="onColorExtensionCriteriaChange(ext, 'trackpoint')">
					{{ getExtensionLabel(ext) }}
				</NcActionRadio>
				<NcActionRadio v-for="ext in track.extensions?.unsupported"
					:key="'extension-unsupported-' + ext"
					name="criteria"
					:checked="track.colorExtensionCriteriaType === 'unsupported' && track.colorExtensionCriteria === ext"
					@change="onColorExtensionCriteriaChange(ext, 'unsupported')">
					{{ getExtensionLabel(ext) }}
				</NcActionRadio>
			</template>
		</template>
	</NcAppNavigationItem>
</template>

<script>
import DownloadIcon from 'vue-material-design-icons/Download.vue'
import MagnifyExpandIcon from 'vue-material-design-icons/MagnifyExpand.vue'
import InformationOutlineIcon from 'vue-material-design-icons/InformationOutline.vue'
import ShareVariantIcon from 'vue-material-design-icons/ShareVariant.vue'
import PaletteIcon from 'vue-material-design-icons/Palette.vue'
import BrushIcon from 'vue-material-design-icons/Brush.vue'
import DeleteIcon from 'vue-material-design-icons/Delete.vue'
import ChevronLeftIcon from 'vue-material-design-icons/ChevronLeft.vue'
import ChartAreasplineVariantIcon from 'vue-material-design-icons/ChartAreasplineVariant.vue'

import NcActionLink from '@nextcloud/vue/dist/Components/NcActionLink.js'
import NcActionRadio from '@nextcloud/vue/dist/Components/NcActionRadio.js'
import NcActionButton from '@nextcloud/vue/dist/Components/NcActionButton.js'
import NcAppNavigationItem from '@nextcloud/vue/dist/Components/NcAppNavigationItem.js'
import NcColorPicker from '@nextcloud/vue/dist/Components/NcColorPicker.js'
import ColoredDot from './ColoredDot.vue'

import { emit } from '@nextcloud/event-bus'
import ClickOutside from 'vue-click-outside'

import { COLOR_CRITERIAS } from '../constants.js'
import TrackItem from '../mixins/TrackItem.js'

export default {
	name: 'NavigationTrackItem',
	components: {
		ColoredDot,
		NcAppNavigationItem,
		NcActionButton,
		NcActionRadio,
		NcActionLink,
		NcColorPicker,
		PaletteIcon,
		DeleteIcon,
		ShareVariantIcon,
		InformationOutlineIcon,
		ChevronLeftIcon,
		BrushIcon,
		MagnifyExpandIcon,
		DownloadIcon,
		ChartAreasplineVariantIcon,
	},

	directives: {
		ClickOutside,
	},

	mixins: [
		TrackItem,
	],

	inject: ['isPublicPage'],

	props: {
		track: {
			type: Object,
			required: true,
		},
	},

	data() {
		return {
			menuOpen: false,
			criteriaActionsOpen: false,
			COLOR_CRITERIAS,
		}
	},

	computed: {
		// to make sure it works with tracks created before the vue rewrite (url-encoded values in the marker)
		decodedTrackName() {
			return decodeURIComponent(this.track.name)
		},
		decodedFolder() {
			return decodeURIComponent(this.track.folder)
		},
	},

	methods: {
		onClick(e) {
			if (e.target.tagName !== 'DIV') {
				emit('track-clicked', { trackId: this.track.id, dirId: this.track.directoryId })
			}
		},
		onDeleteTrackClick() {
			emit('delete-track', this.track)
		},
		onUpdateMenuOpen(isOpen) {
			if (!isOpen) {
				this.criteriaActionsOpen = false
			}
			this.menuOpen = isOpen
		},
	},

}
</script>

<style scoped lang="scss">
:deep(.app-navigation-entry-link) {
	padding: 0 !important;
}

:deep(.app-navigation-entry-icon) {
	flex: 0 0 38px !important;
	width: 38px !important;
}
</style>
