import { extractText, getDocumentProxy } from 'unpdf';

/** PDF -> plain text, one line per text row (pages joined). Password-protected PDFs are rejected with a clear message. */
export async function pdfToText(bytes: Uint8Array, password?: string): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes), password ? { password } : {});
    const { text } = await extractText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).join('\n');
  } catch (e) {
    const msg = (e as Error).message || String(e);
    if (/password/i.test(msg)) throw new Error('This PDF is password-protected. Remove the password or upload the text/CSV export.');
    throw e;
  }
}
