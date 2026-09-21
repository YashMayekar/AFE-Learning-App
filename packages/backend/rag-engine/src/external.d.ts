declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}

declare namespace NodeJS {
  interface Process {
    resourcesPath?: string;
  }
}