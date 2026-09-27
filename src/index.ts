import type { PluginInfo } from 'arrgh-plugin-sdk'
import { version } from '../package.json'
import * as w from './wuxiaworld'

export const info: PluginInfo = {
  id: 'wuxiaworld',
  name: 'WuxiaWorld',
  version,
  default_explicit: false,
  content_types: ['novel'],
}

export function init(_ctx: unknown): void {
  // Direct fetch — no browser needed
}

export const search      = w.search
export const chapters    = w.chapters
export const chapterText = w.chapterText
