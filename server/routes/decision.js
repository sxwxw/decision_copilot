import { Router } from 'express'
import decisionRoutes from './decisionRoutes.js'
import pipelineRoutes from './pipeline.js'

const router = Router()

// Mount standalone decision routes (/validate, /model, /simulate, /deep-path, /refine, /devil)
router.use(decisionRoutes)

// Mount pipeline routes (/framework, /build-model, /full-pipeline, /pipeline/:id, /pipeline/:id/resume, /correct-model)
router.use(pipelineRoutes)

export default router
