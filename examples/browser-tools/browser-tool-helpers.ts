import type { SearchRequest, SearchResponse, FetchRequest, FetchResponse } from 'ollama'

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
  title?: string
  url?: string
  content: {
    fullText: string
  }
}


// Default number of tokens to show when calling displayPage
const DEFAULT_VIEW_TOKENS = 1024

// Capped tool content length
const CAPPED_TOOL_CONTENT_LEN = 8000

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

export class Browser {
  public state: BrowserState
  private searchClient?: {
    search: (request: SearchRequest) => Promise<SearchResponse>
  }
  private fetchClient?: {
    fetch: (request: FetchRequest) => Promise<FetchResponse>
  }

  constructor(
    initialState?: BrowserStateData,
    client?: {
      search: (request: SearchRequest) => Promise<SearchResponse>
      fetch: (request: FetchRequest) => Promise<FetchResponse>
    },
  ) {
    this.state = new BrowserState(initialState)
    if (client) {
      this.searchClient = client
      this.fetchClient = client
    }
  }

  setClients(client: {
    search: (request: SearchRequest) => Promise<SearchResponse>
    fetch: (request: FetchRequest) => Promise<FetchResponse>
  }): void {
    this.searchClient = client
    this.fetchClient = client
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
  protected getEndLoc(
    loc: number,
    numLines: number,
    totalLines: number,
    lines: string[],
  ): number {
    if (numLines <= 0) {
      const txt = this.joinLinesWithNumbers(lines.slice(loc))
      const data = this.state.getData()

      if (txt.length > data.viewTokens) {

        const maxCharsPerToken = 128


        const upperBound = Math.min((data.viewTokens + 1) * maxCharsPerToken, txt.length)
        const textToAnalyze = txt.substring(0, upperBound)


        const approxTokens = textToAnalyze.length / 4

        if (approxTokens > data.viewTokens) {

          const endIdx = Math.min(data.viewTokens * 4, txt.length)


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
  protected processMarkdownLinks(text: string): {
    processedText: string
    links: Record<number, string>
  } {
    const links: Record<number, string> = {}
    let linkID = 0


    const multiLinePattern = /\[([^\]]+)\]\s*\n\s*\(([^)]+)\)/g
    text = text.replace(multiLinePattern, (match) => {

      let cleaned = match.replace(/\n/g, ' ')

      cleaned = cleaned.replace(/\s+/g, ' ')
      return cleaned
    })


    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

    const processedText = text.replace(linkPattern, (match, linkText, linkURL) => {
      const cleanLinkText = linkText.trim()
      const cleanLinkURL = linkURL.trim()


      let domain = cleanLinkURL
      try {
        const url = new URL(cleanLinkURL)
        if (url.host) {
          domain = url.host

          domain = domain.replace(/^www\./, '')
        }
      } catch {

      }


      const formatted = `【${linkID}†${cleanLinkText}†${domain}】`


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

        wrapped.push('')
      } else if (line.length <= width) {
        wrapped.push(line)
      } else {

        const words = line.split(/\s+/)
        if (words.length === 0) {

          wrapped.push(line)
          continue
        }

        let currentLine = ''
        for (const word of words) {

          let testLine = currentLine
          if (testLine !== '') {
            testLine += ' '
          }
          testLine += word

          if (testLine.length > width && currentLine !== '') {

            wrapped.push(currentLine)
            currentLine = word
          } else {

            if (currentLine !== '') {
              currentLine += ' '
            }
            currentLine += word
          }
        }


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
  protected displayPage(
    page: Page,
    cursor: number,
    loc: number,
    numLines: number,
  ): string {
    let totalLines = page.lines.length


    if (totalLines === 0) {
      page.lines = ['']
      totalLines = 1
    }


    if (Number.isNaN(loc) || loc < 0) {
      loc = 0
    } else if (loc >= totalLines) {
      loc = Math.max(0, totalLines - 1)
    }


    const endLoc = this.getEndLoc(loc, numLines, totalLines, page.lines)

    let display = `[${cursor}] ${page.title}`
    if (page.url) {
      display += `(${page.url})\n`
    } else {
      display += '\n'
    }
    display += `**viewing lines [${loc} - ${endLoc - 1}] of ${totalLines - 1}**\n\n`

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
  protected buildSearchResultsPageCollection(
    query: string,
    results: SearchResponse,
  ): Page {
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


    textBuilder += '\n' 
    textBuilder += 'URL: \n' // L1: URL: (empty for search)
    textBuilder += '# Search Results\n' // L2: # Search Results
    textBuilder += '\n' // L3: empty

    for (const result of results.results as any[]) {
      // Derive domain from URL if available
      let domain = result.url || ''
      try {
        const url = new URL(domain)
        if (url.host) {
          domain = url.host.replace(/^www\./, '')
        }
      } catch {
        // leave domain as-is if parsing fails
      }

      const title = result.title || `Result ${linkIdx}`
      const linkFormat = `* 【${linkIdx}†${title}†${domain}】`
      textBuilder += linkFormat

      const rawSnippet = result.content || ''
      const capped = rawSnippet.length > 400 ? rawSnippet.substring(0, 400) + '…' : rawSnippet
      const cleaned = capped
        .replace(/\d{40,}/g, (m) => m.substring(0, 40) + '…')
        .replace(/\s{3,}/g, ' ')
      textBuilder += cleaned
      textBuilder += '\n'

      if (result.url) {
        page.links[linkIdx] = result.url
      }
      linkIdx++
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
      url: result.url || `result_${linkIdx}`,
      title: result.title || `Result ${linkIdx}`,
      text: '',
      lines: [],
      links: {},
      fetchedAt: new Date(),
    }

    let textBuilder = ''


    const linkFormat = `【${linkIdx}†${result.title || `Result ${linkIdx}`}】`
    textBuilder += linkFormat
    textBuilder += '\n'
    textBuilder += `URL: ${result.url || ''}\n`
    const numChars = Math.min(result.content.fullText.length, 300)
    textBuilder += result.content.fullText.substring(0, numChars)
    textBuilder += '\n\n'

    if (!result.content.fullText && result.url) {
      page.links[linkIdx] = result.url
    }

    if (result.content.fullText) {
      page.text = `URL: ${result.url || ''}\n${result.content.fullText}`
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
   * Creates a Page from fetch API results
   */
  protected buildPageFromFetchResult(
    requestedURL: string,
    fetchResponse: FetchResponse,
  ): Page {
    const page: Page = {
      url: requestedURL,
      title: requestedURL,
      text: '',
      lines: [],
      links: {},
      fetchedAt: new Date(),
    }

    if (fetchResponse.content) {
      page.text = fetchResponse.content
    }
    if (fetchResponse.title) {
      page.title = fetchResponse.title
    }
    if (fetchResponse.url) {
      page.url = fetchResponse.url
    }

    if (!page.text) {
      page.text = 'No content could be extracted from this page.'
    } else {
      page.text = `URL: ${page.url}\n${page.text}`
    }

    const { processedText, links } = this.processMarkdownLinks(page.text)
    page.text = processedText
    page.links = links


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

    const resultChunks: string[] = []
    let lineIdx = 0

    while (lineIdx < page.lines.length) {
      const line = page.lines[lineIdx]
      const lineLower = line.toLowerCase()

      if (!lineLower.includes(patternLower)) {
        lineIdx++
        continue
      }

      const endLine = Math.min(lineIdx + numShowLines, page.lines.length)

      let snippetBuilder = ''
      for (let j = lineIdx; j < endLine; j++) {
        snippetBuilder += page.lines[j]
        if (j < endLine - 1) {
          snippetBuilder += '\n'
        }
      }
      const snippet = snippetBuilder

      const linkFormat = `【${matchIdx}†match at L${lineIdx}】`
      const resultChunk = `${linkFormat}\n${snippet}`
      resultChunks.push(resultChunk)

      if (resultChunks.length >= maxResults) {
        break
      }

      matchIdx++
      lineIdx += numShowLines
    }


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
  
  async search(args: {
    query: string
    topn?: number
  }): Promise<{ state: BrowserStateData; pageText: string }> {
    const { query, topn = 5 } = args
    if (!this.searchClient) {
      throw new Error('Search client not provided')
    }

  const searchArgs: SearchRequest = {
    query,
    max_results: topn,
  }

    const result = await this.searchClient.search(searchArgs)

    const searchResultsPage = this.buildSearchResultsPageCollection(query, result)
    this.savePage(searchResultsPage)
    const cursor = this.getState().pageStack.length - 1

    for (let i = 0; i < result.results.length; i++) {
      const searchResult = result.results[i] as any
      const webSearchResult: WebSearchResult = {
        title: searchResult.title || 'Search Result',
        url: searchResult.url || `result_${i}`,
        content: {
          fullText: searchResult.content || '',
        },
      }
      const resultPage = this.buildSearchResultsPage(webSearchResult, i + 1)
      const data = this.getState()
      data.urlToPage[resultPage.url] = resultPage
      this.state.setData(data)
    }

    const pageText = this.displayPage(searchResultsPage, cursor, 0, -1)
    return { state: this.getState(), pageText: capToolContent(pageText) }
  }

  async open(args: {
    id?: string | number
    cursor?: number
    loc?: number
    num_lines?: number
  }): Promise<{ state: BrowserStateData; pageText: string }> {
    if (!this.fetchClient) {
      throw new Error('fetch client not provided')
    }

    let { cursor = -1 } = args
    const loc = args.loc ?? 0
    const num_lines = args.num_lines ?? -1

    let page: Page | undefined
    const state = this.getState()


    if (typeof args.id === 'string') {
      const url = args.id

      if (state.urlToPage[url]) {
        this.savePage(state.urlToPage[url])
        cursor = this.getState().pageStack.length - 1
        const pageText = this.displayPage(state.urlToPage[url], cursor, loc, num_lines)
        return { state: this.getState(), pageText: capToolContent(pageText) }
      }

      const fetchResponse = await this.fetchClient.fetch({ url })
      const newPage = this.buildPageFromFetchResult(url, fetchResponse)

      this.savePage(newPage)
      cursor = this.getState().pageStack.length - 1
      const pageText = this.displayPage(newPage, cursor, loc, num_lines)
      return { state: this.getState(), pageText: capToolContent(pageText) }
    }

    if (cursor >= 0) {
      if (cursor >= state.pageStack.length) {
        cursor = Math.max(0, state.pageStack.length - 1)
      }
      page = this.getPageFromStack(state.pageStack[cursor])
    } else {
      if (state.pageStack.length !== 0) {
        const pageURL = state.pageStack[state.pageStack.length - 1]
        page = this.getPageFromStack(pageURL)
      }
    }
    
    if (typeof args.id === 'number') {
      if (!page) {
        throw new Error('No current page to resolve link from')
      }

      const idInt = args.id
      const pageURL = page.links[idInt]
      if (!pageURL) {
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

        this.savePage(errorPage)
        cursor = this.getState().pageStack.length - 1
        const pageText = this.displayPage(errorPage, cursor, 0, -1)
        return { state: this.getState(), pageText: capToolContent(pageText) }
      }

      let newPage = state.urlToPage[pageURL]
      if (!newPage) {
        console.log('[browser_open] fetching URL from link id:', pageURL)
        let fetchResponse: FetchResponse
        try {
          fetchResponse = await this.fetchClient.fetch({ url: pageURL })
        } catch (error) {
          // Create an error page when fetch fails
          const errorPage: Page = {
            url: pageURL,
            title: `Failed to fetch: ${pageURL}`,
            text: `This tool result wasn't accessible. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            lines: [`This tool result wasn't accessible. Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
            links: {},
            fetchedAt: new Date(),
          }
          this.savePage(errorPage)
          cursor = this.getState().pageStack.length - 1
          const pageText = this.displayPage(errorPage, cursor, 0, -1)
          return { state: this.getState(), pageText: capToolContent(pageText) }
        }
        newPage = this.buildPageFromFetchResult(pageURL, fetchResponse)
      }

      this.savePage(newPage)
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

  async find(args: {
    pattern: string
    cursor?: number
  }): Promise<{ state: BrowserStateData; pageText: string }> {
    const { pattern } = args
    let { cursor = -1 } = args

    let page: Page
    const state = this.getState()

    if (cursor === -1) {
      if (state.pageStack.length === 0) {
        throw new Error('No pages to search in')
      }
      page = this.getPageFromStack(state.pageStack[state.pageStack.length - 1])
      cursor = state.pageStack.length - 1
    } else {
      if (cursor < 0 || cursor >= state.pageStack.length) {
        cursor = Math.max(0, Math.min(cursor, state.pageStack.length - 1))
      }
      page = this.getPageFromStack(state.pageStack[cursor])
    }

    const findPage = this.buildFindResultsPage(pattern, page)
    this.savePage(findPage)
    const newCursor = this.getState().pageStack.length - 1

    const pageText = this.displayPage(findPage, newCursor, 0, -1)
    return { state: this.getState(), pageText: capToolContent(pageText) }
  }
}
