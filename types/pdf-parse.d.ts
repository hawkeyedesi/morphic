declare module 'pdf-parse' {
  interface PDFData {
    numpages: number
    numrender: number
    info: {
      PDFFormatVersion: string
      IsAcroFormPresent: boolean
      IsXFAPresent: boolean
      [key: string]: any
    }
    metadata: any
    text: string
    version: string
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => Promise<string>
    max?: number
  }

  function pdfParse(dataBuffer: Buffer, options?: PDFOptions): Promise<PDFData>
  
  export = pdfParse
}