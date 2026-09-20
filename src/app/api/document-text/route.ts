import path from "node:path";
import mammoth from "mammoth";
import { enforceRateLimit, enforceSameOriginRequest } from "@/lib/api-security";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 60000;

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export async function POST(request: Request) {
  const invalidOrigin = enforceSameOriginRequest(request);
  if (invalidOrigin) return invalidOrigin;
  const limited = enforceRateLimit(request, {
    bucket: "document-text",
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return Response.json({ error: "请选择 PDF 或 DOCX 文件。" }, { status: 415 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "没有读取到文件。" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return Response.json({ error: "文件须小于 5 MB。" }, { status: 413 });
    }

    const extension = path.extname(file.name).toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let extracted = "";

    if (extension === ".pdf" || file.type === "application/pdf") {
      // Load the PDF engine only for PDF files. Keeping this import out of the
      // route module prevents browser-only PDF globals from breaking DOCX
      // uploads in serverless Node runtimes.
      const pdfParse = (await import("pdf-parse")).default;
      extracted = (await pdfParse(buffer)).text;
    } else if (
      extension === ".docx" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      extracted = (await mammoth.extractRawText({ buffer })).value;
    } else {
      return Response.json({ error: "首版仅支持 PDF 和 DOCX。" }, { status: 415 });
    }

    const text = normalizeText(extracted);
    if (!text) {
      return Response.json(
        { error: "没有提取到文字；扫描版 PDF 请先进行 OCR。" },
        { status: 422 },
      );
    }
    return Response.json({
      text: text.slice(0, MAX_TEXT_LENGTH),
      truncated: text.length > MAX_TEXT_LENGTH,
      fileName: file.name,
    });
  } catch (error) {
    console.error(
      "document_text_parse_failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json(
      { error: "文件解析失败，请改为粘贴文本或更换文件后重试。" },
      { status: 422 },
    );
  }
}
