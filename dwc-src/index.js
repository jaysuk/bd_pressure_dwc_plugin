'use strict'

import { registerRoute } from '@/routes'
import PaCalibration from './PaCalibration.vue'

registerRoute(PaCalibration, {
	Plugins: {
		BdPressurePA: {
			icon: 'mdi-chart-line',
			caption: 'PA Calibration',
			translated: true,
			path: '/Plugins/BdPressurePA'
		}
	}
})
