import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOST = "iat-api.xfyun.cn";
const PATH = "/v2/iat";

export async function GET() {
  const appId = process.env.XF_APPID;
  const apiKey = process.env.XF_API_KEY;
  const apiSecret = process.env.XF_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "讯飞语音识别未配置，请检查服务端环境变量。" },
      { status: 500 },
    );
  }

  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(signatureOrigin)
    .digest("base64");

  const authorizationOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");

  const url =
    `wss://${HOST}${PATH}?authorization=${encodeURIComponent(authorization)}` +
    `&date=${encodeURIComponent(date)}&host=${HOST}`;

  return NextResponse.json({ url, appId });
}
