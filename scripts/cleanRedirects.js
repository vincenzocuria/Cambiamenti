import { unlinkSync, existsSync } from 'node:fs'

const path = 'dist/_redirects'
if (existsSync(path)) unlinkSync(path)
