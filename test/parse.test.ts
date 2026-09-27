// Behavior tests, moved from arrgh's plugin-host/src/behavior.new-plugins.test.ts
// (ADR 0031 / 0034) when this plugin split into its own repo (spec 031 phase C).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as wuxiaworld from '../src/wuxiaworld'

function mockFetch(responses: Record<string, { ok?: boolean; text?: string; json?: unknown }>) {
  return vi.fn().mockImplementation((url: string) => {
    const key = Object.keys(responses).find((k) => url.toString().includes(k))
    const resp = key ? responses[key] : { ok: false, text: '', json: {} }
    return Promise.resolve({
      ok: resp.ok ?? true,
      text: async () => resp.text ?? '',
      json: async () => resp.json ?? {},
    })
  })
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

// ═══════════════════════════════════════════════════════════════════════════════
// WuxiaWorld
// ═══════════════════════════════════════════════════════════════════════════════

const WUXIA_SEARCH_JSON = {
  items: [
    {
      id: 12,
      slug: 'swallowed-star',
      name: 'Swallowed Star',
      coverUrl: 'https://cdn.wuxiaworld.com/covers/swallowed-star.jpg',
      status: 0,
      authorName: 'I Eat Tomatoes',
      tags: ['Chinese', 'Completed'],
      genres: ['Sci-fi', 'Action'],
    },
    {
      id: 34,
      slug: 'martial-world',
      name: 'Martial World',
      coverUrl: 'https://cdn.wuxiaworld.com/covers/martial-world.jpg',
      status: 0,
      authorName: 'Cocooned Cow',
      tags: ['Chinese', 'Completed'],
      genres: ['Martial Arts'],
    },
  ],
}


const WUXIA_CHAPTER_HTML = `
<div class="chapter-content">
  <p>Luo Feng, a young man living in Jiangnan base city…</p>
  <p>He had awakened as a genetic warrior, able to breathe underwater.</p>
</div>
`

// A chapter-page fallback URL (chapters 2+, GH #173) can serve a client-side-rendered-only
// shell — the container div exists server-side but never gets populated without JS.
const WUXIA_CHAPTER_CSR_HTML = `
<div class="chapter-content"></div>
`

describe('wuxiaworld — search', () => {
  it('returns array with required fields', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { json: WUXIA_SEARCH_JSON } }))
    const results = await wuxiaworld.search('swallowed star')
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('title')
      expect(r).toHaveProperty('cover_url')
      expect(r).toHaveProperty('status')
      expect(r).toHaveProperty('content_type')
      expect(r.content_type).toBe('novel')
    }
  })

  it('maps API response fields', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { json: WUXIA_SEARCH_JSON } }))
    const [first] = await wuxiaworld.search('swallowed star')
    expect(first.id).toBe('swallowed-star')
    expect(first.title).toBe('Swallowed Star')
    expect(first.cover_url).toBe('https://cdn.wuxiaworld.com/covers/swallowed-star.jpg')
    expect(first.status.toLowerCase()).toBe('completed')
    expect(first.author).toBe('I Eat Tomatoes')
  })

  it('returns empty array when items is empty', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { json: { items: [], total: 0 } } }))
    const results = await wuxiaworld.search('xyzzy')
    expect(results).toEqual([])
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { ok: false } }))
    await expect(wuxiaworld.search('test')).rejects.toThrow()
  })
})

// Live 2026-09-26 (GH #173): chapters 2+ were guessed as "{novel}/chapter/{N}", which
// WuxiaWorld serves as an empty client-rendered shell — only chapter 1 ever downloaded.
// Real slugs come from the site's own gRPC-web API (Chapters/GetChapterList).
const WUXIA_NOVEL_PAGE_HTML = "<html><body><script>\nwindow.__REACT_QUERY_STATE__ = {\"queries\": [{\"queryKey\": [\"novel\", \"i-shall-seal-the-heavens\", null], \"state\": {\"data\": {\"item\": {\"id\": 12, \"name\": \"I Shall Seal the Heavens\", \"slug\": \"i-shall-seal-the-heavens\", \"chapterInfo\": {\"chapterCount\": {\"value\": 1620}, \"firstChapter\": {\"slug\": \"issth-book-1-chapter-1\", \"name\": \"Chapter 1: Scholar Meng Hao\"}}}}}}]};\n</script></body></html>"
// GetChapterList response for ISSTH group 357 ("Other Tales", 3 chapters), base64.
const WUXIA_CHAPTER_LIST_B64 = "AAAAAzYK+QII2QISGkJvb2sgMTogUGF0cmlhcmNoIFJlbGlhbmNlGAEiAggBKgcIARWcyZo7MmgIviQSG0NoYXB0ZXIgMTogU2Nob2xhciBNZW5nIEhhbxoWaXNzdGgtYm9vay0xLWNoYXB0ZXItMSIHCAEVQEIPADAMOAFKBgjA7OaqBVgBagQKAggjegCIAQGSAQYI2ezmqgWiAQIIATJpCL8kEhxDaGFwdGVyIDI6IFRoZSBSZWxpYW5jZSBTZWN0GhZpc3N0aC1ib29rLTEtY2hhcHRlci0yIgcIARWAhB4AMAw4AUoGCJmj56oFWAFqBAoCCCF6AIgBApIBBgiZo+eqBaIBAggBMm4I8CQSIENoYXB0ZXIgNTE6IE15IFRyZWFzdXJlIE1vdW50YWluGhdpc3N0aC1ib29rLTEtY2hhcHRlci01MSIHCAEVwDIKAzAMOAFKBgiGiOesBVgBagYKAggjEAF6AIgBM5IBBgiGiOesBaIBADoECF8YXxK3AwgMEhhJIFNoYWxsIFNlYWwgdGhlIEhlYXZlbnMaYApeaHR0cHM6Ly9jZG4ud3V4aWF3b3JsZC5jb20vaW1hZ2VzL2NvdmVycy9pc3N0aC53ZWJwP3Y9MWIzZDhlMDE5ODJlNjRiMjIzODE1NmY4MzU1MWYyMmU1NDBmZTI0YSIYaS1zaGFsbC1zZWFsLXRoZS1oZWF2ZW5zKgIIATqdAQqaAQokM2MxNGVkMWYtYmJmNC00YmI0LWJkYmEtODA5Y2UxM2Y2OThjEgpEZWF0aGJsYWRlGl4KXGh0dHBzOi8vY2RuLnd1eGlhd29ybGQuY29tL2F2YXRhcnMvRGVhdGhibGFkZS5qcGc/dj00ODdhZDEwNTE0YzQ5ZDkyNjcwNWRiMDNlN2EzYWE1ZmQyMzUxMjA5IgYIwbO8pwVKHgocVDlCV29KTktJQj93allJVEwkdDVOR0k5dDd4YlpZCAwSGQgtEAwYATIRCgQI8IYFEgcIARWA8PoCIAIqBW5vdmVsOhkILRAMGAEyEQoECPCGBRIHCAEVgPD6AiACOgsI8gQQDBgBOgIKADoLCKUBEAwYASoCCgCAAAAAJmNvbnRlbnQtdmVyc2lvbjogZGV2DQpncnBjLXN0YXR1czogMA0K"

function wuxiaFetch(pageHtml: string, listB64: string) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('GetChapterList')) {
      const bytes = Buffer.from(listB64, 'base64')
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), init })
    }
    return Promise.resolve({ ok: true, status: 200, text: async () => pageHtml })
  })
}

describe('wuxiaworld — chapters', () => {
  it('lists chapters with their real slugs from the chapter-list API', async () => {
    vi.stubGlobal('fetch', wuxiaFetch(WUXIA_NOVEL_PAGE_HTML, WUXIA_CHAPTER_LIST_B64))
    const chapters = await wuxiaworld.chapters('i-shall-seal-the-heavens')
    expect(chapters).toEqual([
      { source_id: 'i-shall-seal-the-heavens/issth-book-1-chapter-1', number: 1, volume: 1, title: 'Chapter 1: Scholar Meng Hao' },
      { source_id: 'i-shall-seal-the-heavens/issth-book-1-chapter-2', number: 2, volume: 1, title: 'Chapter 2: The Reliance Sect' },
    ])
  })

  // Only a teaser of Karma-locked chapters is served without an account — listing
  // them would download a truncated preview as if it were the whole chapter.
  it('leaves out Karma-locked chapters', async () => {
    vi.stubGlobal('fetch', wuxiaFetch(WUXIA_NOVEL_PAGE_HTML, WUXIA_CHAPTER_LIST_B64))
    const chapters = await wuxiaworld.chapters('i-shall-seal-the-heavens')
    expect(chapters.map((c) => c.number)).not.toContain(51)
  })

  it('asks the API for the whole novel by its id (grpc-web frame: novelId=12)', async () => {
    const f = wuxiaFetch(WUXIA_NOVEL_PAGE_HTML, WUXIA_CHAPTER_LIST_B64)
    vi.stubGlobal('fetch', f)
    await wuxiaworld.chapters('i-shall-seal-the-heavens')
    const [url, init] = f.mock.calls.find(([u]) => String(u).includes('GetChapterList'))!
    expect(url).toBe('https://api2.wuxiaworld.com/wuxiaworld.api.v2.Chapters/GetChapterList')
    expect((init as RequestInit).method).toBe('POST')
    expect(Array.from((init as RequestInit).body as Uint8Array)).toEqual([0, 0, 0, 0, 2, 0x08, 12])
  })

  it('returns empty array when the page has no novel data', async () => {
    const emptyHtml = `<html><body><script>window.__REACT_QUERY_STATE__ = {"queries":[]};</script></body></html>`
    vi.stubGlobal('fetch', wuxiaFetch(emptyHtml, WUXIA_CHAPTER_LIST_B64))
    expect(await wuxiaworld.chapters('i-shall-seal-the-heavens')).toEqual([])
  })

  it('throws when the chapter-list API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
      Promise.resolve(String(url).includes('GetChapterList')
        ? { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) }
        : { ok: true, status: 200, text: async () => WUXIA_NOVEL_PAGE_HTML })))
    await expect(wuxiaworld.chapters('i-shall-seal-the-heavens')).rejects.toThrow(/503/)
  })
})

// Live 2026-09-26: a Karma-locked chapter page — the content div holds a teaser
// (ends in "..."), the embedded state says isTeaser: true.
const WUXIA_CHAPTER_TEASER_HTML = "<html><body><div class=\"chapter-content\"><p><strong><span>Chapter 698: Deranged</span></strong></p><p><span>In the Southern Domain’s Black Sieve Sect, Meng Hao was surrounded by a bright red glow. The crowds of Cultivators from the Black Sieve Sect were sending all sorts of divine abilities and magical techniques against him, as well as magical items. Even with his incredible fleshly body, it was something he couldn’t stand up against for long.</span></p><p><span>“Explode!”...</span></p></div><script>\nwindow.__REACT_QUERY_STATE__ = {\"queries\": [{\"queryKey\": [\"chapter\", \"i-shall-seal-the-heavens\", \"issth-book-5-chapter-698\", null], \"state\": {\"data\": {\"item\": {\"slug\": \"issth-book-5-chapter-698\", \"name\": \"Chapter 698: Deranged\", \"isTeaser\": true, \"karmaInfo\": {\"isKarmaRequired\": true, \"karmaPrice\": {\"value\": 32}}}}}}]};\n</script></body></html>"

describe('wuxiaworld — chapterText', () => {
  it('throws on a teaser (Karma-locked) chapter instead of returning the preview', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { text: WUXIA_CHAPTER_TEASER_HTML } }))
    await expect(wuxiaworld.chapterText('i-shall-seal-the-heavens/issth-book-5-chapter-698')).rejects.toThrow(/locked|teaser/i)
  })

  it('returns string content', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { text: WUXIA_CHAPTER_HTML } }))
    const text = await wuxiaworld.chapterText('swallowed-star/swallowed-star-chapter-1')
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('extracts chapter text content', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { text: WUXIA_CHAPTER_HTML } }))
    const text = await wuxiaworld.chapterText('swallowed-star/swallowed-star-chapter-1')
    expect(text).toContain('Luo Feng')
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { ok: false } }))
    await expect(wuxiaworld.chapterText('test/test-chapter-1')).rejects.toThrow()
  })

  it('throws on empty/near-empty content (CSR-fallback page)', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'wuxiaworld': { text: WUXIA_CHAPTER_CSR_HTML } }))
    await expect(wuxiaworld.chapterText('swallowed-star/chapter/2')).rejects.toThrow()
  })
})

