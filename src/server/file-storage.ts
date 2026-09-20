import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(process.env.FILE_STORAGE_PATH || ".data/files");

export async function savePrivateFile(file: File) {
  const extension = path.extname(file.name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10);
  const storageName = `${crypto.randomUUID()}${extension}`;
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, storageName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return storageName;
}

export async function savePrivateBuffer(buffer: Buffer, extension: string) {
  const storageName = `${crypto.randomUUID()}${extension.startsWith(".") ? extension : `.${extension}`}`;
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, storageName), buffer, { flag: "wx" });
  return storageName;
}

export async function readPrivateFile(storageName: string) {
  if (!/^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/.test(storageName)) throw new Error("INVALID_STORAGE_NAME");
  return readFile(path.join(root, storageName));
}
