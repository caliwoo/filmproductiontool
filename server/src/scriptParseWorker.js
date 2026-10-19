// Parsing a feature-length screenplay PDF with pdf-parse/pdf.js is CPU-bound
// and, for a long script, can run tens of seconds of synchronous work across
// many yielded-but-back-to-back page renders. Running it on the main thread
// starves the single Node event loop for that whole stretch -- Express can't
// even accept new connections, so Railway's proxy gets no response at all to
// its own health/dial checks and returns a 502, even though the server never
// actually crashed. Doing the parse in a worker thread instead keeps the main
// thread free to serve every other request (and the platform's own checks)
// no matter how long a given script takes to parse.
const { parentPort, workerData } = require('worker_threads');
const pdfParse = require('pdf-parse');
const { parseScriptLines, extractTitleInfo } = require('./scriptParser');

// Mirrors the page collector routes/scripts.js used to run inline: pdf-parse's
// default text renderer only tracks line breaks (by Y position) and drops
// each item's horizontal position, so this rebuilds lines as { text, x } from
// pdf.js's own item geometry instead, which the parser needs to classify body
// lines by their position on the page.
function createPageCollector(allLines) {
  return function collectPage(pageData) {
    const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
    return pageData.getTextContent(renderOptions).then((textContent) => {
      let lastY = null;
      let lineText = '';
      let lineX = null;

      const flushLine = () => {
        allLines.push({ text: lineText.replace(/\s+/g, ' ').trim(), x: lineX });
      };

      textContent.items.forEach((item) => {
        const y = item.transform[5];
        if (lastY !== null && y !== lastY) {
          flushLine();
          lineText = '';
          lineX = null;
        }
        if (lineX === null && item.str.trim() !== '') {
          lineX = item.transform[4];
        }
        lineText += item.str;
        lastY = y;
      });
      if (lastY !== null) flushLine();

      return '';
    });
  };
}

async function run() {
  const allLines = [];
  const buffer = Buffer.from(workerData.buffer);
  const data = await pdfParse(buffer, { pagerender: createPageCollector(allLines) });
  const scenes = parseScriptLines(allLines, { numPages: data.numpages });
  const { title, author } = extractTitleInfo(allLines);
  return {
    scenes,
    pageCount: data.numpages,
    suggestedName: title,
    suggestedDescription: author ? `Written by ${author}` : null,
  };
}

run()
  .then((result) => parentPort.postMessage({ ok: true, result }))
  .catch((err) => parentPort.postMessage({ ok: false, error: (err && err.message) || String(err) }));
