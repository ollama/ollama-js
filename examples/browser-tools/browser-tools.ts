import ollama, { Ollama } from 'ollama'
import type { Message } from 'ollama'
import type {
  SearchRequest,
  SearchResponse,
  CrawlRequest,
  CrawlResponse,
  CrawlMetadata,
  CrawlResult,
  CrawlExtras,
  CrawlLink,
} from 'ollama'


// Local types used only by this example
interface Page {
  url: string
  title: string
  text: string
  lines: string[]
  links: Record<number, string>
  fetchedAt: Date
}

interface BrowserStateData {
  pageStack: string[]
  viewTokens: number
  urlToPage: Record<string, Page>
}

interface WebSearchResult {
  title: string
  url: string
  content: {
    fullText: string
  }
}

// Browser tool implementation 

// Default number of tokens to show when calling displayPage
const DEFAULT_VIEW_TOKENS = 1024

// Capped tool content length 
const CAPPED_TOOL_CONTENT_LEN = 500

function capToolContent(text: string): string {
  if (!text) {
    return text
  }
  if (text.length <= CAPPED_TOOL_CONTENT_LEN) {
    return text
  }
  if (CAPPED_TOOL_CONTENT_LEN <= 1) {
    return text.substring(0, CAPPED_TOOL_CONTENT_LEN)
  }
  return text.substring(0, CAPPED_TOOL_CONTENT_LEN - 1) + '…'
}


/**
 * The Browser tool provides web browsing capability.
 * The model uses the tool by usually doing a search first and then choosing to either open a page,
 * find a term in a page, or do another search.
 *
 * The tool optionally may open a URL directly - especially if one is passed in.
 *
 * Each action is saved into an append-only page stack to keep track of the history of the browsing session.
 * Each Execute() for a tool returns the full current state of the browser.
 *
 * A new Browser object is created per request - the state is managed within the class.
 */

/**
 * BrowserState manages the browsing session state
 */
export class BrowserState {
  private data: BrowserStateData

  constructor(initialState?: BrowserStateData) {
    this.data = initialState || {
      pageStack: [],
      viewTokens: DEFAULT_VIEW_TOKENS,
      urlToPage: {},
    }
  }

  getData(): BrowserStateData {
    return this.data
  }

  setData(data: BrowserStateData): void {
    this.data = data
  }
}

/**
 * Base Browser class with shared functionality
 */
export class Browser {
  public state: BrowserState

  constructor(initialState?: BrowserStateData) {
    this.state = new BrowserState(initialState)
  }

  getState(): BrowserStateData {
    return this.state.getData()
  }

  protected savePage(page: Page): void {
    const data = this.state.getData()
    data.urlToPage[page.url] = page
    data.pageStack.push(page.url)
    this.state.setData(data)
  }

  protected getPageFromStack(url: string): Page {
    const data = this.state.getData()
    const page = data.urlToPage[url]
    if (!page) {
      throw new Error(`Page not found for url ${url}`)
    }
    return page
  }

  /**
   * Calculates the end location for viewport based on token limits
   */
  protected getEndLoc(loc: number, numLines: number, totalLines: number, lines: string[]): number {
    if (numLines <= 0) {
      // Auto-calculate based on viewTokens
      const txt = this.joinLinesWithNumbers(lines.slice(loc))
      const data = this.state.getData()

      // If text is very short, no need to truncate (at least 1 char per token)
      if (txt.length > data.viewTokens) {
        // Simple heuristic: approximate token counting
        // Typical token is ~4 characters, but can be up to 128 chars
        const maxCharsPerToken = 128

        // upper bound for text to analyze
        const upperBound = Math.min((data.viewTokens + 1) * maxCharsPerToken, txt.length)
        const textToAnalyze = txt.substring(0, upperBound)

        // Simple approximation: count tokens as ~4 chars each
        // This is less accurate than tiktoken but more performant
        const approxTokens = textToAnalyze.length / 4

        if (approxTokens > data.viewTokens) {
          // Find the character position at viewTokens
          const endIdx = Math.min(data.viewTokens * 4, txt.length)

          // Count newlines up to that position to get line count
          numLines = (txt.substring(0, endIdx).match(/\n/g) || []).length + 1
        } else {
          numLines = totalLines
        }
      } else {
        numLines = totalLines
      }
    }

    return Math.min(loc + numLines, totalLines)
  }

  /**
   * Creates a string with line numbers, matching Python's join_lines
   */
  protected joinLinesWithNumbers(lines: string[]): string {
    let result = ''
    let hadZeroLine = false
    
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        result += 'L0:\n'
        hadZeroLine = true
      }
      if (hadZeroLine) {
        result += `L${i + 1}: ${lines[i]}\n`
      } else {
        result += `L${i}: ${lines[i]}\n`
      }
    }
    
    return result
  }

  /**
   * Processes markdown links and replaces them with the special format
   * Returns the processed text and a map of link IDs to URLs
   */
  protected processMarkdownLinks(text: string): { processedText: string; links: Record<number, string> } {
    const links: Record<number, string> = {}
    let linkID = 0

    // First, handle multi-line markdown links by joining them
    const multiLinePattern = /\[([^\]]+)\]\s*\n\s*\(([^)]+)\)/g
    text = text.replace(multiLinePattern, (match) => {
      // Replace newlines with spaces in the match
      let cleaned = match.replace(/\n/g, ' ')
      // Remove extra spaces
      cleaned = cleaned.replace(/\s+/g, ' ')
      return cleaned
    })

    // Now process all markdown links (including the cleaned multi-line ones)
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

    const processedText = text.replace(linkPattern, (match, linkText, linkURL) => {
      const cleanLinkText = linkText.trim()
      const cleanLinkURL = linkURL.trim()

      // Extract domain from URL
      let domain = cleanLinkURL
      try {
        const url = new URL(cleanLinkURL)
        if (url.host) {
          domain = url.host
          // Remove www. prefix if present
          domain = domain.replace(/^www\./, '')
        }
      } catch {
        // If URL parsing fails, use the original URL
      }

      // Create the formatted link
      const formatted = `【${linkID}†${cleanLinkText}†${domain}】`

      // Store the link
      links[linkID] = cleanLinkURL
      linkID++

      return formatted
    })

    return { processedText, links }
  }

  /**
   * Wraps text lines to a specified width
   */
  protected wrapLines(text: string, width = 80): string[] {
    if (width <= 0) {
      width = 80
    }

    const lines = text.split('\n')
    const wrapped: string[] = []

    for (const line of lines) {
      if (line === '') {
        // Preserve empty lines
        wrapped.push('')
      } else if (line.length <= width) {
        wrapped.push(line)
      } else {
        // Word wrapping while preserving whitespace structure
        const words = line.split(/\s+/)
        if (words.length === 0) {
          // Line with only whitespace
          wrapped.push(line)
          continue
        }

        let currentLine = ''
        for (const word of words) {
          // Check if adding this word would exceed width
          let testLine = currentLine
          if (testLine !== '') {
            testLine += ' '
          }
          testLine += word

          if (testLine.length > width && currentLine !== '') {
            // Current line would be too long, wrap it
            wrapped.push(currentLine)
            currentLine = word
          } else {
            // Add word to current line
            if (currentLine !== '') {
              currentLine += ' '
            }
            currentLine += word
          }
        }

        // Add any remaining content
        if (currentLine !== '') {
          wrapped.push(currentLine)
        }
      }
    }

    return wrapped
  }

  /**
   * Formats and returns the page display for the model
   */
  protected displayPage(page: Page, cursor: number, loc: number, numLines: number): string {
    let totalLines = page.lines.length

    // Ensure there is at least one line to display
    if (totalLines === 0) {
      page.lines = ['']
      totalLines = 1
    }

    // Clamp loc into a valid range instead of throwing
    if (Number.isNaN(loc) || loc < 0) {
      loc = 0
    } else if (loc >= totalLines) {
      loc = Math.max(0, totalLines - 1)
    }

    // get viewport end location
    const endLoc = this.getEndLoc(loc, numLines, totalLines, page.lines)

    let display = `[${cursor}] ${page.title}`
    if (page.url) {
      display += `(${page.url})\n`
    } else {
      display += '\n'
    }
    display += `**viewing lines [${loc} - ${endLoc - 1}] of ${totalLines - 1}**\n\n`

    // Content with line numbers
    let hadZeroLine = false
    for (let i = loc; i < endLoc; i++) {
      if (i === 0) {
        display += 'L0:\n'
        hadZeroLine = true
      }
      if (hadZeroLine) {
        display += `L${i + 1}: ${page.lines[i]}\n`
      } else {
        display += `L${i}: ${page.lines[i]}\n`
      }
    }

    return display
  }

  /**
   * Builds a search results page that contains all search results
   */
  protected buildSearchResultsPageCollection(query: string, results: SearchResponse): Page {
    const page: Page = {
      url: `search_results_${query}`,
      title: query,
      text: '',
      lines: [],
      links: {},
      fetchedAt: new Date(),
    }

    let textBuilder = ''
    let linkIdx = 0

    // Add the header lines to match format
    textBuilder += '\n'                 // L0: empty
    textBuilder += 'URL: \n'            // L1: URL: (empty for search)
    textBuilder += '# Search Results\n' // L2: # Search Results
    textBuilder += '\n'                 // L3: empty

    for (const queryResults of Object.values(results.results)) {
      for (const result of queryResults) {
        let domain = result.url
        try {
          const url = new URL(result.url)
          if (url.host) {
            domain = url.host
            domain = domain.replace(/^www\./, '')
          }
        } catch {
          // If URL parsing fails, use original URL
        }

        const linkFormat = `* 【${linkIdx}†${result.title}†${domain}】`
        textBuilder += linkFormat

        // Prefer snippet; fallback to truncated full_text
        const rawSnippet = (result.content.snippet && result.content.snippet.trim())
          ? result.content.snippet.trim()
          : (result.content.full_text || '')

        // Truncate and lightly sanitize to avoid garbage blobs in previews
        const capped = rawSnippet.length > 400 ? rawSnippet.substring(0, 400) + '…' : rawSnippet
        const cleaned = capped
          // collapse long digit runs (likely noise)
          .replace(/\d{40,}/g, (m) => m.substring(0, 40) + '…')
          // collapse excessive whitespace
          .replace(/\s{3,}/g, ' ')
        textBuilder += cleaned
        textBuilder += '\n'

        page.links[linkIdx] = result.url
        linkIdx++
      }
    }

    page.text = textBuilder
    page.lines = this.wrapLines(page.text, 80)

    return page
  }

  /**
   * Builds a search results page for individual result
   */
  protected buildSearchResultsPage(result: WebSearchResult, linkIdx: number): Page {
    const page: Page = {
      url: result.url,
      title: result.title,
      text: '',
      lines: [],
      links: {},
      fetchedAt: new Date(),
    }

    let textBuilder = ''

    // Format the individual result page (only used when no full text is available)
    const linkFormat = `【${linkIdx}†${result.title}】`
    textBuilder += linkFormat
    textBuilder += '\n'
    textBuilder += `URL: ${result.url}\n`
    const numChars = Math.min(result.content.fullText.length, 300)
    textBuilder += result.content.fullText.substring(0, numChars)
    textBuilder += '\n\n'

    // Only store link and snippet if we won't be processing full text later
    // (full text processing will handle all links consistently)
    if (!result.content.fullText) {
      page.links[linkIdx] = result.url
    }

    // Use full text if available, otherwise use snippet
    if (result.content.fullText) {
      // Prepend the URL line to the full text
      page.text = `URL: ${result.url}\n${result.content.fullText}`
      // Process markdown links in the full text
      const { processedText, links } = this.processMarkdownLinks(page.text)
      page.text = processedText
      page.links = links
    } else {
      page.text = textBuilder
    }

    page.lines = this.wrapLines(page.text, 80)

    return page
  }

  /**
   * Creates a Page from crawl API results
   */
  protected buildPageFromCrawlResult(requestedURL: string, crawlResponse: CrawlResponse): Page {
    // Initialize page with defaults
    const page: Page = {
      url: requestedURL,
      title: requestedURL,
      text: '',
      lines: [],
      links: {},
      fetchedAt: new Date(),
    }

    // Process crawl results - the API returns results grouped by URL
    for (const [url, urlResults] of Object.entries(crawlResponse.results)) {
      if (urlResults.length > 0) {
        // Get the first result for this URL
        const result = urlResults[0]

        // Extract content
        if (result.content.full_text) {
          page.text = result.content.full_text
        }

        // Extract title if available
        if (result.title) {
          page.title = result.title
        }

        // Update URL to the actual URL from results
        page.url = url

        // Extract links if available from extras
        // Note: requires CrawlExtras/CrawlLink in src/interfaces
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyResult: any = result as any
        if (anyResult.extras?.links) {
          for (let i = 0; i < anyResult.extras.links.length; i++) {
            const link = anyResult.extras.links[i]
            if (link.href) {
              page.links[i] = link.href
            } else if (link.url) {
              page.links[i] = link.url
            }
          }
        }

        // Only process the first URL's results
        break
      }
    }

    // If no text was extracted, set a default message
    if (!page.text) {
      page.text = 'No content could be extracted from this page.'
    } else {
      // Prepend the URL line to match Python implementation
      page.text = `URL: ${page.url}\n${page.text}`
    }

    // Process markdown links in the text
    const { processedText, links } = this.processMarkdownLinks(page.text)
    page.text = processedText
    page.links = links

    // Wrap lines for display
    page.lines = this.wrapLines(page.text, 80)

    return page
  }

  /**
   * Builds a find results page
   */
  protected buildFindResultsPage(pattern: string, page: Page): Page {
    const findPage: Page = {
      url: `find_results_${pattern}`,
      title: `Find results for text: \`${pattern}\` in \`${page.title}\``,
      text: '',
      lines: [],
      links: {},
      fetchedAt: new Date(),
    }

    let textBuilder = ''
    let matchIdx = 0
    const maxResults = 50
    const numShowLines = 4
    const patternLower = pattern.toLowerCase()

    // Search through the page lines following the reference algorithm
    const resultChunks: string[] = []
    let lineIdx = 0

    while (lineIdx < page.lines.length) {
      const line = page.lines[lineIdx]
      const lineLower = line.toLowerCase()

      if (!lineLower.includes(patternLower)) {
        lineIdx++
        continue
      }

      // Build snippet context
      const endLine = Math.min(lineIdx + numShowLines, page.lines.length)

      let snippetBuilder = ''
      for (let j = lineIdx; j < endLine; j++) {
        snippetBuilder += page.lines[j]
        if (j < endLine - 1) {
          snippetBuilder += '\n'
        }
      }
      const snippet = snippetBuilder

      // Format the match
      const linkFormat = `【${matchIdx}†match at L${lineIdx}】`
      const resultChunk = `${linkFormat}\n${snippet}`
      resultChunks.push(resultChunk)

      if (resultChunks.length >= maxResults) {
        break
      }

      matchIdx++
      lineIdx += numShowLines
    }

    // Build final display text
    if (resultChunks.length > 0) {
      textBuilder = resultChunks.join('\n\n')
    }

    if (matchIdx === 0) {
      findPage.text = `No \`find\` results for pattern: \`${pattern}\``
    } else {
      findPage.text = textBuilder
    }

    findPage.lines = this.wrapLines(findPage.text, 80)
    return findPage
  }
}

/**
 * BrowserSearch - Performs web searches and builds search result pages
 */
export class BrowserSearch extends Browser {
  private searchClient: {
    search: (request: SearchRequest) => Promise<SearchResponse>
  }

  constructor(
    initialState?: BrowserStateData,
    searchClient?: { search: (request: SearchRequest) => Promise<SearchResponse> }
  ) {
    super(initialState)
    this.searchClient = searchClient || {
      search: async () => {
        throw new Error('Search client not provided')
      }
    }
  }

  name(): string {
    return 'browser.search'
  }

  description(): string {
    return 'Search the web for information'
  }

  schema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query'
        },
        topn: {
          type: 'number',
          description: 'Number of top results to return (default: 5)'
        }
      },
      required: ['query']
    }
  }

  async execute(args: { query: string; topn?: number }): Promise<{ state: BrowserStateData; pageText: string }> {
    const { query, topn = 5 } = args

    const searchArgs: SearchRequest = {
      queries: [query],
      maxResults: topn,
    }

    const result = await this.searchClient.search(searchArgs)

    // Build main search results page that contains all search results
    const searchResultsPage = this.buildSearchResultsPageCollection(query, result)
    this.savePage(searchResultsPage)
    const cursor = this.getState().pageStack.length - 1

    // Cache result for each page
    for (const queryResults of Object.values(result.results)) {
      for (let i = 0; i < queryResults.length; i++) {
        const searchResult = queryResults[i]
        const webSearchResult: WebSearchResult = {
          title: searchResult.title,
          url: searchResult.url,
          content: {
            fullText: searchResult.content.full_text || ''
          }
        }
        const resultPage = this.buildSearchResultsPage(webSearchResult, i + 1)
        // Save to global only, do not add to visited stack
        const data = this.getState()
        data.urlToPage[resultPage.url] = resultPage
        this.state.setData(data)
      }
    }

    const pageText = this.displayPage(searchResultsPage, cursor, 0, -1)

    return { state: this.getState(), pageText: capToolContent(pageText) }
  }
}

/**
 * BrowserOpen - Opens web pages and displays them
 */
export class BrowserOpen extends Browser {
  private crawlClient: {
    crawl: (request: CrawlRequest) => Promise<CrawlResponse>
  }

  constructor(
    initialState?: BrowserStateData,
    crawlClient?: { crawl: (request: CrawlRequest) => Promise<CrawlResponse> }
  ) {
    super(initialState)
    this.crawlClient = crawlClient || {
      crawl: async () => {
        throw new Error('Crawl client not provided')
      }
    }
  }

  name(): string {
    return 'browser.open'
  }

  description(): string {
    return 'Open a link in the browser'
  }

  schema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        id: {
          oneOf: [
            { type: 'string', description: 'URL to open' },
            { type: 'number', description: 'Link ID from current page' }
          ]
        },
        cursor: {
          type: 'number',
          description: 'Page cursor to use (default: current page)'
        },
        loc: {
          type: 'number',
          description: 'Line location to start viewing from (default: 0)'
        },
        num_lines: {
          type: 'number',
          description: 'Number of lines to display (default: auto based on tokens)'
        }
      }
    }
  }

  async execute(args: {
    id?: string | number;
    cursor?: number;
    loc?: number;
    num_lines?: number;
  }): Promise<{ state: BrowserStateData; pageText: string }> {
    let { cursor = -1 } = args
    const loc = args.loc ?? 0
    const num_lines = args.num_lines ?? -1

    // Get page from cursor
    let page: Page | undefined
    const state = this.getState()
    
    if (cursor >= 0) {
      if (cursor >= state.pageStack.length) {
        // Clamp to last valid page instead of throwing
        cursor = Math.max(0, state.pageStack.length - 1)
      }
      page = this.getPageFromStack(state.pageStack[cursor])
    } else {
      // Get last page
      if (state.pageStack.length !== 0) {
        const pageURL = state.pageStack[state.pageStack.length - 1]
        page = this.getPageFromStack(pageURL)
      }
    }

    // Try to get id as string (URL) first
    if (typeof args.id === 'string') {
      const url = args.id
      
      // Check if we already have this page cached
      if (state.urlToPage[url]) {
        // Use cached page
        this.savePage(state.urlToPage[url])
        // Always update cursor to point to the newly added page
        cursor = this.getState().pageStack.length - 1
        const pageText = this.displayPage(state.urlToPage[url], cursor, loc, num_lines)
        return { state: this.getState(), pageText: capToolContent(pageText) }
      }

      // Page not in cache, need to crawl it
      const crawlResponse = await this.crawlClient.crawl({ urls: [url], latest: false })

      const newPage = this.buildPageFromCrawlResult(url, crawlResponse)

      // Need to fall through if first search is directly an open command - no existing page
      this.savePage(newPage)
      // Always update cursor to point to the newly added page
      cursor = this.getState().pageStack.length - 1
      const pageText = this.displayPage(newPage, cursor, loc, num_lines)
      return { state: this.getState(), pageText: capToolContent(pageText) }
    }

    // Try to get id as integer (link ID from current page)
    if (typeof args.id === 'number') {
      if (!page) {
        throw new Error('No current page to resolve link from')
      }
      
      const idInt = args.id
      const pageURL = page.links[idInt]
      if (!pageURL) {
        // Gracefully handle missing link id by creating an informative page
        const errorPage: Page = {
          url: `invalid_link_${idInt}`,
          title: `No link with id ${idInt} on \`${page.title}\``,
          text: '',
          lines: [],
          links: {},
          fetchedAt: new Date(),
        }

        const availableIds = Object.keys(page.links)
          .map((k) => Number(k))
          .sort((a, b) => a - b)
        const availableList = availableIds.length > 0 ? availableIds.join(', ') : '(none)'

        errorPage.text = [
          `Requested link id: ${idInt}`,
          `Current page: ${page.title}`,
          `Available link ids on this page: ${availableList}`,
          '',
          'Tips:',
          '- To scroll this page, call browser_open with { loc, num_lines } (no id).',
          '- To open a result from a search results page, pass the correct { cursor, id }.',
        ].join('\n')
        errorPage.lines = this.wrapLines(errorPage.text, 80)

        // Add the error page to history so the model can react without crashing
        this.savePage(errorPage)
        cursor = this.getState().pageStack.length - 1
        const pageText = this.displayPage(errorPage, cursor, 0, -1)
        return { state: this.getState(), pageText: capToolContent(pageText) }
      }

      // Check if we have the linked page cached
      let newPage = state.urlToPage[pageURL]
      if (!newPage) {
        const crawlResponse = await this.crawlClient.crawl({ urls: [pageURL], latest: false })

        newPage = this.buildPageFromCrawlResult(pageURL, crawlResponse)
      }

      this.savePage(newPage)

      // Always update cursor to point to the newly added page
      cursor = this.getState().pageStack.length - 1
      const pageText = this.displayPage(newPage, cursor, loc, num_lines)
      return { state: this.getState(), pageText: capToolContent(pageText) }
    }

    if (!page) {
      throw new Error('No current page to display')
    }
    

    const currentState = this.getState()
    currentState.pageStack.push(page.url)
    this.state.setData(currentState)
    cursor = currentState.pageStack.length - 1

    const pageText = this.displayPage(page, cursor, loc, num_lines)
    return { state: this.getState(), pageText: capToolContent(pageText) }
  }
}

/**
 * BrowserFind - Finds text patterns within browser pages
 */
export class BrowserFind extends Browser {
  constructor(initialState?: BrowserStateData) {
    super(initialState)
  }

  name(): string {
    return 'browser.find'
  }

  description(): string {
    return 'Find a term in the browser'
  }

  schema(): Record<string, any> {
    return {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The text pattern to search for'
        },
        cursor: {
          type: 'number',
          description: 'Page cursor to search in (default: current page)'
        }
      },
      required: ['pattern']
    }
  }

  async execute(args: { pattern: string; cursor?: number }): Promise<{ state: BrowserStateData; pageText: string }> {
    const { pattern } = args
    let { cursor = -1 } = args

    // Get the page to search in
    let page: Page
    const state = this.getState()
    
    if (cursor === -1) {
      // Use current page
      if (state.pageStack.length === 0) {
        throw new Error('No pages to search in')
      }
      page = this.getPageFromStack(state.pageStack[state.pageStack.length - 1])
      cursor = state.pageStack.length - 1 // Update cursor for display
    } else {
      // Use specific cursor
      if (cursor < 0 || cursor >= state.pageStack.length) {
        // Clamp to valid range instead of throwing
        cursor = Math.max(0, Math.min(cursor, state.pageStack.length - 1))
      }
      page = this.getPageFromStack(state.pageStack[cursor])
    }

    // Create find results page
    const findPage = this.buildFindResultsPage(pattern, page)

    // Add the find results page to state
    this.savePage(findPage)
    const newCursor = this.getState().pageStack.length - 1

    const pageText = this.displayPage(findPage, newCursor, 0, -1)

    return { state: this.getState(), pageText: capToolContent(pageText) }
  }
}


async function main() {
  if (!process.env.OLLAMA_API_KEY) {
    throw new Error('Set OLLAMA_API_KEY to use browser tools')
  }

  const client = new Ollama({
    headers: process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : undefined,
  })

  const browserSearch = new BrowserSearch(undefined, client)
  const browserOpen = new BrowserOpen(undefined, client)
  const browserFind = new BrowserFind()

  // Tool schemas for the model
  const browserSearchTool = {
    type: 'function',
    function: {
      name: 'browser_search',
      description: 'Search the web for information and display results',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          topn: {
            type: 'number',
            description: 'Number of top results to return (default: 5)',
          },
        },
        required: ['query'],
      },
    },
  }

  const browserOpenTool = {
    type: 'function',
    function: {
      name: 'browser_open',
      description: 'Open a link in the browser or display a page',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: ['string', 'number'],
            description: 'URL to open (string) or Link ID from current page (number)'
          },
          cursor: {
            type: 'number',
            description: 'Page cursor to use (default: current page)'
          },
          loc: {
            type: 'number',
            description: 'Line location to start viewing from (default: 0)'
          },
          num_lines: {
            type: 'number',
            description: 'Number of lines to display (default: auto based on tokens)'
          }
        },
      },
    },
  }

  const browserFindTool = {
    type: 'function',
    function: {
      name: 'browser_find',
      description: 'Find a text pattern within the current browser page',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The text pattern to search for',
          },
          cursor: {
            type: 'number',
            description: 'Page cursor to search in (default: current page)',
          },
        },
        required: ['pattern'],
      },
    },
  }

  // Available tool functions
  const availableTools = {
    browser_search: async (args: { query: string; topn?: number }) => {
      const result = await browserSearch.execute(args)
      
      // Sync state across all browser tools
      browserOpen.state.setData(result.state)
      browserFind.state.setData(result.state)
      return result.pageText
    },
    browser_open: async (args: { id?: string | number; cursor?: number; loc?: number; num_lines?: number }) => {
      const result = await browserOpen.execute(args)
      
      // Sync state across all browser tools
      browserSearch.state.setData(result.state)
      browserFind.state.setData(result.state)
      return result.pageText
    },
    browser_find: async (args: { pattern: string; cursor?: number }) => {
      const result = await browserFind.execute(args)
      
      // Sync state across all browser tools
      browserSearch.state.setData(result.state)
      browserOpen.state.setData(result.state)
      return result.pageText
    },
  }

  const messages: Message[] = [
    {
      role: 'user',
      content: 'What does Ollama do?',
    },
  ]

  console.log('----- Prompt:', messages.find((m) => m.role === 'user')?.content, '\n')

  while (true) {
    const response = await client.chat({
      model: 'gpt-oss',
      messages: messages,
      tools: [browserSearchTool, browserOpenTool, browserFindTool],
      stream: true,
      think: true,
    })

    let hadToolCalls = false
    let startedThinking = false
    let finishedThinking = false
    let content = ''
    let thinking = ''
    
    for await (const chunk of response) {
      if (chunk.message.thinking && !startedThinking) {
        startedThinking = true
        process.stdout.write('Thinking:\n========\n\n')
      } else if (chunk.message.content && startedThinking && !finishedThinking) {
        finishedThinking = true
        process.stdout.write('\n\nResponse:\n========\n\n')
      }

      if (chunk.message.thinking) {
        thinking += chunk.message.thinking
        process.stdout.write(chunk.message.thinking)
      }
      if (chunk.message.content) {
        content += chunk.message.content
        process.stdout.write(chunk.message.content)
      }
      if (chunk.message.tool_calls && chunk.message.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: content,
          thinking: thinking,
        })
        
        hadToolCalls = true
        for (const toolCall of chunk.message.tool_calls) {
          const functionToCall = availableTools[toolCall.function.name as keyof typeof availableTools]
          if (functionToCall) {
            const args = toolCall.function.arguments as any
            const output = await functionToCall(args)

            // message history
            messages.push(chunk.message)
            // tool result
            messages.push({
              role: 'tool',
              content: JSON.stringify(output),
              tool_name: toolCall.function.name,
            })
          }
        }
      }
    }

    if (!hadToolCalls) {
      break
    }
  }
}

main().catch(console.error)
